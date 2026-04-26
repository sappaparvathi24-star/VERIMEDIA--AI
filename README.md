# 🛡️ VeriMedia AI

> **AI-powered media intelligence platform** — Real-time unauthorized content detection, deepfake analysis, manipulation forensics, and automated DMCA enforcement across social platforms.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-brightgreen.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docker.com)

---

## 🏆 Hackathon Submission

**Problem**: Content creators and rights holders lose billions annually to unauthorized media reuse, deepfakes, and IP violations across social platforms. Manual detection is too slow; existing tools miss AI-generated manipulations.

**Solution**: VeriMedia AI is a full-stack platform that combines:
- **Perceptual fingerprinting** — identify original assets even after heavy manipulation
- **6-signal ML pipeline** — detect spatial, temporal, noise, color, face, and lipsync anomalies
- **Claude AI reasoning** — evidence-backed enforcement decisions with legal citations
- **Automated DMCA engine** — generate and file takedown notices in seconds
- **Viral propagation tracking** — catch content before it spreads

---

## 🎬 Demo

```
http://localhost:5173
```

Try scenarios: **Normal Share** → **Deepfake** → **Crop Attack** → **News Attribution** → **Adversarial Noise**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VeriMedia AI v23                             │
├─────────────────┬───────────────────────────┬───────────────────────┤
│   Frontend      │        Backend (FastAPI)   │     Infrastructure    │
│                 │                            │                       │
│  React 18 + TS  │  ┌─ Detection Service     │  PostgreSQL + pgvector│
│  Vite 5         │  │   · Perceptual hash     │  Redis (queue/cache)  │
│  Zustand        │  │   · Embedding search    │  MinIO (S3 assets)    │
│  TailwindCSS    │  ├─ ML Pipeline           │  Nginx (reverse proxy)│
│  Canvas API     │  │   · 6-signal classifier │  Docker Compose       │
│  WebSocket      │  │   · Trust scoring       │                       │
│                 │  ├─ Claude AI Service     │                       │
│                 │  │   · Threat analysis     │                       │
│                 │  │   · DMCA generation     │                       │
│                 │  ├─ Enforcement Engine    │                       │
│                 │  │   · Case management     │                       │
│                 │  └─ Viral Intelligence    │                       │
└─────────────────┴───────────────────────────┴───────────────────────┘
```

---

## ⚡ Quick Start (3 commands)

```bash
git clone https://github.com/your-org/verimedia.git && cd verimedia
cp .env.example .env           # Add your ANTHROPIC_API_KEY
docker compose up --build -d   # Starts everything
```

**Open:** http://localhost (frontend) · http://localhost:8000/docs (API docs)

---

## 📁 Repository Structure

```
verimedia/
├── 📂 backend/                   Python FastAPI backend
│   ├── app/
│   │   ├── api/                  REST API route handlers
│   │   │   ├── detection.py      POST /detect — full pipeline
│   │   │   ├── verification.py   POST /verify — ownership & integrity
│   │   │   ├── enforcement.py    POST /enforce/dmca — DMCA notices
│   │   │   ├── cases.py          GET/PATCH /cases — case management
│   │   │   └── health.py         GET /health
│   │   ├── services/             Business logic
│   │   │   ├── fingerprint.py    Perceptual hash + similarity
│   │   │   ├── ml_pipeline.py    6-signal ML classifier
│   │   │   ├── integrity.py      9-signal integrity analysis
│   │   │   ├── claude_ai.py      Anthropic Claude integration
│   │   │   ├── dmca.py           DMCA notice generation
│   │   │   ├── viral.py          Propagation tracking
│   │   │   └── trust.py          Unified trust scoring
│   │   ├── models/               Data models
│   │   │   ├── schemas.py        Pydantic request/response models
│   │   │   └── database.py       SQLAlchemy ORM + pgvector
│   │   ├── core/                 App config, security, middleware
│   │   │   ├── config.py         Environment settings
│   │   │   ├── security.py       API key auth
│   │   │   └── middleware.py     CORS, rate limiting, logging
│   │   └── utils/
│   │       ├── crypto.py         AES-256 watermarking
│   │       └── logger.py         Structured logging
│   ├── tests/                    Pytest test suite (70%+ coverage)
│   ├── alembic/                  DB migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📂 frontend/                  React + TypeScript SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/           Nav, Ticker, ControlBar, Sidebar
│   │   │   ├── panels/           PropagationGraph, FeedPanel, ForensicPanel
│   │   │   ├── modals/           EvidenceModal, DMCAModal, HeroOverlay
│   │   │   └── ui/               Cards, Badges, Charts, Buttons
│   │   ├── pages/Dashboard.tsx   Main 3-panel dashboard
│   │   ├── hooks/                useDetection, useWebSocket, useStore
│   │   ├── services/api.ts       Typed API client (all endpoints)
│   │   ├── store/index.ts        Zustand global state
│   │   └── types/index.ts        Full TypeScript type definitions
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
│
├── 📂 infra/
│   ├── nginx/nginx.conf          Reverse proxy + SSL termination
│   └── docker/                   Production compose override
│
├── 📂 .github/
│   └── workflows/ci.yml          CI: lint → test → build → deploy
│
├── 📂 docs/
│   ├── API.md                    Full API reference
│   ├── ARCHITECTURE.md           System design deep-dive
│   └── DEPLOYMENT.md             Production deployment guide
│
├── docker-compose.yml            Development stack
├── docker-compose.prod.yml       Production overrides
├── .env.example                  All env vars documented
└── Makefile                      Dev shortcuts
```

---

## 🔌 API Reference

### Detection Pipeline
```http
POST /api/v1/detect
Content-Type: application/json

{
  "platform": "YouTube",
  "username": "@creator",
  "caption": "Match highlights reel",
  "content_type": "sports",
  "scenario": "deepfake",
  "media_url": "https://..."
}
```

**Response includes:**
- `similarity` — perceptual match score (0–1)
- `ml` — 6-signal ML prediction (SAFE/SUSPICIOUS/TAMPERED)
- `integrity` — 9-signal forensic integrity analysis
- `ai_analysis` — Claude AI reasoning + enforcement decision
- `propagation` — viral spread velocity + urgency
- `case_id` — auto-generated if enforcement needed

### DMCA Filing
```http
POST /api/v1/enforce/dmca
```

### Case Management
```http
GET    /api/v1/cases              # List all cases
PATCH  /api/v1/cases/{id}         # Update status
GET    /api/v1/cases/{id}/export  # Export evidence PDF
```

### Full docs: [docs/API.md](docs/API.md) · [/docs Swagger UI](http://localhost:8000/docs)

---

## 🧠 How It Works

### Detection Pipeline (1.4s end-to-end)

```
Upload ──► Fingerprint ──► ML Classify ──► Integrity Check ──► Trust Score ──► Claude AI ──► Decision
  │           │                │                  │                │              │
  │      pHash + embed    6 signals:          9 signals:      unified score    threat type
  │      cosine sim       spatial             JPEG artifact   risk_label       reasoning
  │                       temporal            noise pattern   confidence       DMCA needed
  │                       color shift         edge consist.
  │                       frame var.          face landmark
  │                       noise               lipsync
  │                       watermark           metadata
```

### Decision Logic

| Similarity | Integrity | ML Label | Decision |
|-----------|-----------|----------|----------|
| ≥88% | >75% | SAFE | ✅ ALLOW |
| ≥70% | ≥55% | SUSPICIOUS | 📋 ATTRIBUTION |
| <60% | conflicting | any | ⚖️ REVIEW REQUIRED |
| >75% | <40% | TAMPERED | 🔴 TAKEDOWN |
| face_landmark >70% | any | TAMPERED | 🚨 EMERGENCY |

---

## 🛠️ Development

```bash
# Install dependencies
make install

# Run with hot reload
make dev

# Run tests
make test

# Lint + format
make lint

# Build for production
make build
```

### Makefile targets
```
make install    Install all deps (backend + frontend)
make dev        Start dev servers (backend :8000, frontend :5173)
make test       Run pytest + vitest
make lint       ruff + eslint
make build      Production Docker build
make migrate    Run DB migrations
make seed       Seed demo data
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude AI API key |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `SECRET_KEY` | ✅ | JWT/HMAC secret (32+ chars) |
| `S3_ENDPOINT` | ⬜ | MinIO/S3 endpoint (optional) |
| `CORS_ORIGINS` | ⬜ | Allowed frontend origins |
| `LOG_LEVEL` | ⬜ | `debug`/`info`/`warning` |

---

## 🚀 Production Deployment

```bash
# Build production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With SSL (update nginx/nginx.conf with your domain)
DOMAIN=verimedia.yourdomain.com docker compose up -d
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full guide including SSL, scaling, and monitoring.

---

## 🧪 Test Coverage

```
backend/tests/
├── test_detection.py       Detection pipeline end-to-end
├── test_ml_pipeline.py     ML classifier accuracy
├── test_integrity.py       9-signal integrity analysis
├── test_claude_ai.py       AI analysis + fallback
├── test_enforcement.py     DMCA generation
└── test_cases.py           Case management CRUD
```

```bash
cd backend && pytest --cov=app tests/ -v
```

---

## 📊 Performance Benchmarks

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Fingerprint compute | ~12ms | 80/s |
| ML pipeline | ~8ms | 120/s |
| Claude AI analysis | ~1.2s | 5/s |
| Full detection pipeline | ~1.4s | 4/s |
| DMCA generation | ~1.8s | 3/s |

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'feat: add my feature'`)
4. Push and open PR

---

## 📄 License

MIT © 2024 VeriMedia AI
