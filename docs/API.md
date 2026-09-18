# VeriMedia AI — Comprehensive API Documentation

VeriMedia AI provides a full-stack REST API for media authenticity verification, perceptual hashing, deepfake forensics, claim decomposition, multi-source provenance discovery, lineage reconstruction, continuous monitoring, and Gemini-powered evidentiary reasoning.

---

## 1. System Health & Metadata

### `GET /health`, `GET /api/health`, `GET /api/v1/health`
Returns operational health status, connected AI models, and Gemini API readiness.

**Response:**
```json
{
  "status": "ok",
  "service": "VeriMedia AI Unified Backend",
  "gemini": "connected",
  "models": ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"],
  "timestamp": "2026-09-18T14:55:00.000Z"
}
```

---

## 2. Gemini Conversational Assistant & Forensic AI

### `POST /chat`, `POST /api/chat`, `POST /api/v1/chat`
Conversational forensic intelligence agent powered by Google Gemini with graceful offline fallback.

**Request Body:**
```json
{
  "prompt": "Explain the difference between EXIF alteration and double JPEG compression artifacts.",
  "messages": [
    { "role": "user", "content": "How do you detect AI-generated audio?" }
  ],
  "system_prompt": "You are a senior digital forensics investigator.",
  "max_tokens": 1024
}
```

**Response:**
```json
{
  "reply": "AI-generated audio typically exhibits phase incoherence...",
  "content": [{ "type": "text", "text": "..." }],
  "text": "...",
  "source": "gemini-3.1-flash-lite"
}
```

### `POST /analyze`, `POST /api/analyze`
Generates forensic deepfake analysis, tampering classification, perceptual score fusion, and risk mitigation advice.

**Request Body:**
```json
{
  "contentDescription": "High-profile stadium press conference video clip",
  "matchScore": 0.92,
  "integrityScore": 0.45,
  "viralScore": 0.88,
  "decision": "TAKEDOWN",
  "platform": "TikTok",
  "contentType": "politics",
  "flags": ["FACIAL_WARPING", "VOICE_CLONING"]
}
```

### `POST /dmca-reasoning`, `POST /dmca/generate`, `POST /api/v1/enforce/dmca`
Generates legally structured DMCA takedown notices and forensic rights declarations.

---

## 3. Core Detection & Case Feeds

### `POST /api/v1/detect/`
Performs multi-modal perceptual hashing, visual artifact inspection, and real-time classification.

### `GET /api/v1/cases/`
Retrieves paginated forensic detection cases and surveillance alert feeds.

---

## 4. Investigation Lifecycle & Workspace

### `GET /api/investigations`
Lists all active, archived, or draft investigations.

### `POST /api/investigations`
Creates a new forensic investigation dossier.

### `POST /api/investigations/:id/artifacts`
Registers a media artifact (video, image, audio, or document) with cryptographic SHA-256 hash calculation, perceptual fingerprinting (pHash, dHash, aHash), and metadata extraction.

### `POST /api/investigations/:id/analyze`
Executes forensic inspection passes (visual artifact analysis, noise variance, compression history, metadata consistency).

### `GET /api/investigations/:id/provenance`
Returns consolidated provenance ledger, observation runs, and evidentiary traces.

### `GET /api/investigations/:id/timeline`
Retrieves chronologically sorted timestamped appearance and distribution events.

---

## 5. Claims Decomposition & Epistemic Verification

### `GET /api/investigations/:id/claims`
Lists extracted claims associated with the investigated media.

### `POST /api/investigations/:id/claims`
Registers an explicit factual or contextual claim.

### `POST /api/claims/:id/assess`
Evaluates claim veracity against evidentiary findings (`SUPPORTED`, `CONTRADICTED`, `INCONCLUSIVE`, `UNVERIFIABLE`).

### `POST /api/claims/:id/decompose`, `POST /api/claims/decompose`
Uses Gemini intelligence to decompose complex media captions into discrete, verifiable sub-claims.

---

## 6. Multi-Source Discovery & Open-Web Surveillance

### `POST /api/investigations/:id/discovery/jobs`
Initiates a candidate discovery job across open-source web and social platforms.

### `GET /api/investigations/:id/discovery/candidates`
Returns matched candidate media artifacts with similarity metrics and source citations.

### `GET /api/search/transparency`
Provides full audit status of all supported discovery providers (Reddit, YouTube, Mastodon, Wayback Machine, Google Lens, and API-restricted networks).

### `POST /api/search/multi-source`
Executes simultaneous federated search across multiple open web indexes.

---

## 7. Media Lineage & Propagation Graph

### `GET /api/investigations/:id/genealogy`
Returns the media family tree and transformation history (crops, recompressions, watermarks, format conversions).

### `GET /api/investigations/:id/propagation`
Returns cross-platform dissemination timeline, velocity metrics, and domain clusters.

---

## 8. Evidentiary Reasoning & Media Storylines

### `GET /api/investigations/:id/reasoning`
Fuses all forensic observations, metadata, and candidate lineages into unified probabilistic reasoning.

### `GET /api/investigations/:id/storyline`
Generates a structured, chronological narrative:
1. Earliest Observed Appearance
2. Production & Encoding Traces
3. Transformation & Derivative History
4. Distribution & Viral Propagation
5. Associated Contextual Claims
6. Veracity & Contradiction Analysis
7. Epistemic Assessment & Unknowns

### `GET /api/investigations/:id/what-we-know`
Returns established facts with backing evidentiary citations.

### `GET /api/investigations/:id/what-remains-unknown`
Declares epistemic limitations, unverified physical origins, and missing chain-of-custody links.

---

## 9. Surveillance Monitoring & Alerts

### `POST /api/investigations/:id/monitoring/jobs`
Schedules automated surveillance routines across social platforms.

### `GET /api/investigations/:id/alerts`
Returns new appearance alerts, contradiction warnings, and viral surge notifications.

### `POST /api/alerts/:id/acknowledge`
Acknowledges and triages a generated alert.

---

## 10. Dossier Reporting & Export

### `POST /api/investigations/:id/report`
Compiles an immutable evidentiary investigation report with cryptographic snapshot hash.

### `GET /api/investigations/:id/report/export/html`
Exports a high-resolution, printable forensic HTML dossier.

### `GET /api/investigations/:id/report/export/json`
Exports machine-readable structured investigation data.
