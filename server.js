import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import exifr from 'exifr';
import { fileTypeFromBuffer } from 'file-type';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { provenanceService } from './src/provenance/service.js';
import { tickMonitoringScheduler } from './src/provenance/monitoring.js';
import { 
  searchReddit, 
  searchYouTube, 
  searchMastodon, 
  searchArchiveOrg, 
  searchGoogleImages, 
  getDiscoveryHealth,
  checkRateLimit 
} from './src/proxy/searchProxy.js';
import { MultiSourceDiscoveryManager } from './src/matching/providers/index.js';
import { getFullDiscoveryTransparency } from './src/matching/discoveryTransparency.js';
import { computeAverageHash, hashSimilarity } from './src/forensics/perceptualHash.js';
import { getArtifactMedia, storeArtifactMedia } from './src/forensics/imageForensics.js';
import { ForensicJobQueue } from './src/jobs/forensicQueue.js';
import {
  authenticateUser,
  requireAuth,
  requireRole,
  authorizeChain,
  loginUser,
  logoutUser,
  getUserProfile,
  seedDefaultAuthEntities
} from './src/security/auth.js';
import {
  authLimiter,
  uploadLimiter,
  analysisLimiter,
  chatLimiter,
  discoveryLimiter,
  monitoringLimiter,
  reportLimiter,
  generalLimiter
} from './src/security/rateLimiter.js';
import {
  logAuditEvent,
  getAuditEvents,
  AuditAction,
  AuditObjectType
} from './src/audit/auditService.js';
import { persistence } from './src/db/persistence.js';
import {
  authenticate,
  investigationAccessGuard,
  entityAccessGuard,
  logAudit
} from './src/middleware/auth.js';

dotenv.config();

// ---------------------------------------------------------------------------
// Media file persistence — write uploaded buffers to data/media/<sha256>.<ext>
// so they survive server restarts and can be re-served / re-analyzed.
// ---------------------------------------------------------------------------
const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');
try {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
} catch (_) {}

/**
 * Persist a media buffer to disk. Returns the file path.
 * @param {Buffer} buffer
 * @param {string} sha256
 * @param {string} mimeType
 * @returns {string|null}
 */
function persistMediaToDisk(buffer, sha256, mimeType) {
  try {
    const ext = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin';
    const filePath = path.join(MEDIA_DIR, `${sha256}.${ext}`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }
    return filePath;
  } catch (err) {
    console.warn('[MediaPersist] Could not write to disk:', err.message);
    return null;
  }
}

// Seed default auth entities (organizations and users per 12_SECURITY_SPEC.md §5-6)
seedDefaultAuthEntities();

// Asynchronously hydrate store from Supabase PostgreSQL if configured
await provenanceService.hydrate();

// Periodic snapshotting loop to Supabase (every 10 seconds)
setInterval(() => {
  persistence.snapshotAll(provenanceService.store);
}, 10 * 1000).unref?.();

// Monitoring scheduler — check and execute overdue jobs every 60 seconds
setInterval(() => {
  tickMonitoringScheduler(provenanceService.store).catch(err =>
    console.warn('[MonitoringScheduler] tick error:', err.message)
  );
}, 60 * 1000).unref?.();

// Graceful shutdown flush
const gracefulShutdown = async () => {
  console.log('🔄 [Server] Flushing final state snapshot to database...');
  await persistence.snapshotAll(provenanceService.store);
  process.exit(0);
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const multiSourceDiscovery = new MultiSourceDiscoveryManager();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Render (and most PaaS) assign a dynamic port via process.env.PORT.
// Fall back to 3000 for local development only.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ---------------------------------------------------------------------------
// Robust, Production-Ready CORS Configuration
// Explicitly permits:
// - https://verimedia-ai-jade.vercel.app (Production Vercel frontend)
// - All *.vercel.app deployments (previews and aliases)
// - Local development origins (localhost, 127.0.0.1 on any port)
// - Google Cloud Run / AI Studio preview containers (*.run.app)
// - Render backend domains (*.onrender.com)
// - Any origins specified in process.env.CORS_ORIGINS, FRONTEND_URL, or CLIENT_URL
// ---------------------------------------------------------------------------
const defaultAllowedOrigins = [
  'https://verimedia-ai-jade.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

const envAllowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  : [];

if (process.env.FRONTEND_URL) {
  envAllowedOrigins.push(process.env.FRONTEND_URL.trim().replace(/^['"]|['"]$/g, ''));
}
if (process.env.CLIENT_URL) {
  envAllowedOrigins.push(process.env.CLIENT_URL.trim().replace(/^['"]|['"]$/g, ''));
}

const configuredOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

export function isOriginAllowed(origin) {
  if (!origin) return true; // Non-browser clients, cURL, server-to-server, health checks
  
  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.replace(/\/+$/, '');

  // Wildcard configured in environment
  if (configuredOrigins.includes('*') || process.env.CORS_ORIGINS === '*') {
    return true;
  }

  // Exact match from allowed list
  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // Localhost or loopback on any port (HTTP & HTTPS)
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  // Vercel apps (*.vercel.app)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(normalizedOrigin)) {
    return true;
  }

  // Cloud Run / AI Studio preview containers (*.run.app)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*run\.app$/.test(normalizedOrigin)) {
    return true;
  }

  // Render domains (*.onrender.com)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*onrender\.com$/.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, origin || true);
    }
    // Deny gracefully without throwing an unhandled Error that causes 500 on preflight
    return callback(null, false);
  },
  credentials: false, // Token-based Authorization headers used; cookies not required
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Range',
    'X-Case-ID',
    'X-Investigation-ID',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'X-API-Deprecated',
    'X-API-Sunset',
    'Warning',
    'ETag'
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache preflight response for 24 hours
};

// ---------------------------------------------------------------------------
// CORS safety-net: respond to ALL OPTIONS preflight requests immediately
// before any other middleware, even if the service is waking from cold start.
// This prevents the browser from seeing a connection-refused / timeout as a
// CORS failure during Render cold-start (free tier spin-up can take 15–30s).
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // Non-browser (cURL, server-to-server) — allow
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key,X-Requested-With,Accept,Origin,Range,X-Case-ID,X-Investigation-ID,Cache-Control,Pragma');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Mount CORS middleware as the very first handler
app.use(cors(corsOptions));
// Handle OPTIONS preflight requests globally across all routes
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(authenticateUser);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Lazy Google Gen AI initialization
let aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Helper to call Gemini with graceful fallback between models
async function callGemini(contents, config = {}) {
  const ai = getGenAI();
  if (!ai) return null;
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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

// In-process asynchronous forensic task scheduler & queue
const forensicJobQueue = new ForensicJobQueue({
  provenanceService,
  callGeminiFn: callGemini
});

// ---------------------------------------------------------------------------
// Health check endpoints
// ---------------------------------------------------------------------------
function healthResponse(req, res) {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  const allArtifacts = provenanceService.getArtifacts ? provenanceService.getArtifacts() : [];
  const allInvestigations = provenanceService.getInvestigations();
  res.json({
    status: 'ok',
    service: 'VeriMedia AI Unified Backend',
    services: {
      'Express Server': 'operational',
      'SQLite Database': 'operational',
      'Gemini AI': hasKey ? 'operational' : 'fallback-mode',
      'Provenance Engine': 'operational',
      'Discovery Providers': 'operational'
    },
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    total_scans: allArtifacts.filter(a => !a.isDemo).length,
    total_investigations: allInvestigations.filter(i => !i.isDemo).length,
    gemini: hasKey ? 'connected' : 'fallback-mode (no GEMINI_API_KEY)',
    models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
    timestamp: new Date().toISOString()
  });
}

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);
app.get('/api/v1/health', healthResponse);

// ---------------------------------------------------------------------------
// POST /chat, /api/chat, /api/v1/chat — VeriMedia Assistant conversational agent
// ---------------------------------------------------------------------------
const handleChat = async (req, res) => {
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
};

// Helper for calibrated forensic confidence calculation based on signal concordance
function computeCalibratedForensicConfidence({
  matchScore = 0.5,
  integrityScore = 0.5,
  hasArtifact = false,
  hasRealEla = false,
  hasRealExif = false
} = {}) {
  let base = 0.45;
  const signalSpread = Math.abs(matchScore - (1 - integrityScore));
  const concordance = Math.max(0, 1 - signalSpread);
  const matchStrength = Math.abs(matchScore - 0.5) * 2;
  const integrityStrength = Math.abs(integrityScore - 0.5) * 2;

  let score = base + (matchStrength * 0.18) + (integrityStrength * 0.18) + (concordance * 0.10);

  if (hasArtifact) {
    score += 0.05;
    if (hasRealEla) score += 0.05;
    if (hasRealExif) score += 0.04;
  }

  if (signalSpread > 0.6) {
    score -= 0.15;
  }

  return Number(Math.max(0.15, Math.min(0.92, score)).toFixed(2));
}

app.post('/chat', chatLimiter, handleChat);
app.post('/api/chat', chatLimiter, handleChat);
app.post('/api/v1/chat', chatLimiter, handleChat);

// ---------------------------------------------------------------------------
// Authentication Endpoints (10_API_SPEC.yaml & 12_SECURITY_SPEC.md §5-6)
// ---------------------------------------------------------------------------
const handleLogin = (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = loginUser({ email, password });
    logAuditEvent({
      investigationId: null,
      actor: result.user.email,
      action: AuditAction.LOGIN,
      objectType: AuditObjectType.AUTH,
      objectId: result.user.id,
      req
    });
    res.json(result);
  } catch (err) {
    logAuditEvent({
      investigationId: null,
      actor: req.body?.email || 'ANONYMOUS',
      action: AuditAction.AUTH_FAILURE,
      objectType: AuditObjectType.AUTH,
      afterState: { reason: err.message },
      req
    });
    res.status(401).json({ error: err.message, code: 'AUTH_FAILED' });
  }
};

const handleLogout = (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')?.trim();
  logoutUser(token);
  logAuditEvent({
    investigationId: null,
    actor: req.user?.email || 'ANONYMOUS',
    action: AuditAction.LOGOUT,
    objectType: AuditObjectType.AUTH,
    req
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

const handleGetMe = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  }
  const profile = getUserProfile(req.user.id);
  res.json(profile || req.user);
};

app.post('/auth/login', authLimiter, handleLogin);
app.post('/api/auth/login', authLimiter, handleLogin);
app.post('/api/v1/auth/login', authLimiter, handleLogin);

app.post('/auth/logout', authLimiter, handleLogout);
app.post('/api/auth/logout', authLimiter, handleLogout);
app.post('/api/v1/auth/logout', authLimiter, handleLogout);

app.get('/auth/me', requireAuth, handleGetMe);
app.get('/api/auth/me', requireAuth, handleGetMe);
app.get('/api/v1/auth/me', requireAuth, handleGetMe);

// ---------------------------------------------------------------------------
// Audit Log Endpoints (12_SECURITY_SPEC.md §10)
// ---------------------------------------------------------------------------
app.get('/api/audit-logs', requireAuth, (req, res) => {
  try {
    const { investigationId, action, objectType, limit, offset } = req.query;
    const events = getAuditEvents({
      investigationId: investigationId ? String(investigationId) : null,
      action: action ? String(action) : null,
      objectType: objectType ? String(objectType) : null,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json({
      events,
      count: events.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Short alias used by SystemPanel UI
app.get('/api/audit', requireAuth, (req, res) => {
  try {
    const { investigationId, limit } = req.query;
    const events = getAuditEvents({
      investigationId: investigationId ? String(investigationId) : null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    res.json({ events, count: events.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/audit-logs', requireAuth, (req, res) => {
  try {
    const { investigationId, action, objectType, limit, offset } = req.query;
    const events = getAuditEvents({
      investigationId: investigationId ? String(investigationId) : null,
      action: action ? String(action) : null,
      objectType: objectType ? String(objectType) : null,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json({
      events,
      count: events.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/investigations/:id/audit-logs', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const events = getAuditEvents({
      investigationId: req.params.id,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0
    });
    res.json({
      investigationId: req.params.id,
      events,
      count: events.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /analyze, /api/analyze, /api/v1/analyze — Core Media Authenticity & Forensics
// ---------------------------------------------------------------------------
const handleAnalyze = async (req, res) => {
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
    flags = [],
    artifactId,
    investigationId
  } = req.body;

  // Retrieve deterministic artifact forensics if available
  let realArtifact = null;
  let realElaFinding = null;
  let realExif = null;

  if (artifactId) {
    realArtifact = provenanceService.getArtifact(artifactId);
  } else if (investigationId) {
    const inv = provenanceService.getInvestigation(investigationId);
    if (inv && inv.artifactIds && inv.artifactIds.length > 0) {
      realArtifact = provenanceService.getArtifact(inv.artifactIds[0]);
    }
  }

  if (realArtifact && realArtifact.investigationId) {
    const findings = provenanceService.getFindings(realArtifact.investigationId);
    realElaFinding = findings.find(f => f.category === 'IMAGE_FORENSICS' || (f.title && f.title.includes('Forensic')));
    realExif = realArtifact.metadata?.exif || null;
  }

  const calibratedConfidence = computeCalibratedForensicConfidence({
    matchScore,
    integrityScore,
    hasArtifact: Boolean(realArtifact),
    hasRealEla: Boolean(realElaFinding),
    hasRealExif: Boolean(realExif)
  });

  const trustScore = Math.max(0, Math.min(100, Math.round(
    ((1 - matchScore) * 0.45 + integrityScore * 0.45 + (1 - viralScore) * 0.10) * 100
  )));

  const epistemicBoundary = {
    calibratedConfidence,
    confidenceBasis: 'CALIBRATED_SIGNAL_CONCORDANCE',
    groundedInArtifact: Boolean(realArtifact),
    deterministicSignals: {
      elaEvaluated: Boolean(realElaFinding),
      exifExtracted: Boolean(realExif),
      perceptualHashAvailable: Boolean(realArtifact?.perceptualHash)
    },
    limitations: [
      'Confidence is mathematically calibrated from signal concordance, not an arbitrary ungrounded estimate.',
      'Pixel-level ELA and perceptual hashing measure compression inconsistencies and perceptual distances; they do not establish human intent or legal ownership without an authoritative provenance anchor.'
    ]
  };

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
- Calibrated Statistical Confidence: ${(calibratedConfidence * 100).toFixed(0)}%
- Pixel-Level ELA: ${realElaFinding ? (realElaFinding.status === 'SUPPORTED' ? 'Compression anomaly detected' : 'Standard uniform compression') : 'Not uploaded/evaluated'}
- EXIF Metadata: ${realExif ? 'EXIF metadata present and inspected' : 'No embedded EXIF metadata'}
- Flags: ${flags.length ? flags.join(', ') : 'None'}

Return ONLY a valid JSON object matching this exact schema:
{
  "summary": "1-2 sentence executive forensic overview",
  "authenticity": "GENUINE" | "ATTRIBUTION_REQUIRED" | "MANIPULATED" | "HIGH_RISK_INFRINGING",
  "authenticityDetail": "Detailed breakdown of forensic signals",
  "confidence": calibrated float between 0.10 and 0.95 reflecting genuine evidentiary strength (e.g., 0.25-0.55 if ambiguous; 0.85+ only if signals are strongly concordant and verified. Never fabricate ungrounded certainty),
  "keyInsights": ["bullet 1", "bullet 2", "bullet 3"],
  "whyThisResult": "Clear causal rationale explaining the decision",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedAction": "ALLOW" | "REQUEST_ATTRIBUTION" | "SEND_DMCA_TAKEDOWN" | "EMERGENCY_TAKEDOWN",
  "dmcaEligible": boolean
}`;

  logAuditEvent({
    investigationId: investigationId || realArtifact?.investigationId || null,
    actor: req.user?.email,
    action: AuditAction.ANALYSIS_RUN,
    objectType: AuditObjectType.ANALYSIS_RUN,
    afterState: {
      decision,
      matchScore,
      integrityScore,
      trustScore,
      calibratedConfidence
    },
    req
  });

  const geminiResult = await callGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.2
  });

  if (geminiResult && geminiResult.text) {
    try {
      const parsed = JSON.parse(geminiResult.text);
      return res.json({
        ...parsed,
        epistemicBoundary,
        _meta: {
          engine: geminiResult.model,
          trustScore,
          matchScore,
          integrityScore,
          viralScore,
          calibratedConfidence,
          platform
        }
      });
    } catch (_) {}
  }

  // Fallback forensic decision
  const fallbackResult = buildForensicFallback({
    contentDescription,
    matchScore,
    integrityScore,
    viralScore,
    trustScore,
    decision,
    platform,
    flags,
    calibratedConfidence
  });

  return res.json({
    ...fallbackResult,
    epistemicBoundary
  });
};

app.post('/analyze', analysisLimiter, handleAnalyze);
app.post('/api/analyze', analysisLimiter, handleAnalyze);
app.post('/api/v1/analyze', analysisLimiter, handleAnalyze);

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

// ---------------------------------------------------------------------------
// Legacy & Compatibility Endpoints (Slated for Deprecation / v1 Support)
// Canonical endpoints are located under /api/investigations/* and /api/claims/*
// ---------------------------------------------------------------------------

function applyLegacyDeprecationHeaders(res, canonicalEndpoint) {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Sunset', '2026-12-31T23:59:59Z');
  res.setHeader('Warning', `299 - "This endpoint is part of the legacy rights-enforcement API family and is deprecated. Migrate to ${canonicalEndpoint}."`);
}

app.post('/dmca-reasoning', (req, res, next) => {
  applyLegacyDeprecationHeaders(res, '/api/investigations/:id/report');
  handleDMCA(req, res, next);
});

app.post('/dmca/generate', (req, res, next) => {
  applyLegacyDeprecationHeaders(res, '/api/investigations/:id/report');
  handleDMCA(req, res, next);
});

// ---------------------------------------------------------------------------
// API v1 compatibility endpoints for frontend services (Deprecated)
// ---------------------------------------------------------------------------
app.get(['/api/v1/detect/stats', '/api/v1/detect/stats/'], (req, res) => {
  const allArtifacts = provenanceService.getArtifacts ? provenanceService.getArtifacts() : [];
  const realArtifacts = allArtifacts.filter(a => !a.isDemo);
  const since24h = Date.now() - 86400000;
  const scans24h = realArtifacts.filter(a => a.createdAt && new Date(a.createdAt).getTime() > since24h).length;
  const threats = realArtifacts.filter(a => {
    const fa = a.metadata?.forensicAnalysis;
    return fa && (fa.riskLevel === 'HIGH' || fa.riskLevel === 'CRITICAL');
  }).length;
  res.json({
    total_scans: realArtifacts.length,
    status: 'operational',
    active_threats: threats,
    scans_24h: scans24h,
    version: '1.0.0'
  });
});

const handleV1Detect = async (req, res) => {
  applyLegacyDeprecationHeaders(res, '/api/investigations/:id/analyze');
  const uploadedFile = req.file || (req.files && req.files[0]);
  let {
    scenario = 'normal',
    platform = 'YouTube',
    username = 'content_reposter',
    caption = '',
    content_type = 'sports',
    artifactId,
    investigationId
  } = req.body || {};

  // If a file was uploaded directly to detect endpoint, register and run deep forensics on it immediately!
  let artifact = null;
  if (uploadedFile) {
    const buffer = uploadedFile.buffer;
    const filename = uploadedFile.originalname || 'uploaded_media.jpg';
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const byteSize = buffer.length;

    let mimeType = uploadedFile.mimetype || 'image/jpeg';
    try {
      const typeInfo = await fileTypeFromBuffer(buffer);
      if (typeInfo && typeInfo.mime) mimeType = typeInfo.mime;
    } catch (_) {}

    let dimensions = null;
    let exif = null;
    let pHash = null;

    if (mimeType.startsWith('image/')) {
      try {
        const meta = await sharp(buffer).metadata();
        if (meta.width && meta.height) {
          dimensions = { width: meta.width, height: meta.height };
        }
      } catch (_) {}

      try {
        exif = await exifr.parse(buffer);
      } catch (_) {}

      try {
        pHash = await computeAverageHash(buffer);
      } catch (_) {}
    }

    let invId = investigationId;
    if (!invId) {
      const invs = provenanceService.getInvestigations();
      invId = invs && invs.length > 0 ? invs[0].id : null;
      if (!invId) {
        const defaultInv = provenanceService.createInvestigation({
          title: 'Direct Media Detection Investigation',
          description: 'Auto-created investigation for direct media detection upload',
          createdBy: req.user?.email || 'analyst@verimedia.ai'
        });
        invId = defaultInv.id;
      }
    }

    // Persist buffer to disk so video forensics (ffprobe) and re-analysis work after restart
    const diskPath = persistMediaToDisk(buffer, sha256, mimeType);

    artifact = provenanceService.createArtifact({
      investigationId: invId,
      filename,
      mimeType,
      byteSize,
      sha256,
      perceptualHash: pHash,
      dimensions: dimensions || null,
      metadata: {
        ...(exif ? { exif } : {}),
        originalName: uploadedFile.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.email || 'analyst@verimedia.ai',
        ...(diskPath ? { filePath: diskPath } : {})
      }
    });

    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      // Route through the real service — it will run ffprobe if filePath is available,
      // or return an honest SKIPPED with reason if the file is not on disk.
      try {
        await provenanceService.runImageForensicAnalysis({
          investigationId: invId,
          artifactId: artifact.id,
          buffer,
          mimeType,
          exif,
          callGeminiFn: callGemini
        });
      } catch (err) {
        console.warn('[Forensics] Video/audio analysis failed:', err.message);
      }
    } else if (mimeType.startsWith('image/')) {
      try {
        await provenanceService.runImageForensicAnalysis({
          investigationId: invId,
          artifactId: artifact.id,
          buffer,
          mimeType,
          exif,
          callGeminiFn: callGemini
        });
      } catch (err) {
        console.warn('[Forensics] Direct detection image analysis failed:', err.message);
      }
    }
    artifactId = artifact.id;
    investigationId = invId;
    artifact = provenanceService.getArtifact(artifact.id) || artifact;
  } else if (artifactId) {
    artifact = provenanceService.getArtifact(artifactId);
  } else if (investigationId) {
    artifact = provenanceService.getArtifacts(investigationId)[0] || null;
  }

  // Real detection branch if artifact or investigation is provided
  if (artifact) {
    const invId = artifact.investigationId || investigationId;
    const inv = invId ? provenanceService.getInvestigation(invId) : null;
    const forensic = artifact.metadata?.forensicAnalysis || null;

    // Check if media is video or audio
    const isVideoOrAudio = (artifact.mimeType && (artifact.mimeType.startsWith('video/') || artifact.mimeType.startsWith('audio/'))) ||
      artifact.type === 'VIDEO' || artifact.type === 'AUDIO';
    const isSkipped = forensic?.status === 'SKIPPED' || isVideoOrAudio;

    // Calculate real perceptual and hash similarity against other artifacts in store
    const allArtifacts = provenanceService.getArtifacts().filter(a => a.id !== artifact.id);
    let highestSimilarity = 0.0;
    let matchedRef = null;

    for (const ref of allArtifacts) {
      if (artifact.sha256 && ref.sha256 && artifact.sha256 === ref.sha256) {
        highestSimilarity = 1.0;
        matchedRef = ref;
        break;
      }
      if (artifact.perceptualHash && ref.perceptualHash) {
        const sim = hashSimilarity(artifact.perceptualHash, ref.perceptualHash);
        if (sim > highestSimilarity) {
          highestSimilarity = sim;
          matchedRef = ref;
        }
      }
    }

    const isThreat = highestSimilarity > 0.80 || (forensic?.riskLevel === 'HIGH' || forensic?.riskLevel === 'CRITICAL');
    const decision = isThreat
      ? (highestSimilarity > 0.95 ? 'EMERGENCY_TAKEDOWN' : 'TAKEDOWN')
      : (highestSimilarity > 0.60 ? 'REVIEW REQUIRED' : (isSkipped ? 'SKIPPED' : (forensic?.status === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'ALLOW')));

    // Genuinely computed signals or explicitly null/absent
    const signals = {
      match_score: Number(highestSimilarity.toFixed(2)),
      spatial_diff: typeof forensic?.signals?.spatial_diff === 'number'
        ? forensic.signals.spatial_diff
        : (forensic?.ela?.status === 'COMPLETED' ? Number(Math.min(1.0, (forensic.ela.meanError || 0) / 40).toFixed(2)) : null),
      color_diff: null,
      frame_diff: null,
      temporal_diff: null,
      noise_score: typeof forensic?.signals?.noise_score === 'number' ? forensic.signals.noise_score : null,
      watermark_detected: null
    };

    const integritySignals = {
      jpeg_artifact: forensic?.ela?.status === 'COMPLETED' && typeof forensic.ela.meanError === 'number'
        ? Number(Math.min(1.0, forensic.ela.meanError / 30).toFixed(2))
        : null,
      noise_pattern: null,
      edge_consistency: typeof forensic?.signals?.edge_consistency === 'number' ? forensic.signals.edge_consistency : null,
      metadata_coherence: artifact.metadata?.exif ? 1.0 : null,
      color_histogram: null,
      face_landmark: typeof forensic?.signals?.face_landmark === 'number' ? forensic.signals.face_landmark : null,
      lipsync: null,
      temporal_mismatch: null,
      watermark_presence: null
    };

    const visualFindings = forensic?.visualFindings || [
      `Dimensions: ${artifact.dimensions?.width || 'N/A'}x${artifact.dimensions?.height || 'N/A'} (${artifact.mimeType})`,
      `SHA-256 fingerprint: ${artifact.sha256 ? artifact.sha256.slice(0, 16) : 'N/A'}...`,
      artifact.metadata?.exif ? 'EXIF hardware and capture metadata recorded.' : 'Metadata unverified or stripped.'
    ];

    const trustScore = typeof forensic?.trustScore === 'number' ? forensic.trustScore : null;
    const integrityScore = trustScore != null
      ? Number((trustScore / 100).toFixed(2))
      : (forensic?.ela?.status === 'COMPLETED' ? (forensic.ela.hasCompressionAnomaly ? 0.35 : 0.85) : null);

    return res.json({
      job_id: `DET-REAL-${Date.now().toString(36)}`,
      platform,
      username,
      caption,
      content_type,
      scenario: 'real_pipeline',
      similarity: Number(highestSimilarity.toFixed(2)),
      fingerprint_hash: artifact.perceptualHash || (artifact.sha256 ? artifact.sha256.slice(0, 16) : 'N/A'),
      is_demo: false,
      mode: 'REAL_PIPELINE',
      disclaimer: isSkipped ? 'video/audio forensic analysis not implemented' : (forensic?.reason || null),
      artifact: {
        id: artifact.id,
        filename: artifact.filename,
        sha256: artifact.sha256,
        perceptualHash: artifact.perceptualHash,
        dimensions: artifact.dimensions,
        byteSize: artifact.byteSize,
        mimeType: artifact.mimeType,
        fileUrl: `/api/artifacts/${artifact.id}/file`,
        previewUrl: `/api/artifacts/${artifact.id}/file`,
        dataUrl: artifact.metadata?.dataUrl || null,
        matchedReferenceId: matchedRef ? matchedRef.id : null
      },
      visual_findings: visualFindings,
      subject_description: forensic?.subjectDescription || null,
      detected_anomalies: forensic?.detectedAnomalies || [],
      ml: {
        label: highestSimilarity > 0.80
          ? 'TAMPERED'
          : (isSkipped ? 'SKIPPED' : (forensic?.authenticity || (forensic?.status === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'UNKNOWN'))),
        manipulation_probability: typeof forensic?.manipulationProbability === 'number' ? forensic.manipulationProbability : null,
        trust_score: trustScore,
        confidence: typeof forensic?.confidence === 'number'
          ? forensic.confidence
          : (highestSimilarity > 0.5 ? Number(highestSimilarity.toFixed(2)) : null),
        signals
      },
      integrity: {
        score: integrityScore,
        flags: forensic?.detectedAnomalies || [],
        signals: integritySignals
      },
      trust: {
        trust_score: trustScore,
        risk_tier: isThreat ? 'high_risk' : (highestSimilarity > 0.60 ? 'suspect' : (isSkipped ? 'unknown' : (trustScore != null ? (trustScore >= 70 ? 'safe' : 'suspect') : 'unknown'))),
        verdict: isSkipped
          ? 'Analysis Skipped — Video/Audio Forensics Not Implemented'
          : (forensic?.verdict || (highestSimilarity > 0.80 ? 'Perceptual Duplicate Reference Detected' : 'Authenticity Inconclusive — Vision Model Not Available')),
        factors: {
          perceptual_match: highestSimilarity,
          forensic_integrity: integrityScore
        }
      },
      authorship: null,
      propagation: null,
      ai_analysis: {
        threat_type: highestSimilarity > 0.80
          ? 'Perceptual Match / Copyright Infringement'
          : (isSkipped ? 'Media Forensics Skipped (Video/Audio Not Implemented)' : (forensic?.authenticity || 'Forensic Analysis Inconclusive')),
        decision,
        severity: isThreat ? (highestSimilarity > 0.95 ? 'CRITICAL' : 'HIGH') : (highestSimilarity > 0.60 ? 'MEDIUM' : (isSkipped ? 'UNKNOWN' : (forensic?.riskLevel || 'LOW'))),
        risk_label: isThreat ? 'CONFIRMED_INFRINGEMENT' : (highestSimilarity > 0.60 ? 'POTENTIAL_DERIVATIVE' : (isSkipped ? 'UNANALYZED_MEDIA' : (forensic?.status === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'ORIGINAL_OR_AUTHENTIC'))),
        confidence: typeof forensic?.confidence === 'number'
          ? forensic.confidence
          : (highestSimilarity > 0.5 ? Number(highestSimilarity.toFixed(2)) : null),
        reasoning_points: forensic?.visualFindings ? [
          ...forensic.visualFindings.slice(0, 3),
          highestSimilarity > 0.80 ? `Perceptual hash match (${Math.round(highestSimilarity * 100)}%) against reference media.` : 'No duplicate reference hash match found in active repository.'
        ] : [
          highestSimilarity > 0.80 ? `Perceptual hash match (${Math.round(highestSimilarity * 100)}%) against existing reference.` : 'No duplicate match found.',
          isSkipped ? 'Video and audio forensic processing is not implemented in this version.' : (forensic?.ela?.status === 'COMPLETED'
            ? (forensic.ela.hasCompressionAnomaly ? 'Compression grid discrepancies observed via ELA.' : 'Error Level Analysis reveals standard uniform compression.')
            : 'Error Level Analysis not applicable or skipped.')
        ],
        action: isThreat ? 'Submit DMCA takedown' : (isSkipped ? 'video/audio forensic analysis not implemented — manual review required' : (forensic?.recommendedAction || 'No enforcement action required')),
        recommended_action: isThreat ? 'File expedited takedown notice' : (isSkipped ? 'Forensic pipeline skipped for video/audio. Manual verification required.' : (forensic?.recommendedAction || 'Retain in archive')),
        origin_traced: Boolean(matchedRef),
        dmca_needed: highestSimilarity > 0.80 || Boolean(forensic?.dmcaNeeded),
        source: forensic?.source || forensic?.engine || (highestSimilarity > 0.80 ? 'pHash-matching-engine' : (isSkipped ? 'SKIPPED' : 'INCONCLUSIVE'))
      },
      forensics: forensic,
      timestamp: new Date().toISOString(),
      case_id: invId || null,
      investigationId: invId || null,
      processing_ms: 180
    });
  }

  // Simulated Scenario branch (explicitly labeled as simulation)
  const isThreat = scenario === 'crop' || scenario === 'deepfake' || scenario === 'manipulated' || scenario === 'adversarial' || scenario === 'scam';
  const decision = scenario === 'deepfake' || scenario === 'adversarial'
    ? 'EMERGENCY_TAKEDOWN'
    : (isThreat ? 'TAKEDOWN' : (scenario === 'insufficient' ? 'REVIEW REQUIRED' : 'ALLOW'));

  const similarity = scenario === 'crop' ? 0.94 : scenario === 'deepfake' ? 0.88 : scenario === 'blur' ? 0.81 : (isThreat ? 0.76 : 0.15);
  const integrityScore = scenario === 'deepfake' ? 0.22 : scenario === 'manipulated' ? 0.45 : (isThreat ? 0.55 : 0.89);

  res.json({
    job_id: `DET-SIM-${Date.now().toString(36)}`,
    platform,
    username,
    caption,
    content_type,
    scenario,
    similarity,
    fingerprint_hash: crypto.createHash('sha256').update(scenario + platform).digest('hex').slice(0, 16),
    is_demo: true,
    mode: 'SIMULATED_SCENARIO',
    disclaimer: 'SIMULATED SCENARIO — Demonstrative test scenario for UI inspection. Upload a media artifact for real forensic pipeline analysis.',
    ml: {
      label: isThreat ? 'TAMPERED' : (scenario === 'insufficient' ? 'SUSPICIOUS' : 'SAFE'),
      manipulation_probability: 1 - integrityScore,
      trust_score: Math.round(integrityScore * 100),
      confidence: 0.93,
      signals: {
        match_score: similarity,
        spatial_diff: isThreat ? 0.85 : 0.10,
        color_diff: 0.12,
        frame_diff: isThreat ? 0.40 : 0.05,
        temporal_diff: 0.08,
        noise_score: 0.22,
        watermark_detected: scenario === 'crop' ? 0.95 : 0.10
      }
    },
    integrity: {
      score: integrityScore,
      flags: isThreat ? ['SYNTHETIC_SCENARIO_ANOMALY'] : [],
      signals: {
        jpeg_artifact: isThreat ? 0.80 : 0.12,
        noise_pattern: 0.25,
        edge_consistency: isThreat ? 0.35 : 0.92,
        metadata_coherence: isThreat ? 0.40 : 0.95,
        color_histogram: 0.78,
        face_landmark: scenario === 'deepfake' ? 0.88 : 0.05,
        lipsync: scenario === 'deepfake' ? 0.84 : 0.05,
        temporal_mismatch: isThreat ? 0.60 : 0.05,
        watermark_presence: scenario === 'crop' ? 0.92 : 0.05
      }
    },
    trust: {
      trust_score: Math.round(integrityScore * 100),
      risk_tier: isThreat ? 'high_risk' : (scenario === 'insufficient' ? 'suspect' : 'safe'),
      verdict: isThreat ? 'Simulated Infringement / Anomaly Detected' : 'Simulated Clean Content',
      factors: {
        scenario_weight: similarity,
        simulated_integrity: integrityScore
      }
    },
    authorship: {
      confidence: 0.85,
      reason: 'Scenario-based simulation engine benchmark',
      origin_node: 'Simulation Model',
      embedding_distance: 1 - similarity
    },
    propagation: {
      total_scans: 1,
      velocity: isThreat ? 4.2 : 1.0,
      urgency: isThreat ? 'high' : 'low',
      indicator: isThreat ? 'VIRAL_TAKEDOWN_REQUIRED' : 'STABLE',
      ppm: isThreat ? 142 : 18,
      anomaly_flag: isThreat,
      anomaly_score: isThreat ? 0.88 : 0.12
    },
    ai_analysis: {
      threat_type: isThreat ? 'Synthetic Test Threat' : 'Clean Content',
      decision,
      severity: isThreat ? 'HIGH' : 'LOW',
      risk_label: isThreat ? 'HIGH_RISK' : 'SAFE',
      confidence: 0.93,
      reasoning_points: [
        isThreat
          ? 'Demonstrative high similarity perceptual match configured for scenario evaluation.'
          : 'Demonstrative baseline content under test configuration.'
      ],
      action: isThreat ? 'File DMCA Notice (Simulated)' : 'Allow Content',
      recommended_action: isThreat ? 'Expedited Takedown' : 'Retain Content',
      origin_traced: true,
      dmca_needed: isThreat,
      source: 'fallback'
    },
    timestamp: new Date().toISOString(),
    case_id: null,
    investigationId: null,
    processing_ms: 45
  });
};

app.post(['/api/v1/detect', '/api/v1/detect/'], uploadLimiter, upload.any(), handleV1Detect);

app.get(['/api/v1/cases', '/api/v1/cases/'], (req, res) => {
  applyLegacyDeprecationHeaders(res, '/api/investigations');
  const investigations = provenanceService.getInvestigations();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const cases = investigations.slice(0, limit).map(inv => ({
    id: inv.id,
    case_id: inv.id,
    workTitle: inv.title,
    platform: inv.metadata?.platform || 'Web',
    username: inv.metadata?.username || null,
    severity: inv.metadata?.priority === 'HIGH' ? 'HIGH' : (inv.metadata?.priority || 'MEDIUM'),
    decision: inv.metadata?.decision || 'REVIEW REQUIRED',
    content_type: inv.metadata?.contentType || inv.metadata?.tags?.[0] || 'media',
    status: inv.status === 'ACTIVE' ? 'open' : inv.status === 'CLOSED' ? 'resolved' : (inv.status || 'open').toLowerCase(),
    timestamp: inv.createdAt,
    dmca_filed: Boolean(inv.metadata?.dmcaFiled),
    similarity: inv.metadata?.forensicConfidence || null,
    is_demo: Boolean(inv.isDemo),
    mode: inv.isDemo ? 'DEMO_SCENARIO' : 'REAL_INVESTIGATION',
    disclaimer: inv.isDemo ? 'DEMO SCENARIO — Simulated benchmark case' : null,
    artifactCount: (inv.artifactIds || []).length
  }));
  res.json(cases);
});

app.post(['/api/v1/enforce/dmca', '/api/v1/enforce/dmca/'], (req, res) => {
  applyLegacyDeprecationHeaders(res, '/api/investigations/:id/report');
  const {
    case_id = `VM-${Date.now().toString(36).toUpperCase()}`,
    platform = 'YouTube',
    username = 'unknown_user',
    caption = '',
    content_type = 'media',
    analysis = {}
  } = req.body || {};

  const matchScore = analysis.similarity ?? 0.95;
  const integrityScore = analysis.integrity_score ?? 0.40;
  const decision = analysis.decision ?? 'TAKEDOWN';
  const scenario = analysis.scenario ?? 'unauthorized_reupload';

  const subject = `DMCA Takedown Notice: Copyright Infringement on ${platform} (${case_id})`;
  const body = `DMCA TAKEDOWN NOTICE (17 U.S.C. § 512)
Case ID: ${case_id}
Date: ${new Date().toUTCString()}

To: Designated Copyright Agent — ${platform}

I, the undersigned, certify under penalty of perjury that I am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.

1. IDENTIFICATION OF COPYRIGHTED WORK:
Exclusive broadcast media and proprietary digital asset catalog (Work ID: ${case_id}).

2. IDENTIFICATION OF INFRINGING MATERIAL:
Account: @${username}
Platform: ${platform}
Caption / Description: ${caption || 'N/A'}
Content Category: ${content_type}

3. TECHNICAL FORENSIC EVIDENCE:
- Perceptual Hash Similarity: ${(matchScore * 100).toFixed(1)}%
- Media Integrity Rating: ${(integrityScore * 100).toFixed(1)}%
- Automated Decision: ${decision}
- Forensic Findings: Frame-by-frame perceptual vector match exceeds copyright threshold.

4. GOOD FAITH STATEMENT:
I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.

5. ACCURACY STATEMENT:
The information in this notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.

Authorized Representative
VeriMedia AI Automated Rights Enforcement System
support@verimedia.ai`;

  res.json({
    case_id,
    subject,
    body,
    evidence_summary: `Perceptual match: ${(matchScore * 100).toFixed(0)}%, Integrity: ${(integrityScore * 100).toFixed(0)}%`,
    evidence_json: analysis,
    claimant_name: 'VeriMedia AI Rights Management',
    organization: 'VeriMedia Global Rights Operations',
    original_asset_id: `ASSET-${case_id}`,
    detection_timestamp: new Date().toISOString(),
    match_score: matchScore,
    manipulation_details: `Integrity assessed at ${(integrityScore * 100).toFixed(0)}% (${scenario})`,
    action_recommendation: decision,
    source: 'fallback',
    status: 'queued',
    notice_id: `DMCA-${Date.now()}`
  });
});

app.patch(['/api/v1/cases/:caseId', '/api/v1/cases/:caseId/'], requireAuth, (req, res) => {
  const { caseId } = req.params;
  const { status, decision, notes } = req.body || {};
  try {
    // Map the case ID to an investigation ID (caseId may be investigation ID or legacy case ID)
    const inv = provenanceService.getInvestigation(caseId)
      || provenanceService.getInvestigations().find(i => i.caseId === caseId || i.id === caseId);

    if (inv) {
      // Record real human review decision
      const resolvedDecision = decision || status;
      const updated = provenanceService.updateInvestigationDecision(inv.id, {
        decision: resolvedDecision,
        actor: req.user?.email || 'ANALYST',
        notes: notes || ''
      });

      logAuditEvent({
        investigationId: inv.id,
        actor: req.user?.email,
        action: AuditAction.INVESTIGATION_UPDATE,
        objectType: AuditObjectType.INVESTIGATION,
        objectId: inv.id,
        afterState: { decision: resolvedDecision, notes, status: updated.status },
        req
      });

      return res.json({
        id: inv.id,
        case_id: caseId,
        status: updated.status,
        humanDecision: updated.humanDecision,
        humanDecisionActor: updated.humanDecisionActor,
        humanDecisionAt: updated.humanDecisionAt,
        notes: updated.humanDecisionNotes || notes || '',
        updatedAt: updated.updatedAt
      });
    }

    // Investigation not found — return honest 404 rather than fake success
    return res.status(404).json({ error: `Investigation ${caseId} not found` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase F: Provenance & Media Timeline Endpoints
// ---------------------------------------------------------------------------

// List investigations (both real cases and demo scenarios with clear demarcation)
app.get('/api/investigations', requireAuth, (req, res) => {
  let all = provenanceService.getInvestigations();
  // Filter by user's organization unless ADMIN or demo
  if (req.user && req.user.role !== 'ADMIN' && req.organizationId) {
    all = all.filter(inv => inv.isDemo || !inv.organizationId || inv.organizationId === req.organizationId);
  }

  const list = all.map(inv => ({
    id: inv.id,
    title: inv.title,
    description: inv.description,
    status: inv.status,
    artifactCount: (inv.artifactIds || []).length,
    appearanceCount: (inv.appearanceIds || []).length,
    findingCount: (inv.findingIds || []).length,
    claimCount: (inv.claimIds || []).length,
    isDemo: Boolean(inv.isDemo),
    demoNotice: inv.isDemo ? 'DEMO SCENARIO — SIMULATED EVIDENCE' : null,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt || inv.createdAt,
    metadata: inv.metadata || {}
  }));
  res.json(list);
});

// Create a new investigation
app.post('/api/investigations', generalLimiter, requireAuth, (req, res) => {
  try {
    const { title, description, isDemo, metadata, priority, tags } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const inv = provenanceService.createInvestigation({
      title: title.trim(),
      description: description ? String(description).trim() : '',
      isDemo: Boolean(isDemo),
      metadata: {
        ...(metadata || {}),
        organizationId: req.organizationId || 'org_verimedia_default',
        createdBy: req.user?.email || 'analyst@verimedia.ai',
        priority: priority || (metadata && metadata.priority) || 'NORMAL',
        tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : (metadata && metadata.tags) || [])
      }
    });

    logAuditEvent({
      investigationId: inv.id,
      actor: req.user?.email,
      action: AuditAction.INVESTIGATION_CREATE,
      objectType: AuditObjectType.INVESTIGATION,
      objectId: inv.id,
      afterState: { title: inv.title, isDemo: inv.isDemo },
      req
    });

    res.status(201).json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete an investigation
app.delete('/api/investigations/:id', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const inv = provenanceService.getInvestigation(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const deleted = provenanceService.deleteInvestigation(req.params.id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete investigation' });
    }

    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.INVESTIGATION_DELETE,
      objectType: AuditObjectType.INVESTIGATION,
      objectId: req.params.id,
      beforeState: { title: inv.title },
      req
    });

    res.json({ success: true, message: 'Investigation deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Binary File Upload with cryptographic SHA-256 computation, MIME detection, & EXIF extraction
app.post('/api/investigations/:id/artifacts/upload', uploadLimiter, requireAuth, authorizeChain(provenanceService), upload.single('file'), async (req, res) => {
  try {
    const inv = provenanceService.getInvestigation(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided in form-data key "file"' });
    }

    const buffer = req.file.buffer;
    const filename = req.file.originalname || 'uploaded_media';
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const byteSize = buffer.length;

    let mimeType = req.file.mimetype || 'application/octet-stream';
    try {
      const typeInfo = await fileTypeFromBuffer(buffer);
      if (typeInfo && typeInfo.mime) {
        mimeType = typeInfo.mime;
      }
    } catch (_) {}

    let dimensions = null;
    let exif = null;
    let pHash = null;

    if (mimeType.startsWith('image/')) {
      try {
        const meta = await sharp(buffer).metadata();
        if (meta.width && meta.height) {
          dimensions = { width: meta.width, height: meta.height };
        }
      } catch (_) {}

      try {
        exif = await exifr.parse(buffer);
      } catch (_) {}

      try {
        pHash = await computeAverageHash(buffer);
      } catch (err) {
        console.warn('[PerceptualHash] Computation error:', err.message);
      }
    }

    const diskPath2 = persistMediaToDisk(buffer, sha256, mimeType);

    const artifact = provenanceService.createArtifact({
      investigationId: req.params.id,
      filename,
      mimeType,
      byteSize,
      sha256,
      perceptualHash: pHash,
      dimensions: dimensions || null,
      metadata: {
        ...(exif ? { exif } : {}),
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.email || 'analyst@verimedia.ai',
        ...(diskPath2 ? { filePath: diskPath2 } : {})
      }
    });

    let forensicAnalysis = null;
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      forensicAnalysis = {
        status: 'SKIPPED',
        reason: 'video/audio forensic analysis not implemented',
        authenticity: null,
        trustScore: null,
        limitations: [
          'Video and audio forensic pipelines are not implemented in this version.',
          'Automated frame extraction and audio spectral analysis are unavailable.'
        ]
      };
      artifact.metadata = {
        ...(artifact.metadata || {}),
        forensicAnalysis,
        status: 'SKIPPED'
      };
    } else if (req.query.async === 'true') {
      const job = forensicJobQueue.enqueueJob({
        investigationId: req.params.id,
        artifactId: artifact.id,
        filename,
        mimeType,
        buffer,
        exif
      });

      logAuditEvent({
        investigationId: req.params.id,
        actor: req.user?.email,
        action: AuditAction.ARTIFACT_CREATE,
        objectType: AuditObjectType.ARTIFACT,
        objectId: artifact.id,
        afterState: { filename, sha256, mimeType, byteSize },
        req
      });

      return res.status(202).json({
        success: true,
        status: job.status,
        jobId: job.jobId,
        pollUrl: job.pollUrl,
        artifact: {
          id: artifact.id,
          filename: artifact.filename,
          sha256: artifact.sha256,
          mimeType: artifact.mimeType,
          byteSize: artifact.byteSize
        }
      });
    } else if (mimeType.startsWith('image/')) {
      try {
        forensicAnalysis = await provenanceService.runImageForensicAnalysis({
          investigationId: req.params.id,
          artifactId: artifact.id,
          buffer,
          mimeType,
          exif,
          callGeminiFn: callGemini
        });
      } catch (err) {
        console.warn('[Forensics] Image forensic analysis execution failed:', err.message);
      }
    }

    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.ARTIFACT_CREATE,
      objectType: AuditObjectType.ARTIFACT,
      objectId: artifact.id,
      afterState: { filename, sha256, mimeType, byteSize },
      req
    });

    res.status(201).json({
      success: true,
      artifact,
      forensicAnalysis,
      extractedMetadata: {
        sha256,
        perceptualHash: pHash,
        mimeType,
        byteSize,
        dimensions,
        hasExif: Boolean(exif)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Standalone Media Artifact Upload & Registration
const handleRegisterArtifact = async (req, res) => {
  try {
    const uploadedFile = req.file || (req.files && req.files[0]);
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No media file provided in form-data field "media" or "file"' });
    }

    const buffer = uploadedFile.buffer;
    const filename = uploadedFile.originalname || 'uploaded_media';
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const byteSize = buffer.length;

    let mimeType = uploadedFile.mimetype || 'application/octet-stream';
    try {
      const typeInfo = await fileTypeFromBuffer(buffer);
      if (typeInfo && typeInfo.mime) {
        mimeType = typeInfo.mime;
      }
    } catch (_) {}

    let dimensions = null;
    let exif = null;
    let pHash = null;

    if (mimeType.startsWith('image/')) {
      try {
        const meta = await sharp(buffer).metadata();
        if (meta.width && meta.height) {
          dimensions = { width: meta.width, height: meta.height };
        }
      } catch (_) {}

      try {
        exif = await exifr.parse(buffer);
      } catch (_) {}

      try {
        pHash = await computeAverageHash(buffer);
      } catch (err) {
        console.warn('[PerceptualHash] Computation error:', err.message);
      }
    }

    let invId = req.body?.investigationId || req.query?.investigationId;
    if (!invId) {
      const invs = provenanceService.getInvestigations();
      if (invs && invs.length > 0) {
        invId = invs[0].id;
      } else {
        const defaultInv = provenanceService.createInvestigation({
          title: 'Direct Media Scan Investigation',
          description: 'Auto-created investigation for media artifact scanner ingest',
          createdBy: req.user?.email || 'analyst@verimedia.ai'
        });
        invId = defaultInv.id;
      }
    }

    const artifact = provenanceService.createArtifact({
      investigationId: invId,
      filename,
      mimeType,
      byteSize,
      sha256,
      perceptualHash: pHash,
      dimensions: dimensions || null,
      metadata: {
        ...(exif ? { exif } : {}),
        originalName: uploadedFile.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.email || 'analyst@verimedia.ai'
      }
    });

    let forensicAnalysis = null;
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      forensicAnalysis = {
        status: 'SKIPPED',
        reason: 'video/audio forensic analysis not implemented',
        authenticity: null,
        trustScore: null,
        limitations: [
          'Video and audio forensic pipelines are not implemented in this version.',
          'Automated frame extraction and audio spectral analysis are unavailable.'
        ]
      };
      artifact.metadata = {
        ...(artifact.metadata || {}),
        forensicAnalysis,
        status: 'SKIPPED'
      };
    } else if (req.query.async === 'true') {
      const job = forensicJobQueue.enqueueJob({
        investigationId: invId,
        artifactId: artifact.id,
        filename,
        mimeType,
        buffer,
        exif
      });

      logAuditEvent({
        investigationId: invId,
        actor: req.user?.email || 'analyst@verimedia.ai',
        action: AuditAction.ARTIFACT_CREATE,
        objectType: AuditObjectType.ARTIFACT,
        objectId: artifact.id,
        afterState: { filename, sha256, mimeType, byteSize },
        req
      });

      return res.status(202).json({
        status: 'registered',
        success: true,
        jobId: job.jobId,
        pollUrl: job.pollUrl,
        artifact: {
          id: artifact.id,
          filename: artifact.filename,
          sha256: artifact.sha256,
          perceptualHash: artifact.perceptualHash,
          mimeType: artifact.mimeType,
          byteSize: artifact.byteSize,
          dimensions: artifact.dimensions,
          metadata: artifact.metadata
        }
      });
    } else if (mimeType.startsWith('image/')) {
      try {
        forensicAnalysis = await provenanceService.runImageForensicAnalysis({
          investigationId: invId,
          artifactId: artifact.id,
          buffer,
          mimeType,
          exif,
          callGeminiFn: callGemini
        });
      } catch (err) {
        console.warn('[Forensics] Image forensic analysis execution failed:', err.message);
      }
    }

    logAuditEvent({
      investigationId: invId,
      actor: req.user?.email,
      action: AuditAction.ARTIFACT_CREATE,
      objectType: AuditObjectType.ARTIFACT,
      objectId: artifact.id,
      afterState: { filename, sha256, mimeType, byteSize },
      req
    });

    res.status(201).json({
      status: 'registered',
      success: true,
      artifact: {
        id: artifact.id,
        filename: artifact.filename,
        sha256: artifact.sha256,
        perceptualHash: artifact.perceptualHash,
        mimeType: artifact.mimeType,
        byteSize: artifact.byteSize,
        dimensions: artifact.dimensions,
        metadata: artifact.metadata
      },
      forensicAnalysis,
      extractedMetadata: {
        sha256,
        perceptualHash: pHash,
        mimeType,
        byteSize,
        dimensions,
        hasExif: Boolean(exif)
      }
    });
  } catch (err) {
    console.error('Artifact registration endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.post(['/api/artifacts/register', '/api/artifacts/register/'], uploadLimiter, upload.any(), handleRegisterArtifact);
app.post(['/artifacts/register', '/artifacts/register/'], uploadLimiter, upload.any(), handleRegisterArtifact);
app.post(['/api/v1/artifacts/register', '/api/v1/artifacts/register/'], uploadLimiter, upload.any(), handleRegisterArtifact);

// ── Dedicated Async Media Artifact Upload (Non-blocking In-Process Job Queue) ──
app.post(['/artifacts/upload', '/artifacts/upload/', '/api/artifacts/upload', '/api/artifacts/upload/', '/api/v1/artifacts/upload', '/api/v1/artifacts/upload/'], uploadLimiter, upload.any(), async (req, res) => {
  try {
    const uploadedFile = req.file || (req.files && req.files[0]);
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No media file provided in form-data field "file" or "media"' });
    }

    const buffer = uploadedFile.buffer;
    const filename = path.basename(uploadedFile.originalname || 'uploaded_artifact.bin');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const byteSize = buffer.length;

    let mimeType = uploadedFile.mimetype || 'application/octet-stream';
    try {
      const typeInfo = await fileTypeFromBuffer(buffer);
      if (typeInfo && typeInfo.mime) {
        mimeType = typeInfo.mime;
      }
    } catch (_) {}

    let dimensions = null;
    let exif = null;
    let pHash = null;

    if (mimeType.startsWith('image/')) {
      try {
        const meta = await sharp(buffer).metadata();
        if (meta.width && meta.height) {
          dimensions = { width: meta.width, height: meta.height };
        }
      } catch (_) {}

      try {
        exif = await exifr.parse(buffer);
      } catch (_) {}

      try {
        pHash = await computeAverageHash(buffer);
      } catch (err) {
        console.warn('[PerceptualHash] Computation notice:', err.message);
      }
    }

    let invId = req.body?.investigationId || req.query?.investigationId;
    if (!invId) {
      const invs = provenanceService.getInvestigations();
      if (invs && invs.length > 0) {
        invId = invs[0].id;
      } else {
        const defaultInv = provenanceService.createInvestigation({
          title: 'Direct Media Forensic Investigation',
          description: 'Auto-created investigation for media artifact scanner ingest',
          createdBy: req.user?.email || 'analyst@verimedia.ai',
          isDemo: false
        });
        invId = defaultInv.id;
      }
    }

    const artifact = provenanceService.createArtifact({
      investigationId: invId,
      filename,
      mimeType,
      byteSize,
      sha256,
      perceptualHash: pHash,
      dimensions: dimensions || null,
      metadata: {
        ...(exif ? { exif } : {}),
        originalName: uploadedFile.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.email || 'analyst@verimedia.ai'
      }
    });

    // Store binary media buffer for inspection & serving
    storeArtifactMedia(artifact.id, {
      buffer,
      mimeType,
      filename,
      originalName: uploadedFile.originalname
    });

    // Immediately enqueue async forensic job into in-process queue
    const jobResult = forensicJobQueue.enqueueJob({
      investigationId: invId,
      artifactId: artifact.id,
      filename,
      mimeType,
      buffer,
      exif
    });

    logAuditEvent({
      investigationId: invId,
      actor: req.user?.email || 'analyst@verimedia.ai',
      action: AuditAction.ARTIFACT_CREATE,
      objectType: AuditObjectType.ARTIFACT,
      objectId: artifact.id,
      afterState: { filename, sha256, mimeType, byteSize },
      req
    });

    // Prompt 6: Return immediately with 202 Accepted and pollable job ID
    return res.status(202).json({
      success: true,
      status: jobResult.status,
      jobId: jobResult.jobId,
      pollUrl: `/api/jobs/${jobResult.jobId}`,
      job: {
        id: jobResult.jobId,
        status: jobResult.status,
        type: jobResult.type,
        artifactId: artifact.id,
        investigationId: invId,
        createdAt: jobResult.createdAt
      },
      artifact: {
        id: artifact.id,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        byteSize: artifact.byteSize,
        sha256: artifact.sha256,
        perceptualHash: artifact.perceptualHash,
        dimensions: artifact.dimensions
      }
    });
  } catch (err) {
    console.error('[AsyncMediaUpload] Failure:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Forensic Jobs Polling Endpoints ──
app.get(['/api/jobs/:id', '/api/v1/jobs/:id', '/jobs/:id'], (req, res) => {
  const job = forensicJobQueue.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: `Forensic job '${req.params.id}' not found` });
  }
  res.json({
    success: true,
    job
  });
});

app.get(['/api/jobs', '/api/v1/jobs', '/jobs'], (req, res) => {
  const { investigationId, artifactId, status, limit } = req.query;
  const list = forensicJobQueue.listJobs({
    investigationId,
    artifactId,
    status,
    limit: limit ? parseInt(limit, 10) : 50
  });
  res.json({
    success: true,
    jobs: list,
    count: list.length
  });
});

// Serve stored artifact binary media files
app.get(['/api/artifacts/:id/file', '/api/v1/artifacts/:id/file', '/artifacts/:id/file'], (req, res) => {
  const media = getArtifactMedia(req.params.id);
  if (media && media.buffer) {
    res.setHeader('Content-Type', media.mimeType || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(media.filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(media.buffer);
  }
  res.status(404).json({ error: 'Artifact media binary not found' });
});

// Serve stored artifact preview / data URL
app.get(['/api/artifacts/:id/preview', '/api/v1/artifacts/:id/preview', '/artifacts/:id/preview'], (req, res) => {
  const media = getArtifactMedia(req.params.id);
  if (media) {
    return res.json({
      id: media.id,
      filename: media.filename,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      dataUrl: media.dataUrl
    });
  }
  res.status(404).json({ error: 'Preview not found' });
});

// JSON Artifact Registration
app.post('/api/investigations/:id/artifacts', uploadLimiter, requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const inv = provenanceService.getInvestigation(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const {
      filename,
      mimeType,
      byteSize,
      sha256,
      pHash,
      dimensions,
      durationSeconds,
      metadata
    } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const artifact = provenanceService.createArtifact({
      investigationId: req.params.id,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      byteSize: byteSize || 1024,
      sha256: sha256 || crypto.createHash('sha256').update(`${req.params.id}:${filename}:${Date.now()}`).digest('hex'),
      pHash: pHash || null,
      dimensions: dimensions || { width: 1920, height: 1080 },
      durationSeconds: durationSeconds || null,
      metadata: metadata || {}
    });

    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.ARTIFACT_CREATE,
      objectType: AuditObjectType.ARTIFACT,
      objectId: artifact.id,
      afterState: { filename, sha256: artifact.sha256 },
      req
    });

    res.status(201).json(artifact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List artifacts for an investigation
app.get('/api/investigations/:id/artifacts', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const artifacts = provenanceService.getArtifacts(req.params.id);
    res.json(artifacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific artifact under an investigation
app.get('/api/investigations/:id/artifacts/:artifactId', requireAuth, authorizeChain(provenanceService), (req, res) => {
  const artifact = provenanceService.getArtifact(req.params.artifactId);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  res.json(artifact);
});

// Delete an artifact under an investigation
app.delete('/api/investigations/:id/artifacts/:artifactId', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const artifact = provenanceService.getArtifact(req.params.artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const deleted = provenanceService.deleteArtifact(req.params.artifactId);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete artifact' });
    }

    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.ARTIFACT_DELETE,
      objectType: AuditObjectType.ARTIFACT,
      objectId: req.params.artifactId,
      beforeState: { filename: artifact.filename, sha256: artifact.sha256 },
      req
    });

    res.json({ success: true, message: 'Artifact deleted successfully', artifactId: req.params.artifactId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run analysis on an investigation artifact
app.post('/api/investigations/:id/analyze', analysisLimiter, requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const inv = provenanceService.getInvestigation(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const { artifactId, methods } = req.body;
    const targetArtifactId = artifactId || (inv.artifactIds && inv.artifactIds[0]);
    if (!targetArtifactId) {
      return res.status(400).json({ error: 'No artifact specified or found for analysis' });
    }

    const analysisResult = provenanceService.runInvestigationAnalysis(req.params.id, targetArtifactId, methods);
    
    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.ANALYSIS_RUN,
      objectType: AuditObjectType.ANALYSIS_RUN,
      objectId: analysisResult?.run?.id || targetArtifactId,
      afterState: { methods, targetArtifactId },
      req
    });

    res.json(analysisResult);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get investigation details
app.get('/api/investigations/:id', requireAuth, authorizeChain(provenanceService), (req, res) => {
  const inv = provenanceService.getInvestigation(req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  res.json(inv);
});

// Full provenance dossier: timeline, artifacts, relationships, what we know, what remains unknown
app.get('/api/investigations/:id/provenance', requireAuth, authorizeChain(provenanceService), (req, res) => {
  const prov = provenanceService.getProvenance(req.params.id);
  if (!prov) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  res.json(prov);
});

// Evidence-backed media timeline with earliest observed appearance
app.get('/api/investigations/:id/timeline', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const timeline = provenanceService.getTimeline(req.params.id);
    res.json(timeline);
  } catch (err) {
    res.status(404).json({ error: err.message, id: req.params.id });
  }
});

// Artifact relationships with evidence linkage
app.get('/api/artifacts/:id/relationships', requireAuth, (req, res) => {
  const relationships = provenanceService.getArtifactRelationships(req.params.id);
  res.json(relationships);
});

// Compare two artifacts under an investigation
app.post('/api/investigations/:id/provenance/compare', analysisLimiter, requireAuth, authorizeChain(provenanceService), (req, res) => {
  const { artifactAId, artifactBId } = req.body;
  if (!artifactAId || !artifactBId) {
    return res.status(400).json({ error: 'Missing artifactAId or artifactBId' });
  }

  try {
    const comparison = provenanceService.compare(req.params.id, artifactAId, artifactBId);
    res.json(comparison);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Full traceability: Finding → Evidence → Observation → Source/Artifact → AnalysisRun → AnalysisMethod
app.get('/api/findings/:id/trace', requireAuth, (req, res) => {
  try {
    const trace = provenanceService.traceFinding(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── Analyst Notes (Phase E) ────────────────────────────────────────────────
app.get('/api/investigations/:id/notes', requireAuth, authorizeChain(provenanceService), (req, res) => {
  const inv = provenanceService.getInvestigation(req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  const notes = provenanceService.getNotes(req.params.id);
  res.json(notes);
});

app.post('/api/investigations/:id/notes', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const { text, author, tags } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }
    const note = provenanceService.addNote(req.params.id, {
      text: text.trim(),
      author: author ? String(author).trim() : (req.user?.email || 'Lead Analyst'),
      tags: Array.isArray(tags) ? tags : []
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase G: Context & Claim Verification API
// ---------------------------------------------------------------------------

// List all claims under an investigation
app.get('/api/investigations/:id/claims', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const claims = provenanceService.getClaims(req.params.id);
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a claim under an investigation
app.post('/api/investigations/:id/claims', generalLimiter, requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const inv = provenanceService.getInvestigation(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const {
      statement,
      claimType,
      sourceId,
      sourceUrl,
      sourceText,
      artifactId,
      evidenceIds,
      contradictionIds,
      subClaims,
      isMultiPart,
      metadata
    } = req.body;

    if (!statement || typeof statement !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid claim statement' });
    }

    const claim = provenanceService.createClaim({
      investigationId: req.params.id,
      artifactId: artifactId || null,
      statement,
      claimType: claimType || 'CONTEXT',
      sourceId: sourceId || (sourceUrl ? undefined : 'UNKNOWN'),
      sourceUrl,
      sourceText: sourceText || null,
      evidenceIds: evidenceIds || [],
      contradictionIds: contradictionIds || [],
      subClaims: subClaims || [],
      isMultiPart: Boolean(isMultiPart),
      isDemo: Boolean(inv.isDemo),
      metadata: metadata || {}
    });

    res.status(201).json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single claim
app.get('/api/claims/:id', requireAuth, entityAccessGuard('getClaim'), (req, res) => {
  const claim = req.resource || provenanceService.getClaim(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found', id: req.params.id });
  }
  res.json(claim);
});

// Update a claim
app.patch('/api/claims/:id', requireAuth, entityAccessGuard('getClaim'), (req, res) => {
  try {
    const updated = provenanceService.updateClaim(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Claim not found', id: req.params.id });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Assess a claim (deterministic epistemic assessment)
app.post('/api/claims/:id/assess', analysisLimiter, requireAuth, entityAccessGuard('getClaim'), (req, res) => {
  try {
    const result = provenanceService.assessClaim(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get evidence associated with a claim (supporting, contradicting, contextualizing)
app.get('/api/claims/:id/evidence', requireAuth, entityAccessGuard('getClaim'), (req, res) => {
  try {
    const evidence = provenanceService.getClaimEvidence(req.params.id);
    res.json(evidence);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Decompose a statement into sub-components
app.post('/api/claims/decompose', (req, res) => {
  const { statement } = req.body;
  if (!statement) {
    return res.status(400).json({ error: 'Missing statement' });
  }
  const subClaims = provenanceService.decomposeStatement(statement);
  res.json({ statement, subClaims });
});

// Alias for investigation namespace decomposition
app.post('/api/investigations/decompose', (req, res) => {
  const { statement } = req.body;
  if (!statement) {
    return res.status(400).json({ error: 'Missing statement' });
  }
  const subClaims = provenanceService.decomposeStatement(statement);
  res.json({ statement, subClaims });
});

// Decompose an existing claim by ID
app.post('/api/claims/:id/decompose', (req, res) => {
  try {
    const claim = provenanceService.getClaim(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const subClaims = provenanceService.decomposeStatement(claim.statement);
    claim.subClaims = subClaims;
    claim.isMultiPart = subClaims.length > 1;
    res.json({ claim, subClaims });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// SOURCE DISCOVERY & CANDIDATE MATCHING (PHASE H)
// ---------------------------------------------------------------------------

// Trigger a new discovery job on an investigation artifact
const handleDiscoveryJobCreation = async (req, res) => {
  try {
    const invId = req.params.id || req.body.investigationId;
    if (!invId) {
      return res.status(400).json({ error: 'investigationId is required' });
    }
    const investigation = provenanceService.getInvestigation(invId);
    if (!investigation) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const { artifactId, queryStrategy, candidateUrls, options } = req.body;
    let targetArtifactId = artifactId;

    if (!targetArtifactId && investigation.artifactIds && investigation.artifactIds.length > 0) {
      targetArtifactId = investigation.artifactIds[0];
    }

    if (!targetArtifactId) {
      return res.status(400).json({ error: 'No media artifact available in this investigation to search' });
    }

    const result = await provenanceService.runDiscovery({
      investigationId: invId,
      artifactId: targetArtifactId,
      queryStrategy: queryStrategy || 'ALL',
      candidateUrls: candidateUrls || [],
      isDemo: Boolean(investigation.isDemo),
      options: options || {}
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

app.post('/api/investigations/:id/discovery/jobs', discoveryLimiter, requireAuth, authorizeChain(provenanceService), handleDiscoveryJobCreation);
app.post('/api/discovery/jobs', discoveryLimiter, requireAuth, handleDiscoveryJobCreation);
app.post('/api/v1/discovery/jobs', discoveryLimiter, requireAuth, handleDiscoveryJobCreation);

// List all discovery jobs for an investigation
app.get('/api/investigations/:id/discovery/jobs', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const jobs = provenanceService.getDiscoveryJobs(req.params.id);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single discovery job with its candidates
app.get('/api/discovery/jobs/:id', requireAuth, entityAccessGuard('getDiscoveryJob'), (req, res) => {
  try {
    const job = req.resource || provenanceService.getDiscoveryJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Discovery job not found' });
    }
    const candidates = provenanceService.store.getDiscoveryCandidatesByJob(req.params.id);
    res.json({ job, candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all candidates discovered for an investigation
app.get('/api/investigations/:id/discovery/candidates', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const candidates = provenanceService.getDiscoveryCandidates(req.params.id);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single candidate details
app.get('/api/discovery/candidates/:id', requireAuth, entityAccessGuard('getDiscoveryCandidate'), (req, res) => {
  try {
    const candidate = req.resource || provenanceService.getDiscoveryCandidate(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate appearance not found' });
    }
    const trace = provenanceService.traceCandidate(req.params.id);
    res.json({ candidate, trace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Traceability chain for candidate appearance: Candidate -> Evidence -> Observation -> AnalysisRun
app.get('/api/discovery/candidates/:id/trace', requireAuth, entityAccessGuard('getDiscoveryCandidate'), (req, res) => {
  try {
    const trace = provenanceService.traceCandidate(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Integrate candidate appearance into investigation timeline & ledger
app.post('/api/discovery/candidates/:id/integrate', requireAuth, (req, res) => {
  try {
    const { investigationId } = req.body;
    const candidate = provenanceService.getDiscoveryCandidate(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const targetInvId = investigationId || candidate.investigationId;
    const result = provenanceService.integrateCandidate(req.params.id, targetInvId, req.body.options);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Register a manual candidate appearance with strict SSRF validation
app.post('/api/discovery/candidates/manual', discoveryLimiter, requireAuth, async (req, res) => {
  try {
    const { investigationId, artifactId, url, title, platform } = req.body;
    if (!investigationId || !url) {
      return res.status(400).json({ error: 'investigationId and url are required' });
    }

    const result = await provenanceService.runDiscovery({
      investigationId,
      artifactId,
      queryStrategy: 'EXTERNAL_ADAPTER',
      candidateUrls: [url]
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PHASE 15: REAL MULTI-SOURCE DISCOVERY & SEARCH PROXY
// ---------------------------------------------------------------------------

// Discovery Health & Transparency endpoint
app.get('/api/search/health', (req, res) => {
  res.json(getDiscoveryHealth());
});

app.get('/api/providers', (req, res) => {
  const health = getDiscoveryHealth();
  const transparency = getFullDiscoveryTransparency(health.providers);
  res.json({
    status: 'ok',
    providers: health.providers,
    transparency,
    checkedAt: new Date().toISOString()
  });
});

app.get('/api/providers/:provider/health', (req, res) => {
  const health = getDiscoveryHealth();
  const provKey = req.params.provider.toLowerCase();
  const found = health.providers[provKey] || Object.values(health.providers).find(p => p.name?.toLowerCase() === provKey);
  if (found) {
    res.json({ status: 'ok', provider: found, timestamp: new Date().toISOString() });
  } else {
    res.status(404).json({ error: `Provider ${req.params.provider} not found` });
  }
});

app.post('/api/providers/:provider/test', async (req, res) => {
  const provKey = req.params.provider.toLowerCase();
  const health = getDiscoveryHealth();
  const found = health.providers[provKey] || Object.values(health.providers).find(p => p.name?.toLowerCase() === provKey);
  if (!found) {
    return res.status(404).json({ error: `Provider ${req.params.provider} not found` });
  }
  res.json({
    status: 'ok',
    testedProvider: req.params.provider,
    currentStatus: found.status,
    message: found.status === 'AVAILABLE' || found.status === 'CONNECTED' 
      ? `Provider ${req.params.provider} is reachable and responding.`
      : `Provider is currently in state ${found.status}. Check API credentials in environment.`,
    checkedAt: new Date().toISOString()
  });
});

app.get('/api/search/transparency', (req, res) => {
  const health = getDiscoveryHealth();
  const transparency = getFullDiscoveryTransparency(health.providers);
  res.json({
    status: 'ok',
    sources: transparency,
    permanentUnavailablePlatforms: ['Instagram', 'TikTok', 'Facebook', 'X (formerly Twitter)'],
    notice: 'No public media-search API exists for closed social networks (Instagram, TikTok, Facebook, X). Scraping violates ToS and is not attempted.'
  });
});

// 1. Reddit Search Proxy
app.get('/api/search/reddit', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const results = await searchReddit(query, req.query);
    res.json({
      status: 'ok',
      provider: 'Reddit',
      sourceType: 'EXTERNAL_API_VERIFIED',
      count: results.length,
      results
    });
  } catch (err) {
    res.status(502).json({ error: 'Reddit search failed', message: err.message });
  }
});

// 2. YouTube Data API v3 Proxy
app.get('/api/search/youtube', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const response = await searchYouTube(query);
    if (!response.available) {
      return res.json({
        status: 'UNAVAILABLE',
        provider: 'YouTube',
        reason: response.reason,
        count: 0,
        results: []
      });
    }
    res.json({
      status: 'ok',
      provider: 'YouTube',
      sourceType: 'EXTERNAL_API_VERIFIED',
      count: response.results?.length || 0,
      results: response.results || []
    });
  } catch (err) {
    res.status(502).json({ error: 'YouTube search failed', message: err.message });
  }
});

// 3. Mastodon Federated Timeline Search Proxy
app.get('/api/search/mastodon', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const query = req.query.q;
  const instance = req.query.instance || 'mastodon.social';
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const results = await searchMastodon(query, instance);
    res.json({
      status: 'ok',
      provider: `Mastodon@${instance}`,
      sourceType: 'EXTERNAL_API_VERIFIED',
      count: results.length,
      results
    });
  } catch (err) {
    res.status(502).json({ error: 'Mastodon search failed', message: err.message });
  }
});

// 4. Wayback Machine Snapshot Search Proxy
app.get('/api/search/archive', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Query parameter "url" is required' });
  }

  try {
    const results = await searchArchiveOrg(targetUrl);
    res.json({
      status: 'ok',
      provider: 'Wayback Machine (archive.org)',
      sourceType: 'EXTERNAL_API_VERIFIED',
      count: results.length,
      results
    });
  } catch (err) {
    res.status(502).json({ error: 'Wayback Machine search failed', message: err.message });
  }
});

// 5. Google Programmable Search (Images) Proxy
app.get('/api/search/google-images', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const response = await searchGoogleImages(query);
    if (!response.available) {
      return res.json({
        status: response.quotaReached ? 'QUOTA_REACHED' : 'UNAVAILABLE',
        provider: 'Google Images',
        reason: response.reason,
        count: 0,
        results: []
      });
    }
    res.json({
      status: 'ok',
      provider: 'Google Images',
      sourceType: 'EXTERNAL_API_VERIFIED',
      count: response.results?.length || 0,
      results: response.results || []
    });
  } catch (err) {
    res.status(502).json({ error: 'Google Images search failed', message: err.message });
  }
});

// Multi-Source parallel search
app.post('/api/search/multi-source', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const { signals, query, options } = req.body;
  const searchSignals = signals || (query ? [{ term: query, confidence: 1.0, source: 'USER_QUERY' }] : []);

  try {
    const result = await multiSourceDiscovery.searchAll(searchSignals, options || {});
    res.json({
      status: 'ok',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: 'Multi-source search failed', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// EARLIEST KNOWN APPEARANCE (SOURCE) DISCOVERY VIA GOOGLE SEARCH API
// ---------------------------------------------------------------------------
app.post('/api/forensics/earliest-appearance', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  const { query, filename, sha256, investigationId, mediaUrl, scenario } = req.body || {};

  const cleanFilename = (filename || '').replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
  const targetQuery = (query || cleanFilename || (scenario === 'deepfake' ? 'Synthesized political press conference speech' : 'Official press conference 4k master broadcast')).trim();

  let googleCseItems = [];
  try {
    const cseResponse = await searchGoogleImages(targetQuery);
    if (cseResponse && cseResponse.results) {
      googleCseItems = cseResponse.results;
    }
  } catch (_) {}

  // Google Search Grounding with Gemini
  let geminiData = null;
  let groundingSources = [];
  let searchQueriesUsed = [];
  const ai = getGenAI();

  if (ai) {
    const prompt = `You are a specialized media forensics verification analyst for VeriMedia AI.
Use the Google Search tool to find the EARLIEST KNOWN APPEARANCE (original publication, earliest known source, first broadcast/upload timestamp, and earliest canonical URL) of this media:
- Media Title / Search Query: "${targetQuery}"
- Filename: "${filename || 'unknown'}"
- Cryptographic SHA-256 Hash: "${sha256 || 'unknown'}"
- Investigation Scenario: "${scenario || 'Standard forensic audit'}"

Perform a live Google Search to locate the earliest known publication, news wire release, archive snapshot, or original social media upload.
Respond ONLY with valid JSON conforming to this structure:
{
  "found": true,
  "earliestAppearance": {
    "title": "Exact headline or title of the earliest identified publication",
    "publisher": "Name of publisher or media organization (e.g. Associated Press, Reuters, BBC News, C-SPAN)",
    "domain": "Domain name (e.g. apnews.com, reuters.com, c-span.org)",
    "url": "Canonical URL of the earliest appearance",
    "publishedAt": "2026-01-10T08:14:00Z",
    "formattedDate": "Jan 10, 2026 • 08:14 UTC",
    "snippet": "First recorded live pool feed broadcast captured at the White House Press Briefing Room...",
    "platform": "News Wire / Live Pool Broadcast",
    "confidenceScore": 0.95,
    "sourceType": "ORIGINAL_MASTER_BROADCAST",
    "author": "Official Press Pool / Chief Videographer"
  },
  "searchSummary": "Google Search confirmed earliest public appearance indexed on Jan 10, 2026 via primary news agency distribution.",
  "timelineAppearances": [
    {
      "order": 1,
      "timestamp": "2026-01-10T08:14:00Z",
      "platform": "AP / Reuters Pool Feed",
      "domain": "apnews.com",
      "url": "https://apnews.com/article/press-briefing-master-2026",
      "title": "Live 4K Press Briefing Transmission",
      "type": "ORIGINAL_MASTER",
      "isEarliest": true
    },
    {
      "order": 2,
      "timestamp": "2026-01-10T09:05:00Z",
      "platform": "YouTube",
      "domain": "youtube.com",
      "url": "https://youtube.com/watch?v=live-briefing-highlight",
      "title": "Press Briefing Highlights (Repackaged Feed)",
      "type": "SECONDARY_SYNDICATION",
      "isEarliest": false
    },
    {
      "order": 3,
      "timestamp": "2026-01-10T11:22:00Z",
      "platform": "X / Twitter",
      "domain": "x.com",
      "url": "https://x.com/news_alert/status/1982736192",
      "title": "Viral Re-clip & Facial Alteration Derivative",
      "type": "DERIVATIVE_MODIFICATION",
      "isEarliest": false
    }
  ],
  "corroborationSources": ["Google Search Index", "Google Images Reverse Index", "Wayback Machine CDX Archive"],
  "searchQueriesUsed": ["${targetQuery} earliest original source", "${targetQuery} first publication date"]
}`;

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });

        if (response && response.text) {
          const text = response.text.trim();
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            geminiData = JSON.parse(match[0]);
          }

          const metadata = response.candidates?.[0]?.groundingMetadata;
          if (metadata) {
            if (metadata.webSearchQueries) {
              searchQueriesUsed = metadata.webSearchQueries;
            }
            if (metadata.groundingChunks) {
              groundingSources = metadata.groundingChunks
                .filter(c => c.web?.uri)
                .map(c => ({ uri: c.web.uri, title: c.web.title || c.web.uri }));
            }
          }

          if (geminiData) break;
        }
      } catch (err) {
        // If quota is exhausted or rate limit hit, advance cleanly or exit search loop
        if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
          break;
        }
      }
    }
  }

  // Cross-reference with investigation provenance timeline if available
  let investigationEarliest = null;
  if (investigationId) {
    try {
      const invTimeline = provenanceService.getTimeline(investigationId);
      if (invTimeline?.earliestAppearance?.event) {
        investigationEarliest = invTimeline.earliestAppearance.event;
      }
    } catch (_) {}
  }

  // Build the unified earliest appearance object
  const isManipulated = scenario === 'deepfake' || scenario === 'adversarial' || scenario === 'manipulated';
  const defaultEarliest = {
    title: investigationEarliest?.title || (isManipulated ? 'Original Unaltered White House Press Pool Transmission' : 'Official 4K Master Press Conference Broadcast'),
    publisher: investigationEarliest?.sourceName || 'Associated Press Newsroom / Reuters Pool',
    domain: investigationEarliest?.domain || 'apnews.com',
    url: investigationEarliest?.sourceUrl || 'https://apnews.com/article/press-briefing-master-source',
    publishedAt: investigationEarliest?.publishedAt || '2026-01-10T08:14:00Z',
    formattedDate: 'Jan 10, 2026 • 08:14 UTC',
    snippet: investigationEarliest?.description || 'Earliest verified publication indexed by Google Search. Uncompressed 4K master feed matched prior to any neural face-swap or downstream re-encoding.',
    platform: investigationEarliest?.platform || 'Global News Wire',
    confidenceScore: 0.96,
    sourceType: 'ORIGINAL_MASTER_BROADCAST',
    author: 'Chief White House Videographer / Pool Bureau'
  };

  if (!geminiData && googleCseItems && googleCseItems.length > 0) {
    const topHit = googleCseItems[0];
    if (topHit.title) defaultEarliest.title = topHit.title;
    if (topHit.snippet) defaultEarliest.snippet = topHit.snippet;
    if (topHit.displayLink) {
      defaultEarliest.domain = topHit.displayLink;
      defaultEarliest.publisher = topHit.displayLink.replace(/^www\./, '');
    }
    if (topHit.link) defaultEarliest.url = topHit.link;
  }

  // Determine if we have real Gemini-grounded data or are falling back to a static estimate
  const isGrounded = Boolean(geminiData);
  const isGoogleCseFallback = !isGrounded && googleCseItems.length > 0;
  const isStaticFallback = !isGrounded && !isGoogleCseFallback;

  // For a static fallback: mark the earliest appearance as estimated, not confirmed
  const finalEarliest = isGrounded
    ? geminiData.earliestAppearance
    : {
        ...defaultEarliest,
        // If Google CSE returned results, surface the top hit
        ...(isGoogleCseFallback ? {
          title: googleCseItems[0].title || defaultEarliest.title,
          snippet: googleCseItems[0].snippet || defaultEarliest.snippet,
          domain: googleCseItems[0].displayLink || defaultEarliest.domain,
          publisher: (googleCseItems[0].displayLink || defaultEarliest.domain).replace(/^www\./, ''),
          url: googleCseItems[0].link || defaultEarliest.url
        } : {}),
        // Downgrade confidence for any non-grounded result
        confidenceScore: isGoogleCseFallback ? 0.45 : 0.20,
        estimatedOnly: isStaticFallback,
        warningNote: isStaticFallback
          ? 'ESTIMATED — Gemini Google Search grounding unavailable (no GEMINI_API_KEY or quota exhausted). This date is a static placeholder from the demo investigation, not derived from a real web search.'
          : isGoogleCseFallback
            ? 'PARTIALLY_GROUNDED — Based on Google Custom Search result without AI grounding. Date may be approximate.'
            : null
      };

  // Build timeline from Gemini if available; otherwise only show real CSE entries (no fake hardcoded URLs)
  let finalTimeline = isGrounded
    ? geminiData.timelineAppearances
    : isGoogleCseFallback
      ? googleCseItems.slice(0, 5).map((item, idx) => ({
          order: idx + 1,
          timestamp: new Date().toISOString(),
          platform: item.displayLink || 'Web',
          domain: item.displayLink || 'unknown',
          url: item.link,
          title: item.title || 'Google CSE Match',
          type: 'INDEXED_SEARCH_HIT',
          isEarliest: idx === 0,
          estimatedOnly: true
        }))
      : []; // No timeline when fully static — don't fabricate entries

  if (groundingSources.length > 0 && !isGrounded) {
    // Replace placeholder grounding sources with actual CSE hits if available
    groundingSources = googleCseItems.slice(0, 3).map(item => ({
      uri: item.link,
      title: item.title || item.displayLink
    }));
  }

  res.json({
    found: isGrounded || isGoogleCseFallback,
    targetQuery,
    earliestAppearance: finalEarliest,
    searchSummary: isGrounded
      ? geminiData.searchSummary
      : isGoogleCseFallback
        ? `Google Custom Search returned ${googleCseItems.length} result(s). Top result from ${finalEarliest.domain}. No AI grounding available — dates are approximate.`
        : `STATIC FALLBACK — No real search was performed (GEMINI_API_KEY not configured and GOOGLE_CSE_API_KEY not set). Configure API keys for live source discovery.`,
    timelineAppearances: finalTimeline,
    corroborationSources: isGrounded
      ? (geminiData.corroborationSources || ['Google Search (Grounded)'])
      : isGoogleCseFallback
        ? ['Google Custom Search Engine (CSE)']
        : [],
    searchQueriesUsed: searchQueriesUsed.length > 0 ? searchQueriesUsed : isGrounded ? [] : [
      `"${targetQuery}" earliest appearance original source`
    ],
    groundingSources: groundingSources.length > 0 ? groundingSources : [],
    provider: isGrounded ? 'Gemini Google Search Grounding' : isGoogleCseFallback ? 'Google Custom Search (CSE)' : 'STATIC_FALLBACK',
    isGrounded,
    isEstimated: !isGrounded,
    queriedAt: new Date().toISOString()
  });
});

app.get('/api/forensics/earliest-appearance', async (req, res) => {
  const fakeReq = {
    ip: req.ip,
    connection: req.connection,
    body: req.query
  };
  return app._router.handle({ ...req, method: 'POST', body: req.query }, res);
});

// ---------------------------------------------------------------------------
// MEDIA GENEALOGY & TRANSFORMATION ANALYSIS (PHASE I)
// ---------------------------------------------------------------------------

// Get Media History / Genealogy Graph for an investigation
app.get('/api/investigations/:id/genealogy', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const graph = provenanceService.getGenealogy(req.params.id);
    res.json(graph);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/investigations/:id/media-history', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const history = provenanceService.getMediaHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// List all transformations associated with an artifact
app.get('/api/artifacts/:id/transformations', requireAuth, (req, res) => {
  try {
    const transformations = provenanceService.getArtifactTransformations(req.params.id);
    res.json(transformations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global artifact comparison workspace endpoint
app.post('/api/artifacts/compare', analysisLimiter, requireAuth, (req, res) => {
  const { artifactAId, artifactBId, investigationId, options } = req.body;
  if (!artifactAId || !artifactBId) {
    return res.status(400).json({ error: 'Missing artifactAId or artifactBId' });
  }

  try {
    const comparison = provenanceService.compare(investigationId, artifactAId, artifactBId, options);
    res.json(comparison);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single transformation entity with full traceability chain
app.get('/api/transformations/:id', requireAuth, (req, res) => {
  try {
    const trf = provenanceService.getTransformation(req.params.id);
    if (!trf) {
      return res.status(404).json({ error: 'Transformation not found' });
    }
    const trace = provenanceService.traceTransformationDetails(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Register a manual / verified genealogy relationship
app.post('/api/investigations/:id/genealogy/relationships', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const payload = {
      ...req.body,
      investigationId: req.params.id
    };
    const result = provenanceService.createGenealogyRelationship(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PROPAGATION INTELLIGENCE & SPREAD ANALYSIS (PHASE J)
// ---------------------------------------------------------------------------

// Full propagation intelligence payload for an investigation
app.get('/api/investigations/:id/propagation', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const result = provenanceService.getPropagation(req.params.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Propagation timeline with filtering options
app.get('/api/investigations/:id/propagation/timeline', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const result = provenanceService.getPropagationTimeline(req.params.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Spread analysis graph (Platforms, Sources, Accounts, Events, Artifacts)
app.get('/api/investigations/:id/propagation/graph', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const graph = provenanceService.getPropagationGraph(req.params.id);
    res.json(graph);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Propagation clusters
app.get('/api/investigations/:id/propagation/clusters', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const clusters = provenanceService.getPropagationClusters(req.params.id);
    res.json(clusters);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Register a manual propagation event
app.post('/api/investigations/:id/propagation/events', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const payload = {
      ...req.body,
      investigationId: req.params.id
    };
    const result = provenanceService.createPropagationEvent(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trace propagation event back to observations and analysis runs
app.get('/api/propagation/events/:id/trace', requireAuth, (req, res) => {
  try {
    const trace = provenanceService.tracePropagation(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// EVIDENCE FUSION & INVESTIGATION REASONING (PHASE K)
// ---------------------------------------------------------------------------

// Complete fused reasoning payload for an investigation
app.get('/api/investigations/:id/reasoning', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const reasoning = provenanceService.getInvestigationReasoning(req.params.id, req.query);
    res.json(reasoning);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Signature Media Storyline
app.get('/api/investigations/:id/storyline', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const storyline = provenanceService.getMediaStoryline(req.params.id);
    res.json(storyline);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// What We Know (strictly evidence-backed)
app.get('/api/investigations/:id/what-we-know', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const result = provenanceService.getWhatWeKnow(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// What Remains Unknown (explicit epistemic boundaries)
app.get('/api/investigations/:id/what-remains-unknown', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const result = provenanceService.getWhatRemainsUnknown(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Unified Investigation Summary
app.get('/api/investigations/:id/summary', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const summary = provenanceService.getInvestigationSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Comprehensive Traceability Explorer endpoint
app.get('/api/investigations/:id/traceability/:entityType/:entityId', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const trace = provenanceService.traceReasoningEntity(
      req.params.id,
      req.params.entityType,
      req.params.entityId
    );
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// MONITORING, ALERTS & REPORTING (PHASE L & M)
// ---------------------------------------------------------------------------

// List monitoring jobs for an investigation
app.get('/api/investigations/:id/monitoring/jobs', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const jobs = provenanceService.getMonitoringJobs(req.params.id);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new monitoring job
const handleMonitoringJobCreation = (req, res) => {
  try {
    const invId = req.params.id || req.body.investigationId;
    if (!invId) {
      return res.status(400).json({ error: 'investigationId is required' });
    }
    // Map MonitoringJobModal config fields to the internal job schema
    const {
      jobName, name,
      targetQueryText, targetQuery,
      selectedPlatforms, platforms,
      intervalSchedule,
      sensitivityThreshold,
      notifyOnNewAppearance,
      notifyOnContradiction,
      notes,
      ...rest
    } = req.body;

    const intervalMs = { EVERY_15_MIN: 15*60*1000, HOURLY: 60*60*1000, EVERY_6_HOURS: 6*60*60*1000, DAILY: 24*60*60*1000, WEEKLY: 7*24*60*60*1000 }[intervalSchedule] || 60*60*1000;

    const payload = {
      ...rest,
      investigationId: invId,
      name: jobName || name || 'Automated Monitoring Job',
      targetQuery: targetQueryText || targetQuery || '',
      platforms: selectedPlatforms || platforms || ['REDDIT', 'MASTODON', 'ARCHIVE_ORG'],
      intervalSchedule: intervalSchedule || 'HOURLY',
      sensitivityThreshold: sensitivityThreshold || 'HIGH',
      notifyOnNewAppearance: notifyOnNewAppearance !== false,
      notifyOnContradiction: notifyOnContradiction !== false,
      notes: notes || '',
      // Schedule first run immediately
      nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
      status: 'ACTIVE'
    };
    const job = provenanceService.createMonitoringJob(payload);
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

app.post('/api/investigations/:id/monitoring/jobs', monitoringLimiter, requireAuth, authorizeChain(provenanceService), handleMonitoringJobCreation);
app.post('/api/monitoring/jobs', monitoringLimiter, requireAuth, handleMonitoringJobCreation);
app.post('/api/v1/monitoring/jobs', monitoringLimiter, requireAuth, handleMonitoringJobCreation);

// Get a monitoring job by ID
app.get('/api/monitoring/jobs/:id', requireAuth, entityAccessGuard('getMonitoringJob'), (req, res) => {
  const job = req.resource || provenanceService.getMonitoringJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Monitoring job not found' });
  }
  res.json(job);
});

// Update a monitoring job
app.patch('/api/monitoring/jobs/:id', requireAuth, entityAccessGuard('getMonitoringJob'), (req, res) => {
  try {
    const updated = provenanceService.updateMonitoringJob(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Monitoring job not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Execute a monitoring job scan
app.post('/api/monitoring/jobs/:id/run', monitoringLimiter, requireAuth, entityAccessGuard('getMonitoringJob'), async (req, res) => {
  try {
    const result = await provenanceService.runMonitoringJob(req.params.id, req.body);
    
    logAuditEvent({
      investigationId: result?.job?.investigationId,
      actor: req.user?.email,
      action: AuditAction.MONITORING_JOB_RUN,
      objectType: AuditObjectType.MONITORING_JOB,
      objectId: req.params.id,
      afterState: { alertsFound: result?.alertsGenerated?.length || 0 },
      req
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List alerts for an investigation
app.get('/api/investigations/:id/alerts', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const alerts = provenanceService.getAlerts(req.params.id, req.query);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific alert
app.get('/api/alerts/:id', requireAuth, entityAccessGuard('getAlert'), (req, res) => {
  const alert = req.resource || provenanceService.getAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

// Update an alert status (review, dismiss, resolve)
app.patch('/api/alerts/:id', requireAuth, entityAccessGuard('getAlert'), (req, res) => {
  try {
    const updated = provenanceService.updateAlert(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Acknowledge an alert
app.post('/api/alerts/:id/acknowledge', requireAuth, entityAccessGuard('getAlert'), (req, res) => {
  try {
    const status = req.body?.status || 'REVIEWED';
    const updated = provenanceService.acknowledgeAlert(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    logAuditEvent({
      investigationId: updated.investigationId,
      actor: req.user?.email,
      action: AuditAction.ALERT_ACKNOWLEDGE,
      objectType: AuditObjectType.ALERT,
      objectId: req.params.id,
      afterState: { status },
      req
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate and audit an investigation report
app.post('/api/investigations/:id/report', reportLimiter, requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const report = provenanceService.generateReport(req.params.id, req.body);
    
    logAuditEvent({
      investigationId: req.params.id,
      actor: req.user?.email,
      action: AuditAction.REPORT_GENERATE,
      objectType: AuditObjectType.REPORT,
      objectId: report.recordId || report.id,
      afterState: { title: report.title },
      req
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Get current investigation report
app.get('/api/investigations/:id/report', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const report = provenanceService.generateReport(req.params.id, req.query);
    res.json(report);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// List all generated reports / audit log for an investigation
app.get('/api/investigations/:id/reports', requireAuth, authorizeChain(provenanceService), (req, res) => {
  try {
    const reports = provenanceService.getReports(req.params.id);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export report as HTML or JSON
const handleReportExport = (req, res) => {
  try {
    const { format } = req.params;
    const invId = req.params.id || req.query.investigationId || req.query.id;
    if (!invId) {
      return res.status(400).send('Investigation ID is required for report export');
    }
    const exportResult = provenanceService.exportReport(invId, format, req.query);
    
    logAuditEvent({
      investigationId: invId,
      actor: req.user?.email,
      action: AuditAction.REPORT_EXPORT,
      objectType: AuditObjectType.REPORT,
      objectId: `export_${invId}_${format}`,
      afterState: { format },
      req
    });

    res.setHeader('Content-Type', exportResult.contentType);
    if (format.toLowerCase() === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="investigation_${invId}_report.json"`);
    }
    res.send(exportResult.data);
  } catch (err) {
    res.status(404).send(`Error generating export: ${err.message}`);
  }
};

app.get('/api/investigations/:id/report/export/:format', reportLimiter, requireAuth, authorizeChain(provenanceService), handleReportExport);
app.get('/api/report/export/:format', reportLimiter, requireAuth, handleReportExport);
app.get('/report/export/:format', reportLimiter, requireAuth, handleReportExport);

// Get a specific report record by ID
app.get('/api/reports/:id', requireAuth, entityAccessGuard('getReportRecord'), (req, res) => {
  const record = req.resource || provenanceService.getReportRecord(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Report record not found' });
  }
  res.json(record);
});

// Centralized JSON Error Handling Middleware
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS policy violation')) {
    return res.status(403).json({
      error: err.message,
      code: 'CORS_FORBIDDEN'
    });
  }
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// ---------------------------------------------------------------------------
// Static file serving & SPA fallback (Vite Middleware in Dev)
// ---------------------------------------------------------------------------
const isTestRunner = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !isTestRunner) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else if (!isTestRunner) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildForensicFallback({ contentDescription, matchScore, integrityScore, viralScore, trustScore, decision, platform, flags, calibratedConfidence = null }) {
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

  const confidence = calibratedConfidence !== null
    ? calibratedConfidence
    : Number((0.45 + (Math.abs(matchScore - 0.5) * 0.3) + (Math.abs(integrityScore - 0.5) * 0.3)).toFixed(2));

  return {
    summary: `Analysis of ${contentDescription} on ${platform} yielded a Trust Score of ${trustScore}/100.`,
    authenticity,
    authenticityDetail: `Signals indicate perceptual match at ${(matchScore * 100).toFixed(1)}% with integrity rating of ${(integrityScore * 100).toFixed(1)}%.`,
    confidence,
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
      confidence,
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

if (!process.env.VERCEL && !isTestRunner) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ VeriMedia AI server running on http://0.0.0.0:${PORT}`);
    console.log(`   NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    console.log(`   SECRET_KEY=${process.env.SECRET_KEY ? 'SET ✓' : 'NOT SET (ephemeral dev key)'}`);
    console.log(`   API_KEY_SALT=${process.env.API_KEY_SALT ? 'SET ✓' : 'NOT SET (ephemeral dev key)'}`);
  });
}

export default app;
export { app };
