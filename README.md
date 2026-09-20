# 🛡️ VeriMedia AI — Provenance & Media Investigation Engine

> **Comprehensive Media Investigation & Provenance Engine** — Evidence-backed provenance timelines, forensic chain of custody, epistemic state tracking, multi-source candidate discovery, independence-aware claim verification, and automated dossier exports.

---

## 🏆 Core Capabilities

VeriMedia AI is a full-stack media investigation platform designed for rigorous forensic verification, provenance tracking, and content authentication without false certainty claims.

- 🔍 **Real Binary Media Intake & Hashing** — Calculates cryptographic SHA-256 hashes directly over uploaded file bytes (`multer`), with MIME auto-detection (`file-type`), dimension extraction (`sharp`), and EXIF metadata parsing (`exifr`).
- 🔗 **Provenance Timelines & Genealogy** — Constructs evidence-backed media timelines showing earliest observed appearances, parent-child transformations (crop, re-encode, resize, trim), and media version genealogy.
- 🧪 **Epistemic Certainty Discipline** — Enforces strict separation between findings, observations, and evidence. Never fabricates origin claims or uses prohibited certainty language.
- 🌐 **Multi-Source Discovery** — Multi-provider search adapter querying Reddit, YouTube, Mastodon, Archive.org, and Google Custom Search Engine with full provider status transparency.
- 🛡️ **SSRF & Security Hardening** — Built-in blocklist preventing Server-Side Request Forgery against loopback, RFC1918, and cloud metadata addresses.
- 🗄️ **Durable Persistence** — Embedded SQLite database (`better-sqlite3`) maintaining durable records for investigations, artifacts, findings, claims, monitoring jobs, and reports.
- 📄 **Auditable Dossier Export** — Generates complete HTML/JSON forensic dossier reports with XSS escaping and immutable evidence snapshot hashes.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                  VeriMedia AI Unified Application                       │
│                                                                        │
│  Frontend (React 19 + TypeScript + Vite)                                │
│  · 7-Tab Media Investigation Workspace                                  │
│  · Real File Upload & SHA-256 Hashing Inspector                         │
│  · Interactive Propagation & Genealogy Graph                            │
│  · Evidence Fusion & Dossier Exporter                                   │
│                                                                        │
│  Backend (Node.js + Express + Gemini AI)                                │
│  · /api/investigations — Investigation & Dossier Engine                │
│  · /api/investigations/:id/artifacts/upload — Multer File Processing   │
│  · MultiSourceDiscoveryManager — Reddit, YouTube, Mastodon, CSE       │
│  · SQLite Database — Durable WAL Storage (data/verimedia.sqlite)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Getting Started

### Installation
```bash
npm install
```

### Environment Configuration

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Required | Where used | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | Optional | Server-side AI analysis | Without it, Gemini paths use rule-based fallback |
| `SUPABASE_URL` | Optional | Backend DB sync | Without it, uses SQLite only |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Backend admin ops | Preferred over anon key on server |
| `SUPABASE_ANON_KEY` | Optional | Backend fallback | Used if SERVICE_ROLE_KEY not set |
| `YOUTUBE_API_KEY` | Optional | YouTube discovery | 10,000 free units/day |
| `GOOGLE_CSE_API_KEY` | Optional | Google image search | Canonical name (legacy: `GOOGLE_SEARCH_API_KEY`) |
| `GOOGLE_CSE_CX` | Optional | Google image search | Canonical name (legacy: `GOOGLE_SEARCH_ENGINE_ID`) |
| `SECRET_KEY` | **Required prod** | JWT signing | Must be set in production |
| `API_KEY_SALT` | **Required prod** | API key hashing | Must be set in production |
| `ADMIN_BOOTSTRAP_PASSWORD` | Optional | First-run admin | Random generated if unset |
| `CORS_ORIGINS` | Optional | CORS allowlist | `*` for dev; set Vercel URL for prod |
| `MAX_UPLOAD_MB` | Optional | Upload limit | Default: 100 |
| `DISCOVERY_TIMEOUT_MS` | Optional | Search timeout | Default: 15000 |
| `VITE_API_BASE_URL` | Optional | Frontend→backend | Set to Render URL for Vercel deploys |
| `VITE_SUPABASE_URL` | Optional | Frontend auth | Public value — safe for browser |
| `VITE_SUPABASE_ANON_KEY` | Optional | Frontend auth | Public anon key — safe for browser |

> **Security:** `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `SECRET_KEY`, `API_KEY_SALT`, `META_APP_SECRET`, `X_API_SECRET`, `X_ACCESS_SECRET`, `REDDIT_CLIENT_SECRET` are **server-side only** and must never be prefixed with `VITE_` or committed to git.

### Running in Development
```bash
npm run dev
```

### Running Test Suite
```bash
npm test
```

### Running Linter / Typecheck
```bash
npm run lint
```

### Production Build
```bash
npm run build
npm start
```

### Integration Status

Check which integrations are configured by calling the health endpoint:

```bash
curl https://your-backend.onrender.com/api/integration-status
```

Response example:
```json
{
  "gemini": "configured",
  "supabase": "configured",
  "youtube": "configured",
  "googleSearch": "configured",
  "reddit": "configured",
  "instagram": "not_implemented",
  "x": "not_implemented",
  "tiktok": "not_implemented",
  "facebook": "not_implemented"
}
```

Status meanings:
- `configured` — env vars present; implementation exists and will run
- `not_configured` — env vars missing; implementation exists but cannot run
- `not_implemented` — no public API available regardless of credentials

---

## 📜 License

MIT License.
