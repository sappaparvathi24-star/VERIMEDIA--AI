# VeriMedia AI — System Architecture

VeriMedia AI is a full-stack media forensics, provenance intelligence, and digital rights enforcement platform designed to verify media authenticity, track cross-platform propagation, evaluate associated factual claims, and generate legally sound evidentiary dossiers.

---

## High-Level System Architecture

```
                      ┌──────────────────────────────────────────────┐
                      │            Client Interface (SPA)            │
                      │  - React / Tailwind Responsive Dashboard     │
                      │  - VeriMedia AI Investigation Workspace      │
                      │  - Interactive Gemini Chat & Forensic Copilot│
                      │  - Dynamic Timeline, Genealogy & Lineage GUI │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTP / SSE / REST
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │        Node.js / Express API Backend         │
                      │  - REST Endpoints & Route Controllers        │
                      │  - SSRF-Safe Request Proxy & Rate Limiter    │
                      │  - Multi-Platform Surveillance Scheduler     │
                      └──────┬───────────────┬───────────────┬───────┘
                             │               │               │
            ┌────────────────┴───┐           │           ┌───┴────────────────┐
            ▼                    ▼           ▼           ▼                    ▼
┌───────────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐
│ Gemini AI Engine      │ │ Perceptual  │ │ SQLite DB   │ │ Multi-Source Discovery │
│ - @google/genai SDK   │ │ Forensics   │ │ - Artifacts │ │ - Reddit Open Search   │
│ - Chat & Reasoning    │ │ - pHash     │ │ - Evidence  │ │ - YouTube Data API     │
│ - Claim Decomposition │ │ - EXIF/Meta │ │ - Claims    │ │ - Mastodon Fediverse   │
│ - DMCA Synthesizer    │ │ - ELA/Noise │ │ - Alerts    │ │ - Archive.org Wayback  │
│ - Graceful Fallback   │ │ - Hashes    │ │ - Reports   │ │ - Google Lens / Search │
└───────────────────────┘ └─────────────┘ └─────────────┘ └────────────────────────┘
```

---

## Core Subsystems

### 1. Dual-Core Frontend (SPA & Modular Workspace)
- **Investigation Workspace**: Visualizes artifact forensics, chronological timelines, lineage trees (genealogy), viral propagation clusters, and contradiction matrices.
- **Interactive Gemini Copilot**: Real-time floating assistant and panel copilot providing context-aware answers regarding forensic anomalies, compression artifacts, and evidentiary gaps.
- **Monitoring Hub**: Live scheduling and tracking of automated social media sweeps.

### 2. Multi-Model Server-Side Gemini Engine
- **SDK**: Utilizes `@google/genai` with server-side proxying (zero browser key leakage).
- **Model Tiers**:
  - `gemini-3.1-flash-lite`: Ultra-fast real-time chat, claim decomposition, and structured metadata extraction.
  - `gemini-flash-latest` & `gemini-3.8-flash`: In-depth forensic anomaly analysis, multi-claim reasoning, and evidentiary storyline compilation.
- **High Reliability**: Automatic model fallback sequence ensures 100% uptime even during upstream network partitions or quota limits.

### 3. Perceptual Analysis & Forensic Hashing
- **Cryptographic Layer**: SHA-256 and MD5 bitstream hashing for immutable chain-of-custody.
- **Perceptual Layer**: Hamming-distance perceptual hashes (pHash, dHash, aHash) to identify cropped, compressed, or transcoded derivatives.
- **Metadata Extraction**: EXIF, ICC color profiles, quantization matrices, and container atom parsers.

### 4. Open-Source Intelligence (OSINT) & Discovery Engine
- **Transparent Providers**: Direct integration with Reddit API, YouTube v3, Mastodon public federation, Archive.org Wayback CDX, and Google Images.
- **Honest Transparency**: Non-accessible or restricted social graphs (e.g. TikTok, Instagram, X) are explicitly declared as API-restricted to prevent synthetic hallucinations.

### 5. Evidentiary Fusion & Epistemic Reasoning
- **Strict Evidence Standards**: Hard distinction between direct observations (EXIF, bitstream), verified findings, inferred relationships, and unverified contextual claims.
- **Contradiction Detection**: Cross-references claims against known broadcast archives and verified source materials to flag deceptive framing.

### 6. Security & Hardening
- **SSRF Defense**: Strict IP validation blocking private ranges (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), link-local/cloud metadata (`169.254.169.254`), and IPv6 loopback (`::1`).
- **Cryptographic Audit Snapshot**: Every generated investigation report is signed with an immutable evidence hash.
