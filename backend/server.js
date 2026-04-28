'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app  = express();
const PORT = process.env.PORT || 3001;

if (!process.env.GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY missing — add it to .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── CORS: allow ALL Vercel URLs + localhost ────────────────────────────
const ALLOWED_ORIGINS = /vercel\.app$|localhost|127\.0\.0\.1/;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.test(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'anthropic-dangerous-direct-browser-access',
    'anthropic-version',
    'x-api-key'
  ],
}));
app.options('*', cors());
app.use(express.json({ limit: '2mb' }));

// ── Routes ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: '✅ VeriMedia AI Backend Running', gemini: 'connected' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'VeriMedia AI Backend', gemini: 'connected' });
});

// ── POST /chat ────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { messages = [], system_prompt = '', max_tokens = 1024 } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const lastMsg = messages[messages.length - 1]?.content || '';
    const fullPrompt = system_prompt
      ? `${system_prompt}\n\nUser: ${lastMsg}`
      : lastMsg;
    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text().trim();
    return res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    return res.json({ reply: 'Unable to respond right now. Please try again.' });
  }
});

// ── POST /analyze ─────────────────────────────────────────────────────
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

  if (typeof matchScore !== 'number' || typeof integrityScore !== 'number') {
    return res.status(400).json({ error: 'matchScore and integrityScore must be numbers' });
  }

  const trustScore = parseFloat((matchScore * integrityScore).toFixed(3));
  const matchPct   = Math.round(matchScore * 100);
  const intPct     = Math.round(integrityScore * 100);
  const trustPct   = Math.round(trustScore * 100);
  const flagStr    = flags.length > 0 ? flags.join(', ') : 'none';

  const prompt = `You are VeriMedia AI, an expert digital content forensics system.

Analyze this content detection result and return a structured JSON response.

DETECTION DATA:
- Content: ${contentDescription}
- Content Type: ${contentType}
- Platform: ${platform}
- Match Score: ${matchPct}%
- Integrity Score: ${intPct}%
- Trust Score: ${trustPct}%
- Viral Score: ${Math.round(viralScore)} / 100
- Decision: ${decision}
- Flags: ${flagStr}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "authenticity": "Real" | "AI-Generated" | "Manipulated" | "Uncertain",
  "authenticityDetail": "one sentence",
  "confidence": <integer 0-100>,
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "whyThisResult": "2-3 sentences",
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "recommendedAction": "one sentence"
}`;

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();
    const clean  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.json(buildFallback(decision, trustPct, matchPct, intPct, platform));
    }

    return res.json({
      summary:            parsed.summary            || fallbackSummary(decision, trustPct),
      authenticity:       parsed.authenticity       || 'Uncertain',
      authenticityDetail: parsed.authenticityDetail || '',
      confidence:         typeof parsed.confidence === 'number' ? parsed.confidence : trustPct,
      keyInsights:        Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 4) : [],
      whyThisResult:      parsed.whyThisResult      || '',
      riskLevel:          parsed.riskLevel          || deriveRisk(decision),
      recommendedAction:  parsed.recommendedAction  || '',
      _meta: { decision, trustScore, matchScore, integrityScore, viralScore, platform, flags },
    });

  } catch (err) {
    console.error('Gemini API error:', err.message);
    return res.json(buildFallback(decision, trustPct, matchPct, intPct, platform));
  }
});

// ── POST /dmca-reasoning ──────────────────────────────────────────────
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

  const prompt = `Write a formal DMCA takedown notice (17 U.S.C. § 512(c)).
Case ID: ${caseId} | Platform: ${platform} | Account: ${user}
Trust Score: ${tPct}% (match ${mPct}% × integrity ${iPct}%) | Decision: ${decision}
3-4 paragraphs, professional legal tone. End with "Evidence chain preserved by VeriMedia AI."
Return ONLY the notice body text.`;

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return res.json({ caseId, body: result.response.text().trim(), ai_source: 'gemini' });
  } catch (err) {
    console.error('DMCA error:', err.message);
    return res.json({
      caseId,
      body: `Pursuant to 17 U.S.C. § 512(c), content on ${platform} (${user}) with trust score ${tPct}% confirms unauthorized use. Decision: ${decision}. Evidence chain preserved by VeriMedia AI.`,
      ai_source: 'fallback',
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────
function buildFallback(decision, trustPct, matchPct, intPct, platform) {
  return {
    summary:            fallbackSummary(decision, trustPct),
    authenticity:       decision === 'ALLOW' ? 'Real' : decision === 'REVIEW' ? 'Uncertain' : 'Manipulated',
    authenticityDetail: `Trust score ${trustPct}% from match ${matchPct}% × integrity ${intPct}%.`,
    confidence:         trustPct,
    keyInsights: [
      `Match score: ${matchPct}% — visual similarity`,
      `Integrity score: ${intPct}% — content consistency`,
      `Trust score: ${trustPct}% — primary decision metric`,
    ],
    whyThisResult:     `Trust score ${trustPct}% produced ${decision}. ${decisionExplain(decision, trustPct)}`,
    riskLevel:         deriveRisk(decision),
    recommendedAction: decisionAction(decision, platform),
    _meta:             { decision, ai_source: 'fallback' },
  };
}

function fallbackSummary(decision, trustPct) {
  const map = {
    ALLOW:              `Content verified with trust score ${trustPct}%. No action required.`,
    REVIEW:             `Moderate similarity detected (trust ${trustPct}%). Manual review recommended.`,
    TAKEDOWN:           `Unauthorized modification detected (trust ${trustPct}%). DMCA recommended.`,
    EMERGENCY_TAKEDOWN: `Critical — low trust ${trustPct}% with high viral spread. Immediate action required.`,
  };
  return map[decision] || `Analysis complete. Trust score: ${trustPct}%.`;
}

function decisionExplain(decision, trustPct) {
  if (trustPct > 75)  return 'Exceeds 75% ALLOW threshold.';
  if (trustPct >= 40) return 'Falls in 40-75% REVIEW range.';
  return 'Below 40% TAKEDOWN threshold.';
}

function decisionAction(decision, platform) {
  const map = {
    ALLOW:              'No action required.',
    REVIEW:             `Review matched content on ${platform} before enforcement.`,
    TAKEDOWN:           `File DMCA takedown with ${platform}.`,
    EMERGENCY_TAKEDOWN: `Contact ${platform} Trust & Safety immediately.`,
  };
  return map[decision] || 'Consult your legal team.';
}

function deriveRisk(decision) {
  return { ALLOW: 'Low', REVIEW: 'Moderate', TAKEDOWN: 'High', EMERGENCY_TAKEDOWN: 'Critical' }[decision] || 'Moderate';
}

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  VeriMedia AI backend running → http://localhost:${PORT}`);
});
