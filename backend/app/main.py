"""
VeriMedia AI — FastAPI Backend
Fixes applied:
  1. CORS allows all headers (including anthropic-dangerous-direct-browser-access)
  2. ALL AI calls (Gemini) happen server-side — API key never reaches the browser
  3. /analyze route uses Gemini 2.0 Flash via google-generativeai SDK
"""

import os
import base64
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="VeriMedia AI Backend", version="1.0.0")

# ── CORS ───────────────────────────────────────────────────────────────────────
# THIS IS THE FIX — allow_headers=["*"] stops the preflight rejection
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://verimedia-ai-jade.vercel.app",
        # Allow all Vercel preview URLs for this project
        "https://*.vercel.app",
        # Allow localhost for development
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],  # ← KEY FIX: allows anthropic-dangerous-direct-browser-access and any other header
)

# ── Gemini Setup ───────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

GEMINI_MODEL = "gemini-2.0-flash"

SYSTEM_PROMPT = """You are VeriMedia AI, an expert media forensics and authenticity analysis system.

Your job: Analyze media content for authenticity, deepfake indicators, manipulation artifacts, 
and intellectual property violations.

When analyzing content, provide:
1. AUTHENTICITY SCORE (0-100, where 100 = definitely authentic)
2. TRUST LEVEL: authentic | suspicious | manipulated | deepfake
3. DETECTED SIGNALS: list each signal found (compression artifacts, facial inconsistencies, 
   metadata anomalies, lighting mismatches, noise patterns, lipsync issues, etc.)
4. CONFIDENCE: 0.0 to 1.0
5. THREAT TYPE: none | manipulation | deepfake | ip_violation | synthetic
6. RECOMMENDATION: approve | review | reject | dmca
7. REASONING: 2-3 sentence explanation

Always respond in valid JSON matching this schema:
{
  "authenticity_score": 85,
  "trust_level": "authentic",
  "confidence": 0.92,
  "threat_type": "none",
  "signals": ["no compression artifacts", "consistent lighting", "natural noise patterns"],
  "recommendation": "approve",
  "reasoning": "The content shows no signs of manipulation...",
  "processing_time_ms": 1200
}"""


# ── Request / Response Models ──────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    content_type: str           # "image" | "video" | "text" | "url"
    data: Optional[str] = None  # base64 encoded for image/video
    url: Optional[str] = None   # for URL-based content
    text: Optional[str] = None  # for text content
    mime_type: Optional[str] = "image/jpeg"
    filename: Optional[str] = None


class AnalyzeResponse(BaseModel):
    authenticity_score: int
    trust_level: str
    confidence: float
    threat_type: str
    signals: list
    recommendation: str
    reasoning: str
    processing_time_ms: Optional[int] = None
    error: Optional[str] = None


# ── Health Check ───────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "VeriMedia AI Backend running", "gemini": bool(GEMINI_API_KEY)}


@app.get("/health")
async def health():
    return {"status": "ok", "model": GEMINI_MODEL}


# ── Main Analyze Endpoint ──────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server")

    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=1024,
            )
        )

        # Build content parts based on input type
        parts = []

        if req.content_type == "image" and req.data:
            # Image passed as base64
            image_bytes = base64.b64decode(req.data)
            parts.append({
                "inline_data": {
                    "mime_type": req.mime_type or "image/jpeg",
                    "data": req.data
                }
            })
            parts.append({"text": f"Analyze this image for authenticity and deepfake indicators. Filename: {req.filename or 'unknown'}"})

        elif req.content_type == "url" and req.url:
            # Fetch the image from URL, pass to Gemini
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(req.url)
                if resp.status_code == 200:
                    mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
                    b64 = base64.b64encode(resp.content).decode()
                    parts.append({"inline_data": {"mime_type": mime, "data": b64}})
                    parts.append({"text": f"Analyze this media from URL: {req.url}"})
                else:
                    parts.append({"text": f"Analyze the authenticity of content from: {req.url}. Provide a risk assessment based on the URL pattern."})

        elif req.content_type == "text" and req.text:
            parts.append({"text": f"Analyze this text content for authenticity and potential manipulation:\n\n{req.text}"})

        else:
            parts.append({"text": "No analyzable content provided. Return a default response indicating no content was detected."})

        # Call Gemini server-side (API key stays on the server)
        response = model.generate_content(parts)
        result_text = response.text

        # Parse JSON response
        import json
        result = json.loads(result_text)

        return result

    except json.JSONDecodeError:
        # Gemini didn't return valid JSON — construct a fallback
        return {
            "authenticity_score": 50,
            "trust_level": "suspicious",
            "confidence": 0.3,
            "threat_type": "unknown",
            "signals": ["analysis parsing error"],
            "recommendation": "review",
            "reasoning": "The AI analysis returned an unexpected format. Manual review recommended.",
            "error": "json_parse_error"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── DMCA Generation ────────────────────────────────────────────────────────────
class DMCARequest(BaseModel):
    content_url: str
    owner_name: str
    owner_email: str
    original_work_description: str
    infringing_url: str
    platform: Optional[str] = "unknown"


@app.post("/dmca/generate")
async def generate_dmca(req: DMCARequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=genai.GenerationConfig(temperature=0.1, max_output_tokens=2048)
    )

    prompt = f"""Generate a formal DMCA takedown notice with these details:
- Copyright Owner: {req.owner_name} <{req.owner_email}>
- Original Work: {req.original_work_description}
- Infringing URL: {req.infringing_url}
- Platform: {req.platform}

Format it as a complete, legally-structured DMCA Section 512(c) takedown notice."""

    response = model.generate_content(prompt)
    return {"dmca_notice": response.text, "status": "generated"}


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
