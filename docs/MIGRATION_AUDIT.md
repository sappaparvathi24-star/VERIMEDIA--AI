# VeriMedia AI — Codebase Migration & Architectural Audit

**Product Target:** VeriMedia AI — Multimodal Media Provenance, Integrity & Propagation Intelligence  
**Audit Date:** September 2026  
**Auditor:** Google AI Studio Build Agent  
**Status:** DISCOVERY & AUDIT COMPLETE  

---

## Executive Summary

The imported codebase represents a dual-architecture state resulting from multiple iterations:
1. **Planned/Documented Python/FastAPI Architecture (`/docs/ARCHITECTURE`, `/docs/API`):** Outlines a FastAPI backend (`:8000`), Celery workers, PostgreSQL + pgvector, MinIO/S3, and Claude AI (`claude-sonnet-4-20250514`) with a React/Vite SPA (`:5173`). In the actual imported repository, the Python implementation files are not present or were replaced during containerization by a Node.js runtime.
2. **Operational Node.js/Express + Hybrid Frontend Architecture (`/server.js`, `/frontend/`):** A working, production-ready full-stack server running on port `3000`. It serves an interactive, dark-mode single-page media forensics dashboard (`/frontend/index.html` + `gemini-integration.js`) with simulation scenarios (Deepfake, Adversarial, Fair Use, Crop Attack, etc.), perceptual hash visualizations, 9-signal forensic integrity heatmaps, propagation graphs, and DMCA notice generation.
3. **Migration Objective:** Evolve the codebase into a rigorous, evidence-first Multimodal Media Provenance, Integrity & Propagation Intelligence platform without fabricating evidence, without mandatory paid APIs, and keeping the system fully operational with zero-cost/local defaults.

---

## Task 1: Codebase Inventory

| Component / Layer | Location | Technology / Stack | Role / Purpose | Status / Health |
|---|---|---|---|---|
| **Root Web Server** | `/server.js` | Node.js, Express, `@google/genai` | Reverse proxy, static file server, `/api/analyze`, `/chat`, `/dmca-reasoning`, `/health` | **ACTIVE & OPERATIONAL** (Port 3000) |
| **Root Package Manifest** | `/package.json` | npm, Node.js (CommonJS) | Defines dependencies (`@google/genai`, `express`, `cors`, `dotenv`) and start scripts | Configured & passing builds |
| **Primary Dashboard UI** | `/frontend/index.html` | HTML5, Canvas 2D, Vanilla JS, CSS3 Variables | Comprehensive single-page forensics workstation (Hero overlay, 3-panel display, Propagation canvas, Forensic Heatmaps, DMCA generator) | **ACTIVE & FUNCTIONAL** |
| **AI Client Layer** | `/frontend/gemini-integration.js` | Vanilla JS (IIFE) | Hooks into analysis triggers, extracts scores, calls `/analyze`, injects collapsible AI reasoning panels | **ACTIVE** |
| **Secondary Backend** | `/backend/server.js` & `verimedia-backend-server.js` | Express, `@google/generative-ai` (legacy) | Earlier Express backend prototype targeting port 3001 and Vercel hosting | **REDUNDANT** (Superceded by root `server.js`) |
| **React/Vite SPA Prototype** | `/frontend/src/` & `/frontend/package.json` | React 18, Vite 5, Zustand, TypeScript | Typed modular implementation of the dashboard (Panels: Feed, Forensic, Origin, Cases, System, PropagationGraph) | **STANDBY / CLEAN COMPONENT LIBRARY** |
| **Legacy Architecture Docs** | `/docs/ARCHITECTURE`, `/docs/API` | Markdown | Describes a Python FastAPI + Claude Sonnet + pgvector system | **HISTORICAL SPECIFICATION** |

---

## Task 2: Data Flow Trace (Input to Frontend)

### Current Operational Data Flow:
```
[User Interaction in Frontend UI]
  │
  ├── 1. Scenario Selection (e.g., Deepfake, Adversarial, Fair Use, Normal Share)
  ├── 2. Or File Upload / URL Input (Video/Audio/Image)
  │
  ▼
[Client-Side Feature Extraction & Simulation Engine (index.html)]
  │
  ├── Computes Perceptual Hash (pHash), Bit Error Rate, and Mock Video Frames
  ├── Evaluates 6 ML Feature Signals (Spatial, Color, Frame, Temporal, Noise, Watermark)
  ├── Evaluates 9 Integrity Signals (Face Landmark, Lip-sync, Edge Consistency, JPEG Artifacts, etc.)
  ├── Calculates Trust Score: Trust = 0.55 × Similarity + 0.45 × Integrity (or Match × Integrity)
  ├── Computes Propagation Velocity & Urgency (PPM velocity across YouTube, TikTok, Instagram, X)
  │
  ▼
[DOM Event / Mutation Trigger (`gemini-integration.js`)]
  │
  ├── Extracts scores: { matchScore, integrityScore, viralScore, decision, platform, contentType, flags }
  │
  ▼
[HTTP POST to `/analyze` or `/api/analyze` (Node.js root `server.js`)]
  │
  ├── Checks for `GEMINI_API_KEY`:
  │     ├── IF PRESENT: Sends structured forensic prompt to Gemini (`gemini-3.6-flash`) with JSON mode
  │     └── IF ABSENT / FAILED: Falls back to deterministic local rule engine `buildFallback()`
  │
  ▼
[Structured Response (JSON)]
  │  {
  │    "summary": "...",
  │    "authenticity": "Manipulated" | "AI-Generated" | "Real" | "Uncertain",
  │    "confidence": 92,
  │    "keyInsights": [...],
  │    "whyThisResult": "...",
  │    "riskLevel": "High",
  │    "recommendedAction": "..."
  │  }
  │
  ▼
[Frontend UI Rendering]
  ├── Injects collapsible VeriMedia AI analysis card
  ├── Renders animated 2D Canvas propagation network
  ├── Renders 9-signal forensic integrity heatmap
  └── If takedown warranted, enables DMCA generation modal (`/dmca-reasoning`)
```

---

## Task 3: Reusability Analysis

| Module / Component | Classification | Technical Justification |
|---|---|---|
| **Root Server (`/server.js`)** | **KEEP & EXPAND** | Lightweight, compliant with Cloud Run single-port (3000) constraint, integrates `@google/genai` with local fallback. |
| **Interactive Dashboard (`/frontend/index.html`)** | **KEEP** | Rich, complete, high-contrast dark visual language with instant response, interactive canvas, and comprehensive forensics panels. |
| **Forensics Signal Engine (9 Signals + 6 ML Signals)** | **KEEP & HARDEN** | Well-designed heuristic mathematical model (face landmarks, lip-sync, edge consistency, temporal jitter). |
| **AI Integration (`/frontend/gemini-integration.js`)** | **REFACTOR** | Decouple DOM scraping mutations; bind directly to UI state dispatcher to avoid race conditions. |
| **DMCA Generation Module** | **KEEP & REFACTOR** | Keep statutory 17 U.S.C. § 512(c) templates; enhance to cite cryptographic and forensic hash logs directly. |
| **Redundant Server (`/backend/server.js`)** | **REMOVE / ARCHIVE** | Duplicate Express server that relies on deprecated `@google/generative-ai` package and port 3001. |
| **React Components (`/frontend/src/*`)** | **KEEP (AS MODULAR TARGET)** | High quality TypeScript/Zustand components available when transitioning to a full SPA bundle. |
| **FastAPI / Python Stubs** | **REMOVE / ARCHIVE** | Docs and Docker configs reference missing Python services that cause confusion. |

---

## Task 4: Architectural Problems & Technical Debt

1. **Dual-Backend Ambiguity:**
   - Three different server files existed: `/server.js` (root), `/backend/server.js`, and `/backend/verimedia-backend-server.js`. Root `server.js` is the active server running on port 3000.
2. **SDK Fragmentation:**
   - Root uses `@google/genai` (Antigravity standard).
   - Backend folder used legacy `@google/generative-ai`.
   - Docs referenced Claude API (`anthropic`).
3. **Hardcoded Ports & URLs:**
   - Frontends contained references to `http://localhost:8000`, `http://localhost:3001`, and `http://localhost:5500`. These must all route to relative paths or port 3000.
4. **Evidence Grounding:**
   - In earlier iterations, mock scenarios output fixed hashes. Real provenance requires explicit distinction between "Verified Cryptographic Signature / Content Hash", "Observed Appearance", and "Unknown / Unconfirmed Origin".

---

## Task 5: Mapping to VeriMedia AI Target Architecture

| Target VeriMedia AI Pillar | Target Requirement | Existing Asset in Repo | Migration Action |
|---|---|---|---|
| **1. What is this media?** | Multimodal identification, perceptual hashing, MIME classification | `pHash`, perceptual fingerprinting, content type badges (`sports`, `news`, etc.) | Ground with real image/video metadata inspection (EXIF, container headers). |
| **2. What happened to it?** | Integrity analysis, tamper localization, deepfake detection | 9-signal integrity panel (face landmark, lip-sync, JPEG artifacts, edge consistency) | Maintain the 9-signal heuristic engine; expose visual tamper heatmaps. |
| **3. Where did it come from?** | Provenance tracking, earliest observed appearance | Origin panel, perceptual match database | Enforce strict terminology: "Earliest Observed Appearance", never fabricate origin. |
| **4. What evidence supports that?** | Tamper-evident evidence chain, verifiable records | Evidence Modal, chain-of-custody checklist | Ensure every claim links to verifiable numerical signal metrics. |
| **5. Does the surrounding story match?** | Contextual/semantic congruence (cross-modal claim check) | Scenario parser, caption matching | Check caption vs. visual content type consistency. |
| **6. How did it spread?** | Propagation velocity, viral trajectory, cross-platform spread | `PropagationGraph` 2D canvas, platform distribution nodes (YouTube, TikTok, X, etc.) | Connect viral velocity (PPM) to network node animation. |
| **7. What remains unknown?** | Explicit confidence boundaries, absence of evidence | Uncertainty thresholds, "Uncertain / Low Evidence" scenario | Highlight "Unknown / Unconfirmed" explicitly in the UI; never claim 100% certainty without ground truth. |

---

## Task 6: Zero-Cost / Local First Dependency Audit

| Service / Capability | Tier | Cost Profile | Zero-Cost / Local Strategy |
|---|---|---|---|
| **Core Web Server** | Core | **FREE / LOCAL** | Node.js Express running on container localhost:3000. |
| **Media Forensics & Hashing** | Core | **FREE / LOCAL** | Client-side Canvas manipulation, pixel diffing, bitwise pHash algorithms. Zero API cost. |
| **Integrity & ML Classifiers** | Core | **FREE / LOCAL** | Heuristic mathematical models (weighted logistic regression + 9 signal thresholds). Runs locally in JS/Node. |
| **Gemini AI Integration** | Optional / Enhancement | **FREE TIER / PAYG** | Used for natural language synthesis, legal DMCA prose, and deep semantic explanation. Protected by automatic deterministic local fallback when no key is provided. |
| **Data Storage / Cases** | Core | **FREE / LOCAL** | Client-side Zustand / `localStorage` / in-memory server cache. No required paid external DB (e.g. Pinecone, Spanner, AWS S3). |
| **Vector Search / Embedding** | Advanced | **OPTIONAL** | Built-in cosine similarity matching running in JavaScript memory. |

---

## Task 7: MVP Gap Analysis

| MVP Component | Current Status | Required Action for Full Production Readiness |
|---|---|---|
| **Live Media Analysis Input** | Implemented (Upload + URL + Pre-set Scenarios) | Ensure drag-and-drop file ingestion handles client-side preview and real metadata extraction. |
| **9-Signal Forensic Suite** | Implemented (Heatmaps + metric bars) | Validate that all 9 signals render legibly with high contrast and WCAG AA compliance. |
| **Propagation Network Canvas** | Implemented (Dynamic 2D HTML5 canvas) | Ensure auto-resize via `ResizeObserver` and responsive mobile fallback. |
| **Evidence Package Exporter** | Implemented (Evidence Modal + DMCA Generator) | Ensure JSON/PDF evidence export bundles timestamp, perceptual hash, and signal matrix. |
| **Strict Evidence Disclaimers** | Partially Implemented | Add clear "Observed vs. Original" disclaimers: "Earliest observed appearance on record; absolute provenance requires authoritative cryptographic registration." |

---

## Conclusion & Recommended Implementation Plan

1. **Retain the unified single-server Node.js architecture (`/server.js`)** on port 3000 as the single source of truth.
2. **Keep the rich forensics dashboard (`/frontend/index.html` + `/frontend/gemini-integration.js`)** as the primary interactive experience, ensuring all mock and live flows function seamlessly without external dependencies.
3. **Ensure strict adherence to the Evidence-First product principles:** All outputs clearly delineate verified data from statistical likelihoods.
