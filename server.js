import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { provenanceService } from './src/provenance/service.js';
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

dotenv.config();

const multiSourceDiscovery = new MultiSourceDiscoveryManager();

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

app.post('/chat', handleChat);
app.post('/api/chat', handleChat);
app.post('/api/v1/chat', handleChat);

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
};

app.post('/analyze', handleAnalyze);
app.post('/api/analyze', handleAnalyze);
app.post('/api/v1/analyze', handleAnalyze);

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
// Phase F: Provenance & Media Timeline Endpoints
// ---------------------------------------------------------------------------

// List investigations (both real cases and demo scenarios with clear demarcation)
app.get('/api/investigations', (req, res) => {
  const list = provenanceService.getInvestigations().map(inv => ({
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
app.post('/api/investigations', (req, res) => {
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
        priority: priority || (metadata && metadata.priority) || 'NORMAL',
        tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : (metadata && metadata.tags) || [])
      }
    });
    res.status(201).json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload / Ingest an artifact to an investigation
app.post('/api/investigations/:id/artifacts', (req, res) => {
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
      sha256: sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      pHash: pHash || '0000000000000000',
      dimensions: dimensions || { width: 1920, height: 1080 },
      durationSeconds: durationSeconds || null,
      metadata: metadata || {}
    });

    res.status(201).json(artifact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Run analysis on an investigation artifact
app.post('/api/investigations/:id/analyze', (req, res) => {
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
    res.json(analysisResult);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get investigation details
app.get('/api/investigations/:id', (req, res) => {
  const inv = provenanceService.getInvestigation(req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  res.json(inv);
});

// Full provenance dossier: timeline, artifacts, relationships, what we know, what remains unknown
app.get('/api/investigations/:id/provenance', (req, res) => {
  const prov = provenanceService.getProvenance(req.params.id);
  if (!prov) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  res.json(prov);
});

// Evidence-backed media timeline with earliest observed appearance
app.get('/api/investigations/:id/timeline', (req, res) => {
  try {
    const timeline = provenanceService.getTimeline(req.params.id);
    res.json(timeline);
  } catch (err) {
    res.status(404).json({ error: err.message, id: req.params.id });
  }
});

// Artifact relationships with evidence linkage
app.get('/api/artifacts/:id/relationships', (req, res) => {
  const relationships = provenanceService.getArtifactRelationships(req.params.id);
  res.json(relationships);
});

// Compare two artifacts under an investigation
app.post('/api/investigations/:id/provenance/compare', (req, res) => {
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
app.get('/api/findings/:id/trace', (req, res) => {
  try {
    const trace = provenanceService.traceFinding(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── Analyst Notes (Phase E) ────────────────────────────────────────────────
app.get('/api/investigations/:id/notes', (req, res) => {
  const inv = provenanceService.getInvestigation(req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found', id: req.params.id });
  }
  const notes = provenanceService.getNotes(req.params.id);
  res.json(notes);
});

app.post('/api/investigations/:id/notes', (req, res) => {
  try {
    const { text, author, tags } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }
    const note = provenanceService.addNote(req.params.id, {
      text: text.trim(),
      author: author ? String(author).trim() : 'Lead Analyst',
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
app.get('/api/investigations/:id/claims', (req, res) => {
  try {
    const claims = provenanceService.getClaims(req.params.id);
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a claim under an investigation
app.post('/api/investigations/:id/claims', (req, res) => {
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
      artifactId: artifactId || targetArtifactId || null,
      statement,
      claimType: claimType || 'CONTEXT',
      sourceId: sourceId || (sourceUrl ? undefined : 'UNKNOWN'),
      sourceUrl,
      sourceText: sourceText || sourceAttribution || null,
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
app.get('/api/claims/:id', (req, res) => {
  const claim = provenanceService.getClaim(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found', id: req.params.id });
  }
  res.json(claim);
});

// Update a claim
app.patch('/api/claims/:id', (req, res) => {
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
app.post('/api/claims/:id/assess', (req, res) => {
  try {
    const result = provenanceService.assessClaim(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get evidence associated with a claim (supporting, contradicting, contextualizing)
app.get('/api/claims/:id/evidence', (req, res) => {
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
app.post('/api/investigations/:id/discovery/jobs', async (req, res) => {
  try {
    const investigation = provenanceService.getInvestigation(req.params.id);
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
      investigationId: req.params.id,
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
});

// List all discovery jobs for an investigation
app.get('/api/investigations/:id/discovery/jobs', (req, res) => {
  try {
    const jobs = provenanceService.getDiscoveryJobs(req.params.id);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single discovery job with its candidates
app.get('/api/discovery/jobs/:id', (req, res) => {
  try {
    const job = provenanceService.getDiscoveryJob(req.params.id);
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
app.get('/api/investigations/:id/discovery/candidates', (req, res) => {
  try {
    const candidates = provenanceService.getDiscoveryCandidates(req.params.id);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single candidate details
app.get('/api/discovery/candidates/:id', (req, res) => {
  try {
    const candidate = provenanceService.getDiscoveryCandidate(req.params.id);
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
app.get('/api/discovery/candidates/:id/trace', (req, res) => {
  try {
    const trace = provenanceService.traceCandidate(req.params.id);
    res.json(trace);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Integrate candidate appearance into investigation timeline & ledger
app.post('/api/discovery/candidates/:id/integrate', (req, res) => {
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
app.post('/api/discovery/candidates/manual', async (req, res) => {
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
// MEDIA GENEALOGY & TRANSFORMATION ANALYSIS (PHASE I)
// ---------------------------------------------------------------------------

// Get Media History / Genealogy Graph for an investigation
app.get('/api/investigations/:id/genealogy', (req, res) => {
  try {
    const graph = provenanceService.getGenealogy(req.params.id);
    res.json(graph);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/investigations/:id/media-history', (req, res) => {
  try {
    const history = provenanceService.getMediaHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// List all transformations associated with an artifact
app.get('/api/artifacts/:id/transformations', (req, res) => {
  try {
    const transformations = provenanceService.getArtifactTransformations(req.params.id);
    res.json(transformations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global artifact comparison workspace endpoint
app.post('/api/artifacts/compare', (req, res) => {
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
app.get('/api/transformations/:id', (req, res) => {
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
app.post('/api/investigations/:id/genealogy/relationships', (req, res) => {
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
app.get('/api/investigations/:id/propagation', (req, res) => {
  try {
    const result = provenanceService.getPropagation(req.params.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Propagation timeline with filtering options
app.get('/api/investigations/:id/propagation/timeline', (req, res) => {
  try {
    const result = provenanceService.getPropagationTimeline(req.params.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Spread analysis graph (Platforms, Sources, Accounts, Events, Artifacts)
app.get('/api/investigations/:id/propagation/graph', (req, res) => {
  try {
    const graph = provenanceService.getPropagationGraph(req.params.id);
    res.json(graph);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Propagation clusters
app.get('/api/investigations/:id/propagation/clusters', (req, res) => {
  try {
    const clusters = provenanceService.getPropagationClusters(req.params.id);
    res.json(clusters);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Register a manual propagation event
app.post('/api/investigations/:id/propagation/events', (req, res) => {
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
app.get('/api/propagation/events/:id/trace', (req, res) => {
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
app.get('/api/investigations/:id/reasoning', (req, res) => {
  try {
    const reasoning = provenanceService.getInvestigationReasoning(req.params.id, req.query);
    res.json(reasoning);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Signature Media Storyline
app.get('/api/investigations/:id/storyline', (req, res) => {
  try {
    const storyline = provenanceService.getMediaStoryline(req.params.id);
    res.json(storyline);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// What We Know (strictly evidence-backed)
app.get('/api/investigations/:id/what-we-know', (req, res) => {
  try {
    const result = provenanceService.getWhatWeKnow(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// What Remains Unknown (explicit epistemic boundaries)
app.get('/api/investigations/:id/what-remains-unknown', (req, res) => {
  try {
    const result = provenanceService.getWhatRemainsUnknown(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Unified Investigation Summary
app.get('/api/investigations/:id/summary', (req, res) => {
  try {
    const summary = provenanceService.getInvestigationSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Comprehensive Traceability Explorer endpoint
app.get('/api/investigations/:id/traceability/:entityType/:entityId', (req, res) => {
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
app.get('/api/investigations/:id/monitoring/jobs', (req, res) => {
  try {
    const jobs = provenanceService.getMonitoringJobs(req.params.id);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new monitoring job
app.post('/api/investigations/:id/monitoring/jobs', (req, res) => {
  try {
    const payload = {
      ...req.body,
      investigationId: req.params.id
    };
    const job = provenanceService.createMonitoringJob(payload);
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a monitoring job by ID
app.get('/api/monitoring/jobs/:id', (req, res) => {
  const job = provenanceService.getMonitoringJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Monitoring job not found' });
  }
  res.json(job);
});

// Update a monitoring job
app.patch('/api/monitoring/jobs/:id', (req, res) => {
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
app.post('/api/monitoring/jobs/:id/run', async (req, res) => {
  try {
    const result = await provenanceService.runMonitoringJob(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List alerts for an investigation
app.get('/api/investigations/:id/alerts', (req, res) => {
  try {
    const alerts = provenanceService.getAlerts(req.params.id, req.query);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific alert
app.get('/api/alerts/:id', (req, res) => {
  const alert = provenanceService.getAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

// Update an alert status (review, dismiss, resolve)
app.patch('/api/alerts/:id', (req, res) => {
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
app.post('/api/alerts/:id/acknowledge', (req, res) => {
  try {
    const status = req.body?.status || 'REVIEWED';
    const updated = provenanceService.acknowledgeAlert(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate and audit an investigation report
app.post('/api/investigations/:id/report', (req, res) => {
  try {
    const report = provenanceService.generateReport(req.params.id, req.body);
    res.status(201).json(report);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Get current investigation report
app.get('/api/investigations/:id/report', (req, res) => {
  try {
    const report = provenanceService.generateReport(req.params.id, req.query);
    res.json(report);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// List all generated reports / audit log for an investigation
app.get('/api/investigations/:id/reports', (req, res) => {
  try {
    const reports = provenanceService.getReports(req.params.id);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export report as HTML or JSON
app.get('/api/investigations/:id/report/export/:format', (req, res) => {
  try {
    const { format } = req.params;
    const exportResult = provenanceService.exportReport(req.params.id, format, req.query);
    res.setHeader('Content-Type', exportResult.contentType);
    if (format.toLowerCase() === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="investigation_${req.params.id}_report.json"`);
    }
    res.send(exportResult.data);
  } catch (err) {
    res.status(404).send(`Error generating export: ${err.message}`);
  }
});

// Get a specific report record by ID
app.get('/api/reports/:id', (req, res) => {
  const record = provenanceService.getReportRecord(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Report record not found' });
  }
  res.json(record);
});

// ---------------------------------------------------------------------------
// Static file serving & SPA fallback
// ---------------------------------------------------------------------------
const frontendDir = path.join(__dirname, 'frontend');
app.use(express.static(__dirname));
app.use(express.static(frontendDir));

// Fallback to index.html for SPA / client-side routing
app.get('*', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  res.sendFile(rootIndex);
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

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ VeriMedia AI server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
export { app };
