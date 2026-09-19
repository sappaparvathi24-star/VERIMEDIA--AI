# VeriMedia AI — Security, Authentication & Rate Limiting Specification

## 1. Overview & Threat Model
VeriMedia AI enforces defense-in-depth across forensic artifact ingestion, analysis pipelines, provenance graphing, and multi-source web discovery.

---

## 2. §8 Cross-Origin Resource Sharing (CORS) Policy
To prevent unauthorized browser-based cross-origin exploitation and credential leakage:

1. **Origin Allow-List (`CORS_ORIGINS`)**:
   - The allowed origins are loaded from the `CORS_ORIGINS` environment variable (comma-separated list).
   - If `CORS_ORIGINS` is unset, the system defaults to safe local development environments (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`, `http://127.0.0.1:5173`).
   - If an incoming browser request includes an `Origin` header that is **not** present in the allow-list, the request is rejected with a CORS policy error.
   - Non-browser requests without an `Origin` header (such as CLI tools, internal worker calls, and health probes) are permitted.

2. **Allowed Methods & Headers**:
   - Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
   - Allowed Headers: `Content-Type`, `Authorization`, `X-API-Key`, `X-Requested-With`
   - Credentials Support: `credentials: true`

---

## 3. §9 Tiered Rate Limiting & `rateLimitConfig`
VeriMedia AI applies a granular, sliding-window rate limiting architecture categorized by operational weight and vulnerability profile.

### `rateLimitConfig` Definitions
| Route Class | Max Requests / Window (60s) | Vulnerability & Resource Profile | Target Routes |
| :--- | :--- | :--- | :--- |
| **`auth`** | 20 req/min | Credential stuffing & brute-force defense | `POST /auth/login`, `POST /auth/logout`, `/api/auth/*` |
| **`uploads`** | 30 req/min | Storage exhaustion & DoS mitigation | `POST /api/investigations/:id/artifacts/upload`, `POST /api/investigations/:id/artifacts` |
| **`analysis`** | 40 req/min | CPU/GPU-intensive forensic & hashing jobs | `POST /analyze`, `POST /api/investigations/:id/analyze`, `POST /api/claims/:id/assess` |
| **`reports`** | 30 req/min | Heavy cryptographic snapshot & export generation | `POST /api/investigations/:id/report`, `GET /api/investigations/:id/report/export/:format`, `/report/export/:format` |
| **`monitoring`**| 40 req/min | Background crawling & recurring query quotas | `POST /api/investigations/:id/monitoring/jobs`, `POST /api/monitoring/jobs/:id/run` |
| **`discovery`** | 60 req/min | Third-party upstream rate limits (Reddit, YouTube, etc.) | `POST /api/investigations/:id/discovery/jobs`, `GET /api/search/*`, `POST /api/search/*` |
| **`chat`** | 60 req/min | Conversational Gemini AI queries | `POST /chat`, `POST /api/chat`, `POST /api/v1/chat` |
| **`reads`** | 150 req/min | Read-only investigations, findings & timeline browsing | `GET /api/investigations/*`, `GET /api/claims/*`, etc. |
| **`general`** | 150 req/min | General operational endpoints | `POST /api/investigations`, health & info routes |

### Response Headers
When rate limits are evaluated:
- `X-RateLimit-Limit`: Maximum permitted requests in window.
- `X-RateLimit-Remaining`: Remaining request quota.
- `X-RateLimit-Reset`: UTC epoch timestamp when the window resets.
- If threshold is exceeded: HTTP 429 Too Many Requests with `Retry-After: <seconds>` and structured JSON error response.

---

## 4. §10 Audit Logging & Tamper Evidence
All security-relevant actions—including authentication events, rate-limit threshold violations, report exports, monitoring job executions, and claim assessments—are recorded in the append-only SQLite/memory audit ledger with actor, timestamp, IP, and event payloads.
