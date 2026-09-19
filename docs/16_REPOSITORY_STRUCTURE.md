# VeriMedia AI — Repository Structure & Monorepo Architecture

## 1. Monolithic Modular Layout (Current Production Deployment)

```
/
├── api/                      # Vercel serverless function entrypoint wrapper (api/index.js)
├── docs/                     # Technical specifications, API schemas (10_API_SPEC.yaml), evidence models
├── infra/                    # Infrastructure definitions
│   └── nginx/                # Nginx reverse proxy configuration (nginx.conf)
├── ml/                       # Machine Learning models, embeddings, perceptual hash bridges
│   ├── perceptual/           # Perceptual hashing algorithms (pHash, dHash, aHash)
│   ├── embeddings/           # Vector embeddings and similarity computation
│   └── index.js              # ML subsystem exports
├── src/                      # Core application source code
│   ├── audit/                # Security audit logging and immutable ledgers
│   ├── components/           # React 19 UI components, charts, and interactive modals
│   ├── db/                   # SQLite persistence layer and schemas
│   ├── forensics/            # Image, video, audio tampering detectors
│   ├── matching/             # Perceptual hash indexing and candidate matching
│   ├── pages/                # Main application views and dashboards
│   ├── provenance/           # Evidence engine, genealogy trees, propagation, reasoning fusion
│   ├── proxy/                # SSRF-safe outbound request proxy
│   ├── security/             # Auth, JWT, rate limiting, and input sanitization
│   └── services/             # Client API integration layer
├── test/                     # Automated test suites (Phase C through Phase 18)
├── server.js                 # Unified Express + Vite development and production server
└── package.json              # Project dependencies, scripts, and build configuration
```

## 2. ML Subsystem Alignment
The `ml/` directory provides clean separation for perceptual hash math, perceptual difference matrices, and embedding vectors, serving as the bridge between raw bitstreams and the provenance evidence engine.
