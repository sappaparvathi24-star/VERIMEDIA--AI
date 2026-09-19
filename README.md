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

---

## 📜 License

MIT License.
