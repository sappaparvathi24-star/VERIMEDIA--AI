# 🛡️ VeriMedia AI

> **AI-powered media rights enforcement platform** — Real-time unauthorized content detection, deepfake analysis, manipulation forensics, and automated DMCA enforcement powered by Google Gemini.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://verimedia-ai-jade.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)](https://verimedia-ai-backend.onrender.com/health)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🔗 Live Links

| | URL |
|---|---|
| **Frontend** | https://verimedia-ai-jade.vercel.app/ |
| **Backend health** | https://verimedia-ai-backend.onrender.com/health |
| **API — analyze** | `POST https://verimedia-ai-backend.onrender.com/analyze` |
| **API — DMCA** | `POST https://verimedia-ai-backend.onrender.com/dmca-reasoning` |

---

## 🏆 What It Does

Content creators and rights holders lose billions annually to unauthorized media reuse, deepfakes, and IP violations. Manual detection is too slow; existing tools miss AI-generated manipulations.

VeriMedia AI solves this with a **6-signal detection pipeline** + **Gemini AI reasoning** that runs in under 2 seconds:

- 🔍 **Perceptual fingerprinting** — identifies originals even after cropping, compression, or recoloring
- 🧠 **6-signal ML classifier** — detects spatial, temporal, noise, color, face landmark, and lipsync anomalies
- ⚡ **Gemini 2.0 Flash** — produces evidence-backed enforcement decisions with plain-English reasoning
- 📋 **Automated DMCA engine** — generates formal takedown notices in seconds
- 📡 **Viral propagation tracker** — catches content before it spreads

---

## 🏗️ Architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│      Frontend  (Vercel)      │        │       Backend  (Render)           │
│                              │        │                                   │
│  index.html                  │        │  Node.js 18 + Express             │
│  gemini-integration.js       │──POST─►│                                   │
│                              │        │  POST  /analyze                   │
│  · 6-signal detection UI     │        │  POST  /dmca-reasoning            │
│  · Live pipeline log         │◄─JSON──│  GET   /health                    │
│  · DMCA notice generator     │        │                                   │
│  · Evidence export (PDF)     │        │  @google/generative-ai SDK        │
│  · AI assistant chatbot      │        │  GEMINI_API_KEY  ← server only    │
└──────────────────────────────┘        └──────────────────────────────────┘
```

> **Security:** The Gemini API key **never reaches the browser**. Every Gemini call is made server-side by Express. The frontend only sends `Content-Type: application/json` — no auth headers, no secrets.

---

## 📁 Repository Structure

```
VERIMEDIA--AI/
│
├── 📂 frontend/                    Static HTML/CSS/JS — deployed to Vercel
│   ├── index.html                  Entire frontend app (detection UI, pipeline, DMCA)
│   ├── gemini-integration.js       AI assistant chatbot widget (source)
│   └── public/
│       └── gemini-integration.js   Copy served by Vite build output
│
├── 📂 backend/                     Node.js Express API — deployed to Render
│   ├── server.js                   All endpoints + Gemini SDK calls
│   ├── package.json                express · @google/generative-ai · cors · dotenv
│   ├── .env                        ⚠️ LOCAL ONLY — never committed
│   └── .env.example                Safe template — commit this
│
├── render.yaml                     Render auto-deploy config
├── vercel.json                     Vercel SPA routing config
└── .gitignore                      Excludes .env, node_modules, dist
```

---

## ⚡ Quick Start

**Prerequisites:** Node.js 18+ · [Free Gemini API key](https://aistudio.google.com/app/apikey)

### 1 — Run the backend locally

```bash
git clone https://github.com/sappaparvathi24-star/VERIMEDIA--AI.git
cd VERIMEDIA--AI/backend

npm install

# Create your local env file (never commit this)
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY

npm start
# ✅  VeriMedia AI backend → http://localhost:3001
# ✅  Health check         → http://localhost:3001/health
```

### 2 — Open the frontend

```bash
# Option A — open directly in browser
open ../frontend/index.html

# Option B — serve with a local static server
cd ../frontend && npx serve .
```

The frontend auto-targets `http://localhost:3001` when running locally.

---

## 🔌 API Reference

### `POST /analyze`

Runs the full detection pipeline and returns a Gemini AI enforcement decision.

**Request:**
```json
{
  "contentDescription": "Sports highlight reel posted on Instagram",
  "matchScore": 0.87,
  "integrityScore": 0.42,
  "viralScore": 73,
  "decision": "TAKEDOWN",
  "platform": "Instagram",
  "contentType": "sports",
  "flags": ["low_integrity", "viral_spread"]
}
```

**Response:**
```json
{
  "summary": "87% visual match with critically low integrity (42%) confirms unauthorized distribution of manipulated sports content.",
  "authenticity": "Manipulated",
  "authenticityDetail": "Trust score 37% (match × integrity) falls below the 40% TAKEDOWN threshold.",
  "confidence": 82,
  "keyInsights": [
    "87% match score — content is derived from the registered original",
    "42% integrity score — significant post-processing or re-encoding detected",
    "Viral score 73/100 — content is spreading rapidly across platforms"
  ],
  "whyThisResult": "High similarity combined with low integrity is the primary indicator of unauthorized reuse after manipulation.",
  "riskLevel": "High",
  "recommendedAction": "File DMCA takedown with Instagram and preserve the evidence package.",
  "_meta": { "decision": "TAKEDOWN", "ai_source": "gemini" }
}
```

---

### `POST /dmca-reasoning`

Generates a formal DMCA takedown notice body (17 U.S.C. § 512(c)).

**Request:**
```json
{
  "caseId": "VM-ABC123",
  "platform": "Instagram",
  "user": "@infringer_handle",
  "decision": "TAKEDOWN",
  "trustScore": 0.37,
  "matchScore": 0.87,
  "integrityScore": 0.42,
  "contentType": "sports"
}
```

**Response:**
```json
{
  "caseId": "VM-ABC123",
  "body": "Dear Instagram Trust & Safety Team,\n\nPursuant to 17 U.S.C. § 512(c)...",
  "ai_source": "gemini"
}
```

---

### `GET /health`

```json
{
  "status": "ok",
  "service": "VeriMedia AI",
  "model": "gemini-2.0-flash",
  "gemini": "connected"
}
```

---

## 🧠 Detection Pipeline

```
User Input
    │
    ▼
┌─ Step 1 ──────────────────────────────────────────────────────────┐
│  Perceptual Fingerprinting                                         │
│  pHash + cosine similarity  →  matchScore  (0 – 1)               │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Step 2 ──────────────────────────────────────────────────────────┐
│  6-Signal ML Classification                                        │
│  spatial · temporal · color · noise · face_landmark · lipsync     │
│  →  integrityScore  +  label  (SAFE / SUSPICIOUS / TAMPERED)     │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Step 3 ──────────────────────────────────────────────────────────┐
│  Trust Score                                                       │
│  trustScore = matchScore × integrityScore                         │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Step 4 ──────────────────────────────────────────────────────────┐
│  Viral Propagation Tracking                                        │
│  Cross-platform spread velocity  →  viralScore  (0 – 100)        │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Step 5 ──────────────────────────────────────────────────────────┐
│  Rule-Based Pre-Decision  (instant — shown while Gemini loads)    │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Step 6 ──────────────────────────────────────────────────────────┐
│  Gemini 2.0 Flash AI Reasoning                                     │
│  Contextual analysis  →  plain-English summary + recommended action│
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
  Final Decision  +  DMCA notice (if needed)
```

### Decision Thresholds

| Trust Score | Additional Condition | Decision |
|:-----------:|----------------------|----------|
| > 75% | — | ✅ **ALLOW** |
| 40 – 75% | — | 📋 **REVIEW** |
| < 40% | — | 🔴 **TAKEDOWN** |
| < 30% | viral > 85 | 🚨 **EMERGENCY TAKEDOWN** |
| any | face_landmark > 70% | 🚨 **EMERGENCY TAKEDOWN** |

---

## 🚀 Deployment

### Backend → Render

1. [render.com](https://render.com) → **New → Web Service** → connect this repo
2. Settings:

   | Field | Value |
   |-------|-------|
   | Root directory | `backend` |
   | Build command | `npm install` |
   | Start command | `node server.js` |

3. Environment variables (Render dashboard → **Environment**):

   ```
   GEMINI_API_KEY = your_key_here
   PORT           = 3001
   ```

4. Deploy — you get `https://your-service.onrender.com`
5. Update `VERIMEDIA_BACKEND` in `frontend/index.html` to your Render URL if it differs from the default.

---

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → **New Project** → connect this repo
2. Settings:

   | Field | Value |
   |-------|-------|
   | Root directory | `frontend` |
   | Framework preset | **Other** (static) |
   | Output directory | `.` |

3. No environment variables needed — the Gemini key lives on the backend only.
4. Deploy — you get `https://your-app.vercel.app`.

> Every Vercel push generates a new preview URL (`verimedia-abc123-....vercel.app`). The backend CORS config allows all `*.vercel.app` subdomains automatically — no extra config required for previews.

---

## 🔐 Environment Variables

| Variable | Where | Required | Description |
|----------|-------|:--------:|-------------|
| `GEMINI_API_KEY` | Render / `backend/.env` | ✅ | Google Gemini key — [get one free](https://aistudio.google.com/app/apikey) |
| `PORT` | Render / `backend/.env` | ⬜ | Defaults to `3001` |

No database. No Redis. No Docker required.

---

## 🔒 Security Notes

- The Gemini API key **never leaves the server** — the frontend sends zero auth headers
- `backend/.env` is in `.gitignore` and must never be committed
- CORS is restricted to `*.vercel.app` and `localhost` — arbitrary origins are blocked with a 403
- If you accidentally commit your key: **[revoke it immediately](https://aistudio.google.com/app/apikey)** and generate a new one before the next push

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch — `git checkout -b feat/my-feature`
3. Commit — `git commit -m 'feat: describe the change'`
4. Push and open a Pull Request

---

## 📄 License

MIT © 2025 VeriMedia AI
