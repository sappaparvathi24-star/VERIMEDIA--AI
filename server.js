import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Lazy Google Gen AI initialization
let aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Helper to call Gemini with graceful fallback between models
async function callGemini(contents, config = {}) {
  const ai = getGenAI();
  if (!ai) return null;
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      if (response && response.text) {
        return { text: response.text, model };
      }
    } catch (_) {
      // Gracefully advance to next candidate model if current model experiences high demand or temporary unavailability
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Health check endpoints
// ---------------------------------------------------------------------------
function healthResponse(req, res) {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    service: 'VeriMedia AI Unified Backend',
    gemini: hasKey ? 'connected' : 'fallback-mode (no GEMINI_API_KEY)',
    models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
    timestamp: new Date().toISOString()
  });
}

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);
app.get('/api/v1/health', healthResponse);

// ---------------------------------------------------------------------------
// POST /chat — VeriMedia Assistant conversational agent
// ---------------------------------------------------------------------------
app.post('/chat', async (req, res) => {
  const { messages = [], prompt, system_prompt = '', max_tokens = 1024 } = req.body;

  let userText = '';
  if (prompt) {
    userText = prompt;
  } else if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1];
    userText = typeof last === 'string' ? last : (last.content || last.text || '');
  }

  if (!userText) {
    return res.status(400).json({ error: 'No prompt or messages provided' });
  }

  const fullPrompt = system_prompt
    ? `${system_prompt}\n\nUser Question:\n${userText}`
    : `You are VeriMedia AI Assistant, an expert in digital media rights, perceptual hashing, deepfake detection, forensic watermarking, and DMCA copyright enforcement.\nUser Question:\n${userText}`;

  const geminiResult = await callGemini(fullPrompt, {
    maxOutputTokens: max_tokens,
    temperature: 0.7
  });

  if (geminiResult && geminiResult.text) {
    return res.json({
      reply: geminiResult.text,
      content: [{ type: 'text', text: geminiResult.text }],
      text: geminiResult.text,
      source: geminiResult.model
    });
  }

  // Fallback conversational reply
  const fallbackReply = generateChatFallback(userText);
  return res.json({
    reply: fallbackReply,
    content: [{ type: 'text', text: fallbackReply }],
    text: fallbackReply,
    source: 'rule-based-fallback'
  });
});

// ---------------------------------------------------------------------------
// POST /analyze — Core Media Authenticity & Forensics
// ---------------------------------------------------------------------------
app.post('/analyze', async (req, res) => {
  // Check if caller sent a Claude/Gemini conversational format: { messages: [...] }
  if (Array.isArray(req.body.messages) && req.body.messages.length > 0) {
    const last = req.body.messages[req.body.messages.length - 1];
    const text = typeof last === 'string' ? last : (last.content || last.text || '');
    
    const geminiResult = await callGemini(text, {
      maxOutputTokens: req.body.max_tokens || 350,
      temperature: 0.4
    });

    if (geminiResult && geminiResult.text) {
      return res.json({
        reply: geminiResult.text,
        content: [{ type: 'text', text: geminiResult.text }],
        text: geminiResult.text,
        source: geminiResult.model
      });
    }

    const fallback = generateChatFallback(text);
    return res.json({
      reply: fallback,
      content: [{ type: 'text', text: fallback }],
      text: fallback,
      source: 'fallback'
    });
  }

  // Structured analysis payload
  const {
    contentDescription = 'Video clip uploaded to social platform',
    matchScore = 0.85,
    integrityScore = 0.60,
    viralScore = 0.70,
    decision = 'TAKEDOWN',
    platform = 'TikTok',
    contentType = 'sports',
    flags = []
  } = req.body;

  const trustScore = Math.max(0, Math.min(100, Math.round(
    ((1 - matchScore) * 0.45 + integrityScore * 0.45 + (1 - viralScore) * 0.10) * 100
  )));

  const prompt = `You are VeriMedia AI, an automated media rights enforcement intelligence engine.
Analyze this detected content item and return a strict JSON object (no markdown fences, no extra text):

Input metadata:
- Content: "${contentDescription}"
- Platform: ${platform}
- Content Type: ${contentType}
- Perceptual Match Score: ${(matchScore * 100).toFixed(1)}%
- Integrity Score: ${(integrityScore * 100).toFixed(1)}%
- Viral Risk: ${(viralScore * 100).toFixed(1)}%
- Computed Trust Score: ${trustScore}/100
- Initial Recommendation: ${decision}
- Flags: ${flags.length ? flags.join(', ') : 'None'}

Return ONLY a valid JSON object matching this exact schema:
{
  "summary": "1-2 sentence executive forensic overview",
  "authenticity": "GENUINE" | "ATTRIBUTION_REQUIRED" | "MANIPULATED" | "HIGH_RISK_INFRINGING",
  "authenticityDetail": "Detailed breakdown of forensic signals",
  "confidence": number between 0.80 and 0.99,
  "keyInsights": ["bullet 1", "bullet 2", "bullet 3"],
  "whyThisResult": "Clear causal rationale explaining the decision",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedAction": "ALLOW" | "REQUEST_ATTRIBUTION" | "SEND_DMCA_TAKEDOWN" | "EMERGENCY_TAKEDOWN",
  "dmcaEligible": boolean
}`;

  const geminiResult = await callGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.2
  });

  if (geminiResult && geminiResult.text) {
    try {
      const parsed = JSON.parse(geminiResult.text);
      return res.json({
        ...parsed,
        _meta: {
          engine: geminiResult.model,
          trustScore,
          matchScore,
          integrityScore,
          viralScore,
          platform
        }
      });
    } catch (_) {}
  }

  // Fallback forensic decision
  return res.json(buildForensicFallback({
    contentDescription,
    matchScore,
    integrityScore,
    viralScore,
    trustScore,
    decision,
    platform,
    flags
  }));
});

// ---------------------------------------------------------------------------
// POST /dmca-reasoning and POST /dmca/generate
// ---------------------------------------------------------------------------
async function handleDMCA(req, res) {
  const {
    caseId = `VM-${Date.now().toString().slice(-6)}`,
    workTitle = 'Protected Media Asset',
    rightsHolder = 'VeriMedia Authorized Rights Holder',
    infringingUrl = 'https://social-platform.com/clip/v99281',
    platform = 'TikTok',
    matchScore = 0.91,
    detectedEdits = 'Cropping, watermark removal, audio speed adjustment',
    claimType = 'Copyright Infringement (17 U.S.C. § 512)'
  } = req.body;

  const prompt = `Draft a legally formal, professional DMCA Takedown Notice under 17 U.S.C. § 512(c)(3) for:
Case ID: ${caseId}
Protected Work: "${workTitle}"
Rights Holder: ${rightsHolder}
Infringing Platform: ${platform}
Infringing URL: ${infringingUrl}
Technical Evidence: ${Math.round(matchScore * 100)}% perceptual hash match. Forensics detected: ${detectedEdits}.
Claim Type: ${claimType}

Format with clear headers:
1. IDENTIFICATION OF COPYRIGHTED WORK
2. IDENTIFICATION OF INFRINGING MATERIAL
3. TECHNICAL FORENSIC EVIDENCE
4. GOOD FAITH STATEMENT & DECLARATION UNDER PENALTY OF PERJURY
5. CONTACT & SIGNATURE BLOCK`;

  const geminiResult = await callGemini(prompt, { temperature: 0.3 });

  if (geminiResult && geminiResult.text) {
    return res.json({
      noticeText: geminiResult.text,
      caseId,
      platform,
      status: 'generated',
      engine: geminiResult.model
    });
  }

  // Legal template fallback
  const noticeText = `FORMAL NOTICE OF COPYRIGHT INFRINGEMENT (17 U.S.C. § 512)
Case Reference: ${caseId}
Date: ${new Date().toUTCString()}

To Copyright Designated Agent (${platform}):

1. IDENTIFICATION OF COPYRIGHTED WORK:
I am an authorized agent representing ${rightsHolder} ("Rights Holder"). The copyrighted work at issue is: "${workTitle}".

2. IDENTIFICATION OF INFRINGING MATERIAL:
The unauthorized publication is accessible at:
${infringingUrl}

3. TECHNICAL FORENSIC EVIDENCE:
Automated analysis by VeriMedia AI perceptual fingerprinting confirmed a ${Math.round(matchScore * 100)}% perceptual match against the master reference dataset.
Detected modifications: ${detectedEdits}.

4. GOOD FAITH & STATEMENT OF TRUTH:
I have a good faith belief that use of the copyrighted material is not authorized by the copyright owner, its agent, or the law. The information in this notification is accurate, and under penalty of perjury, I am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.

5. REQUESTED ACTION:
Expeditiously remove or disable access to the infringing material referenced above.

Respectfully submitted,
VeriMedia AI Rights Enforcement System on behalf of ${rightsHolder}`;

  return res.json({
    noticeText,
    caseId,
    platform,
    status: 'generated',
    engine: 'VeriMedia Template Generator'
  });
}

app.post('/dmca-reasoning', handleDMCA);
app.post('/dmca/generate', handleDMCA);

// ---------------------------------------------------------------------------
// API v1 compatibility endpoints for frontend services
// ---------------------------------------------------------------------------
app.post('/api/v1/detect/', (req, res) => {
  const { scenario = 'crop', platform = 'YouTube', username = 'content_reposter' } = req.body || {};
  const isThreat = scenario === 'crop' || scenario === 'deepfake' || scenario === 'manipulated';
  
  res.json({
    id: `scan-${Date.now()}`,
    scenario,
    platform,
    username,
    similarity: scenario === 'crop' ? 0.94 : scenario === 'deepfake' ? 0.88 : 0.65,
    integrity: scenario === 'deepfake' ? 0.22 : scenario === 'manipulated' ? 0.45 : 0.89,
    timestamp: new Date().toISOString(),
    ai_analysis: {
      decision: isThreat ? 'TAKEDOWN' : 'ALLOW',
      confidence: 0.93,
      reasoning: isThreat
        ? 'High similarity perceptual match with deliberate boundary crops to evade watermarks.'
        : 'Sufficient fair use or original commentary detected.'
    }
  });
});

app.get('/api/v1/cases/', (req, res) => {
  res.json([
    {
      id: 'VM-98210',
      workTitle: 'Global Championship Final Highlights',
      platform: 'TikTok',
      infringingUrl: 'https://tiktok.com/@sportsclip/video/7238192',
      status: 'TAKEDOWN_SUBMITTED',
      similarity: 0.96,
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'VM-98209',
      workTitle: 'Exclusive Interview Series Ep 4',
      platform: 'YouTube',
      infringingUrl: 'https://youtube.com/watch?v=mock_video_id',
      status: 'RESOLVED_REMOVED',
      similarity: 0.89,
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ]);
});

app.post('/api/v1/enforce/dmca', (req, res) => {
  res.json({
    status: 'queued',
    notice_id: `DMCA-${Date.now()}`,
    platform: req.body.platform || 'General',
    created_at: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Static file serving & SPA fallback
// ---------------------------------------------------------------------------
const frontendDir = path.join(__dirname, 'frontend');
app.use(express.static(frontendDir));

// Fallback to index.html for SPA / client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildForensicFallback({ contentDescription, matchScore, integrityScore, viralScore, trustScore, decision, platform, flags }) {
  const isHighMatch = matchScore >= 0.80;
  const isLowIntegrity = integrityScore < 0.60;

  let authenticity = 'GENUINE';
  let recommendedAction = 'ALLOW';
  let riskLevel = 'LOW';
  let whyThisResult = 'Content shows normal perceptual variance consistent with original publishing.';

  if (isHighMatch && isLowIntegrity) {
    authenticity = 'MANIPULATED';
    recommendedAction = 'SEND_DMCA_TAKEDOWN';
    riskLevel = 'HIGH';
    whyThisResult = `Detected ${(matchScore * 100).toFixed(0)}% fingerprint overlap with low integrity (${(integrityScore * 100).toFixed(0)}%), indicating intentional crop or watermark removal.`;
  } else if (isHighMatch) {
    authenticity = 'HIGH_RISK_INFRINGING';
    recommendedAction = 'SEND_DMCA_TAKEDOWN';
    riskLevel = 'CRITICAL';
    whyThisResult = `Direct 1:1 perceptual duplication (${(matchScore * 100).toFixed(0)}%) detected across ${platform} without rights clearance.`;
  } else if (isLowIntegrity) {
    authenticity = 'MANIPULATED';
    recommendedAction = 'REQUEST_ATTRIBUTION';
    riskLevel = 'MEDIUM';
    whyThisResult = 'Video exhibits synthetic artifacts or deepfake generation patterns requiring manual review.';
  }

  return {
    summary: `Analysis of ${contentDescription} on ${platform} yielded a Trust Score of ${trustScore}/100.`,
    authenticity,
    authenticityDetail: `Signals indicate perceptual match at ${(matchScore * 100).toFixed(1)}% with integrity rating of ${(integrityScore * 100).toFixed(1)}%.`,
    confidence: 0.94,
    keyInsights: [
      `Platform scanned: ${platform}`,
      `Perceptual match: ${(matchScore * 100).toFixed(0)}%`,
      `Integrity score: ${(integrityScore * 100).toFixed(0)}%`,
      flags.length ? `Flags: ${flags.join(', ')}` : 'No active adversarial masks found'
    ],
    whyThisResult,
    riskLevel,
    recommendedAction,
    dmcaEligible: matchScore >= 0.75,
    _meta: {
      engine: 'Deterministic Forensic Fallback',
      trustScore,
      matchScore,
      integrityScore,
      viralScore,
      platform
    }
  };
}

function generateChatFallback(query) {
  const q = (query || '').toLowerCase();
  if (q.includes('dmca') || q.includes('takedown')) {
    return 'Under 17 U.S.C. § 512, a valid DMCA notice requires identification of the copyrighted work, the infringing URL, contact information, and good faith attestations. VeriMedia AI automatically generates and submits this notice with technical fingerprint evidence attached.';
  }
  if (q.includes('deepfake') || q.includes('manipulat')) {
    return 'VeriMedia AI detects manipulation using a multi-signal pipeline: frame-by-frame perceptual hashing, audio spectrogram verification, facial landmark consistency, and edge-crop artifact detection.';
  }
  if (q.includes('fingerprint') || q.includes('hash')) {
    return 'Perceptual fingerprinting maps media frames into robust vector embeddings that remain stable despite compression, scaling, color changes, or cropping, allowing instant identification against protected master catalogs.';
  }
  return 'VeriMedia AI is operational. You can scan videos, inspect 6-signal forensic breakdowns, evaluate trust scores, and issue automated DMCA takedown requests across supported social platforms.';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ VeriMedia AI server running on http://0.0.0.0:${PORT}`);
});
