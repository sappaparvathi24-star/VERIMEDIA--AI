'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Validate API key on startup ───────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY missing — add it to .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── CORS: allow Vercel frontend + localhost ────────────────────────────
const ALLOWED_ORIGINS = [
  'https://veri-media-ai-xi.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'VeriMedia AI Backend', gemini: 'connected' });
});
app.get('/', (_req, res) => {
  res.json({ status: '✅ VeriMedia AI Backend Running', gemini: 'connected' });
});

// ── POST /analyze ─────────────────────────────────────────────────────
/**
 * Body: {
 *   contentDescription: string   — human-readable description of the media
 *   matchScore:         number   — 0-1 cosine similarity
 *   integrityScore:     number   — 0-1 integrity
 *   viralScore:         number   — 0-100
 *   decision:           string   — ALLOW | REVIEW | TAKEDOWN | EMERGENCY_TAKEDOWN
 *   platform:           string   — e.g. "Instagram"
 *   contentType:        string   — e.g. "sports", "news"
 *   flags:              string[] — ["low_integrity", "viral_spread", ...]
 * }
 */
app.post('/analyze', async (req, res) => {
  const {
    contentDescription = 'media content',
    matchScore         = 0,
    integrityScore     = 0,
    viralScore         = 0,
    decision           = 'UNKNOWN',
    platform           = 'Unknown Platform',
    contentType        = 'general',
    flags              = [],
  } = req.body;

  // Basic validation
  if (typeof matchScore !== 'number' || typeof integrityScore !== 'number') {
    return res.status(400).json({ error: 'matchScore and integrityScore must be numbers' });
  }

  const trustScore  = parseFloat((matchScore * integrityScore).toFixed(3));
  const matchPct    = Math.round(matchScore * 100);
  const intPct      = Math.round(integrityScore * 100);
  const trustPct    = Math.round(trustScore * 100);
  const flagStr     = flags.length > 0 ? flags.join(', ') : 'none';

  const prompt = `You are VeriMedia AI, an expert digital content forensics system.

Analyze this content detection result and return a structured JSON response.

DETECTION DATA:
- Content: ${contentDescription}
- Content Type: ${contentType}
- Platform: ${platform}
- Match Score: ${matchPct}% (visual similarity to registered original)
- Integrity Score: ${intPct}% (spatial/temporal/semantic consistency)
- Trust Score: ${trustPct}% (= match × integrity — the primary decision metric)
- Viral Score: ${Math.round(viralScore)} / 100 (spread velocity)
- Decision: ${decision}
- Flags: ${flagStr}

DECISION RULES (for context):
- trust > 75% → ALLOW
- trust 40–75% → REVIEW  
- trust < 40% → TAKEDOWN
- trust < 30% AND viral > 85 → EMERGENCY_TAKEDOWN

Return ONLY valid JSON — no markdown, no explanation outside the JSON:

{
  "summary": "2–3 sentence plain-English summary of what was detected and why",
  "authenticity": "Real" | "AI-Generated" | "Manipulated" | "Uncertain",
  "authenticityDetail": "one sentence explaining the authenticity classification",
  "confidence": <integer 0–100>,
  "keyInsights": [
    "insight 1 — cite actual numbers",
    "insight 2 — cite actual numbers",
    "insight 3 — cite actual numbers"
  ],
  "whyThisResult": "2–3 sentences explaining exactly WHY the trust score produced this decision, citing match and integrity values",
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "recommendedAction": "one concrete sentence: what should the rights holder do next"
}`;

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('Gemini response was not valid JSON:', raw.slice(0, 200));
      // Return structured fallback so frontend never crashes
      return res.json(buildFallback(decision, trustPct, matchPct, intPct, platform));
    }

    // Ensure all required fields exist
    const response = {
      summary:             parsed.summary             || fallbackSummary(decision, trustPct),
      authenticity:        parsed.authenticity        || 'Uncertain',
      authenticityDetail:  parsed.authenticityDetail  || '',
      confidence:          typeof parsed.confidence === 'number' ? parsed.confidence : trustPct,
      keyInsights:         Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 4) : [],
      whyThisResult:       parsed.whyThisResult       || '',
      riskLevel:           parsed.riskLevel           || deriveRisk(decision),
      recommendedAction:   parsed.recommendedAction   || '',
      // Pass-through metadata for frontend display
      _meta: { decision, trustScore, matchScore, integrityScore, viralScore, platform, flags },
    };

    return res.json(response);

  } catch (err) {
    console.error('Gemini API error:', err.message);

    // Return fallback — never a 500 that breaks the UI
    return res.json(buildFallback(decision, trustPct, matchPct, intPct, platform));
  }
});

// ── POST /dmca-reasoning ──────────────────────────────────────────────
// Lightweight endpoint: just generates the DMCA reasoning text
app.post('/dmca-reasoning', async (req, res) => {
  const {
    platform       = 'Unknown',
    user           = 'Unknown User',
    decision       = 'TAKEDOWN',
    trustScore     = 0,
    matchScore     = 0,
    integrityScore = 0,
    contentType    = 'general',
    caseId         = 'VM-' + Date.now().toString(36).toUpperCase(),
  } = req.body;

  const tPct = Math.round(trustScore * 100);
  const mPct = Math.round(matchScore * 100);
  const iPct = Math.round(integrityScore * 100);

  const prompt = `You are a legal assistant for VeriMedia AI.

Write a formal DMCA takedown notice body (17 U.S.C. § 512(c)) for this case.

Case ID: ${caseId}
Platform: ${platform}
Account: ${user}
Content Type: ${contentType}
Decision: ${decision}
Trust Score: ${tPct}% (match ${mPct}% × integrity ${iPct}%)

Requirements:
- 3–4 short paragraphs
- Professional legal tone
- Reference the specific scores as evidence
- End with "Evidence chain preserved by VeriMedia AI."

Return ONLY the notice body text, no JSON, no headers.`;

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const body   = result.response.text().trim();
    return res.json({ caseId, body, ai_source: 'gemini' });
  } catch (err) {
    console.error('DMCA Gemini error:', err.message);
    return res.json({
      caseId,
      body: `This notice is submitted pursuant to 17 U.S.C. § 512(c).\n\nContent detected on ${platform} (account: ${user}) with trust score ${tPct}% (match ${mPct}% × integrity ${iPct}%) falls below the enforcement threshold, confirming unauthorized modification.\n\nDecision: ${decision}.\n\nEvidence chain preserved by VeriMedia AI.`,
      ai_source: 'fallback',
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────
function buildFallback(decision, trustPct, matchPct, intPct, platform) {
  return {
    summary:            fallbackSummary(decision, trustPct),
    authenticity:       decision === 'ALLOW' ? 'Real' : decision === 'REVIEW' ? 'Uncertain' : 'Manipulated',
    authenticityDetail: `Trust score of ${trustPct}% derived from match ${matchPct}% × integrity ${intPct}%.`,
    confidence:         trustPct,
    keyInsights: [
      `Match score: ${matchPct}% — visual similarity to registered original`,
      `Integrity score: ${intPct}% — spatial/temporal/semantic consistency`,
      `Trust score: ${trustPct}% — primary decision metric (match × integrity)`,
    ],
    whyThisResult:     `Trust score ${trustPct}% produced a ${decision} decision. ` + decisionExplain(decision, trustPct),
    riskLevel:         deriveRisk(decision),
    recommendedAction: decisionAction(decision, platform),
    _meta:             { decision, ai_source: 'fallback' },
  };
}

function fallbackSummary(decision, trustPct) {
  const map = {
    ALLOW:               `Content matches the registered original with high confidence (trust ${trustPct}%). No enforcement action required.`,
    REVIEW:              `Content shows moderate similarity to the registered original (trust ${trustPct}%). Manual review is recommended before any enforcement action.`,
    TAKEDOWN:            `Content shows signs of unauthorized modification (trust ${trustPct}%). Enforcement action recommended.`,
    EMERGENCY_TAKEDOWN:  `Critically low trust score combined with high viral spread detected (trust ${trustPct}%). Immediate enforcement required.`,
  };
  return map[decision] || `Analysis complete. Trust score: ${trustPct}%.`;
}

function decisionExplain(decision, trustPct) {
  if (trustPct > 75)  return 'Score exceeds the 75% ALLOW threshold.';
  if (trustPct >= 40) return 'Score falls in the 40–75% REVIEW range — insufficient for automatic enforcement.';
  return 'Score is below the 40% TAKEDOWN threshold, indicating high-likelihood modification.';
}

function decisionAction(decision, platform) {
  const map = {
    ALLOW:               'No action required — content is consistent with the registered original.',
    REVIEW:              `Review the matched content on ${platform} manually before filing any enforcement notice.`,
    TAKEDOWN:            `File a DMCA takedown notice with ${platform} and preserve the evidence package.`,
    EMERGENCY_TAKEDOWN:  `Contact ${platform} Trust & Safety immediately and file an emergency DMCA notice.`,
  };
  return map[decision] || 'Review the analysis and consult your legal team.';
}

function deriveRisk(decision) {
  return { ALLOW: 'Low', REVIEW: 'Moderate', TAKEDOWN: 'High', EMERGENCY_TAKEDOWN: 'Critical' }[decision] || 'Moderate';
}

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  VeriMedia AI backend running → http://localhost:${PORT}`);
  console.log(`   Gemini model: gemini-1.5-flash`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
