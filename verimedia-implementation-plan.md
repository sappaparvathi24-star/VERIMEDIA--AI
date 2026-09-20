# VeriMedia AI — Real vs Fake Audit & Implementation Plan

## Top-Level Goal

Every UI feature must connect to a real backend data path. No hardcoded scores, no mocked results, no silent fake data. Unconfigured integrations show `NOT CONFIGURED`. Demo data is always labeled `is_demo: true`.

This plan covers the **remaining gaps** after the previous session's fixes. All items here are verified against the current codebase.

---

## Current State Summary

### ✅ REAL and working (do not touch)
- ELA pixel diff, pHash (aHash via Sharp), EXIF (exifr), image stats (sharp), SHA-256 (node:crypto)
- Gemini Vision forensics (real multimodal API call, requires `GEMINI_API_KEY`)
- Gemini chat/DMCA generation (real call, labeled `source: 'fallback'` on failure)
- Reddit, Mastodon, Wayback Machine search (real HTTP, no key)
- YouTube Data API v3 (real when `YOUTUBE_API_KEY` set)
- Google CSE (real when `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` set)
- ForensicJobQueue — real async pipeline, persists to SQLite
- SQLite 28+ real tables, WAL mode, migrations
- JWT authentication (PBKDF2-SHA512, HS256)
- Audit logging (real events → `audit_events` SQLite table)
- Report generation (assembles real investigation data → HTML)
- Propagation analysis, genealogy, timeline, evidence fusion (all real service methods)
- MonitoringService.runJob() (real parallel provider searches — fixed last session)
- `/api/investigations/:id/genealogy`, `/propagation`, `/reasoning` routes — FULLY WIRED

### ❌ Gaps to fix (this plan)
1. `OriginalPanel` / `D3ProvenanceTree` — not calling `/api/investigations/:id/genealogy`
2. `PropagationGraph` — not calling `/api/investigations/:id/propagation`
3. OCR — zero implementation, `tesseract.js` not installed
4. Video forensics — explicitly `SKIPPED`, `fluent-ffmpeg` not installed
5. C2PA — zero implementation, no library installed
6. Media file persistence — `artifacts` Map is in-memory only, buffers lost on restart
7. Human review decision recording — `PATCH /api/v1/cases/:caseId` returns mock; no real write
8. Audit trail display — not surfaced in any UI panel
9. JSON export button missing from report UI

---

## Sub-Tasks

---

### Sub-Task 1 — Wire OriginalPanel to Real Genealogy API

**Status:** `[ ] pending`

**Intent:**
`OriginalPanel.tsx` currently passes `currentResult` (from the Zustand store) directly to `D3ProvenanceTree`. The API function `getInvestigationGenealogy(id)` already exists in `src/services/api.tsx` (line 164) and the backend route is fully wired at `server.js:2923`. The gap is that the UI never calls the API.

**Expected Outcomes:**
- When an investigation is loaded, `OriginalPanel` calls `GET /api/investigations/:id/genealogy`
- `D3ProvenanceTree` receives the real API response as its data source
- If no investigation is selected or API returns empty, panel shows "No genealogy data — investigation not loaded" message
- `buildProvenanceTreeData()` in `D3ProvenanceTree.tsx` is replaced by direct use of API-provided nodes/links

**Todo List:**
1. In `OriginalPanel.tsx`: read `currentResult.investigationId` from store; if present, `useEffect` calls `getInvestigationGenealogy(id)` and stores result in local state
2. Pass the API response (nodes/links) as a new prop `genealogyData` to `D3ProvenanceTree` — or replace the `result` prop with structured `{ nodes, links }`
3. In `D3ProvenanceTree.tsx`: when `genealogyData` is provided, use it directly instead of running `buildProvenanceTreeData(result)`. Keep the fallback for demo/store data.
4. Add an empty-state message when genealogy response is `{ nodes: [], links: [] }`

**Relevant Context:**
- `src/components/panels/OriginalPanel.tsx` — passes `result={currentResult}` to D3ProvenanceTree at line 243
- `src/components/charts/D3ProvenanceTree.tsx` — `buildProvenanceTreeData(result)` at line 35; props: `result`, `height`
- `src/services/api.tsx:164` — `getInvestigationGenealogy(id)` already exists
- `src/provenance/service.js` — `getGenealogy(id)` returns `{ nodes, links, metadata }`
- `src/provenance/genealogy.js` — `buildGenealogyGraph()` builds the D3-ready structure

---

### Sub-Task 2 — Wire PropagationGraph to Real Propagation API

**Status:** `[ ] pending`

**Intent:**
`PropagationGraph.tsx` reads `currentResult.propagation` from the Zustand store. The API function `getInvestigationPropagation(id)` already exists in `src/services/api.tsx` (line 167) and the backend route is fully wired at `server.js:2999`. The gap is that the component never calls the API.

**Expected Outcomes:**
- When an investigation is selected, `PropagationGraph` calls `GET /api/investigations/:id/propagation`
- Graph renders with real nodes/edges from the API response
- If API returns empty graph, show "No propagation data yet — run discovery first" message
- Loading state during fetch

**Todo List:**
1. In `PropagationGraph.tsx`: add `useEffect` that fires when `currentResult?.investigationId` changes; calls `getInvestigationPropagation(id)` and stores result in local state
2. Replace canvas rendering source: use API `propagation.nodes` / `propagation.edges` instead of `currentResult.propagation`
3. Add loading spinner during fetch
4. Add empty-state message for no propagation data

**Relevant Context:**
- `src/components/panels/PropagationGraph.tsx` — reads `currentResult.propagation` from store at line 52
- `src/services/api.tsx:167` — `getInvestigationPropagation(id)` already exists
- `src/provenance/service.js` — `getPropagation(id, query)` returns the propagation graph
- `src/provenance/propagation.js` — `analyzePropagation()` builds the real graph

---

### Sub-Task 3 — Install and Implement OCR in Forensic Pipeline

**Status:** `[ ] pending`

**Intent:**
There is zero OCR implementation. `tesseract.js` is not installed. Images containing text (screenshots, posters, documents, memes) cannot have their text content extracted, which is a key forensic signal. OCR results should feed into the evidence chain as an `Observation`.

**Expected Outcomes:**
- `tesseract.js` added to `package.json` and installed
- `src/forensics/imageForensics.js` gains a new exported function `performOCR(imageBuffer)` that returns `{ text, words, confidence, language }`
- `runImageForensicAnalysis()` in `service.js` calls `performOCR()` and stores result as an `Observation` entity
- OCR output visible in ForensicPanel under a "Extracted Text" section
- When no text detected, result is `{ text: '', confidence: 0, language: 'unknown' }` — never throws

**Todo List:**
1. Run `npm install tesseract.js` (or add to `package.json` dependencies)
2. Create `performOCR(imageBuffer, options?)` in `src/forensics/imageForensics.js`:
   - Use `Tesseract.recognize(buffer, 'eng')`
   - Return `{ text, words, confidence, language, wordCount }`
   - Catch errors, return `{ text: '', confidence: 0, error: err.message }` on failure
3. In `src/provenance/service.js` `runImageForensicAnalysis()`: call `performOCR()` after ELA; create an `Observation` with `type: 'OCR_TEXT'`, `data: ocrResult`
4. Wire OCR observation into the `evidenceItems` array returned by the analysis
5. In `ForensicPanel.tsx` (or the relevant forensic display panel): add "Extracted Text" accordion section that shows `ocrResult.text` and `ocrResult.confidence`

**Relevant Context:**
- `src/forensics/imageForensics.js` — add `performOCR()` here alongside `performErrorLevelAnalysis()`, `computeAverageHash()`, etc.
- `src/provenance/service.js` lines 694-1027 — `runImageForensicAnalysis()` where OCR call should be added
- `src/components/panels/ForensicPanel.tsx` — where OCR results should appear in UI

---

### Sub-Task 4 — Install and Implement Video Forensics

**Status:** `[ ] pending`

**Intent:**
All video/audio forensic analysis currently returns `SKIPPED`. `fluent-ffmpeg` is not installed. A minimal implementation should extract codec info, duration, frame count, and a keyframe thumbnail so video evidence has at least basic technical metadata.

**Expected Outcomes:**
- `fluent-ffmpeg` added to `package.json` and installed
- New `src/forensics/videoForensics.js` with `analyzeVideoMetadata(filePath)` function
- Returns `{ codec, duration, fps, frameCount, resolution, bitrate, audioCodec, thumbnail_base64 }`
- `service.js` `runVideoForensicAnalysis()` calls this instead of returning `SKIPPED`
- Results visible in ForensicPanel when a video file is under investigation

**Todo List:**
1. Run `npm install fluent-ffmpeg` and `npm install @ffmpeg-installer/ffmpeg` (provides ffmpeg binary)
2. Create `src/forensics/videoForensics.js`:
   - `analyzeVideoMetadata(filePath)` — wraps `ffprobe` to return streams metadata
   - `extractKeyframe(filePath, timestampSeconds)` — extracts single frame as JPEG buffer
   - Return honest `{ supported: false, reason: 'ffmpeg not available' }` if ffmpeg binary missing
3. In `service.js`: replace the `SKIPPED` returns in video/audio branch with real `analyzeVideoMetadata()` call
4. Persist extracted keyframe as a derived artifact
5. Show video metadata in ForensicPanel under "Video Technical Analysis" section

**Relevant Context:**
- `src/provenance/service.js` lines 731, 740, 747 — explicit `SKIPPED` returns for video/audio
- `src/forensics/imageForensics.js` — follow the same pattern (export single functions, use try/catch)
- `src/components/panels/ForensicPanel.tsx` — add video metadata section

---

### Sub-Task 5 — Implement C2PA Detection Stub with Honest Status

**Status:** `[ ] pending`

**Intent:**
C2PA (Coalition for Content Provenance and Authenticity) manifest detection is completely absent. Rather than leaving it silently unimplemented, the forensic pipeline should always return an honest C2PA status. A stub implementation that reports `C2PA_NOT_DETECTED` (manifest absent), `C2PA_PRESENT` (if library available and manifest found), or `C2PA_UNAVAILABLE` (library not installed) is acceptable for this phase.

**Expected Outcomes:**
- New `src/forensics/c2paForensics.js` with `detectC2PA(fileBuffer, mimeType)` function
- Returns `{ status: 'C2PA_NOT_DETECTED' | 'C2PA_PRESENT' | 'C2PA_UNAVAILABLE', manifest: null | object, message: string }`
- `C2PA_UNAVAILABLE` returned when no C2PA library present — never throws
- Called during image forensic pipeline; result stored as `Observation` entity
- UI displays C2PA status in ForensicPanel — never blank or missing

**Todo List:**
1. Create `src/forensics/c2paForensics.js`:
   - Attempt dynamic `require('c2pa-node')` — if fails, return `{ status: 'C2PA_UNAVAILABLE', manifest: null, message: 'c2pa-node not installed' }`
   - If library present, attempt manifest extraction; return `C2PA_PRESENT` with manifest data or `C2PA_NOT_DETECTED`
   - Always returns an object, never throws
2. In `service.js` `runImageForensicAnalysis()`: call `detectC2PA()` and include result as `Observation` with `type: 'C2PA_STATUS'`
3. In ForensicPanel: add "Content Authenticity (C2PA)" row that shows the status badge — green for PRESENT, gray for NOT_DETECTED, yellow for UNAVAILABLE

**Relevant Context:**
- `src/forensics/imageForensics.js` — pattern to follow for new forensic module
- `src/provenance/service.js` — where to call it in the pipeline
- `src/components/panels/ForensicPanel.tsx` — where to display result

---

### Sub-Task 6 — Persist Media File Buffers to Disk

**Status:** `[ ] pending`

**Intent:**
When an image is uploaded, its buffer is held in memory in `artifactMediaStore` (a `Map`). On server restart this buffer is lost, making forensic re-analysis impossible. Files must be written to disk at `data/media/<sha256>.<ext>` so they survive restarts and can be re-read on demand.

**Expected Outcomes:**
- On upload, file buffer written to `data/media/<sha256>.<ext>`
- `artifactMediaStore.get(artifactId)` first checks in-memory cache, then reads from disk if cache miss
- Existing upload handlers transparently use disk-backed store
- `data/media/` directory is created if it does not exist
- No change to existing API surface — internal implementation detail only

**Todo List:**
1. In `server.js` (or the upload handler): after computing SHA-256, write buffer to `data/media/<sha256>.<ext>` using `fs.promises.writeFile()`. Create `data/media/` dir with `fs.promises.mkdir({ recursive: true })`.
2. Update `artifactMediaStore.get()` call sites: if `Map` returns `undefined`, attempt `fs.promises.readFile('data/media/<sha256>.<ext>')` as fallback
3. Store the disk path in the artifact metadata (add `filePath` field) so lookup is O(1)
4. On startup (`server.js` init): scan `data/media/` and warm the in-memory map with file paths (not full buffers — lazy load on demand)

**Relevant Context:**
- `server.js` — `artifactMediaStore` Map definition; upload handler where `set()` is called
- `src/provenance/core.js` — artifact metadata Map (add `filePath` to artifact schema)
- `src/db/migrations/` — if `filePath` should be persisted in SQLite, add it to the `artifacts` table schema

---

### Sub-Task 7 — Wire Real Human Review Decision Recording

**Status:** `[ ] pending`

**Intent:**
`PATCH /api/v1/cases/:caseId` currently returns a hardcoded mock response without writing to the database. The audit system is real but never receives a decision event from the UI. Human reviewer decisions (`ALLOW`, `REVIEW_REQUIRED`, `TAKEDOWN`, `EMERGENCY_TAKEDOWN`) must be persisted and audited.

**Expected Outcomes:**
- `PATCH /api/v1/cases/:caseId` writes the decision to the investigation record in SQLite
- Decision includes: `{ decision, reviewer_email, notes, timestamp }` — logged to `audit_events`
- `provenanceService.updateInvestigationDecision(id, { decision, actor, notes })` method created
- Existing `FeedbackPanel` or `ControlPanel` gains a "Record Decision" UI: dropdown for decision type, notes textarea, submit button that calls the PATCH endpoint
- Decision is reflected in the investigation's status field

**Todo List:**
1. In `src/provenance/service.js`: add `updateInvestigationDecision(id, { decision, actor, notes })` method that updates the investigation Map and persists via `persistence.js`
2. In `server.js`: replace mock `PATCH /api/v1/cases/:caseId` handler body with real call to `provenanceService.updateInvestigationDecision()`; call `logAuditEvent()` with `action: AuditAction.HUMAN_REVIEW_DECISION`
3. Add `AuditAction.HUMAN_REVIEW_DECISION` constant if not already present
4. In `src/components/panels/ControlPanel.tsx` or `FeedbackPanel.tsx`: add a "Record Decision" form — decision type selector, notes field, submit button calling `PATCH /api/v1/cases/:caseId`
5. Show confirmation toast on success; show error on failure

**Relevant Context:**
- `server.js:1297-1307` — mock PATCH handler to replace
- `src/provenance/service.js` — `updateAlert()`, `acknowledgeAlert()` methods as pattern reference
- `src/components/panels/ControlPanel.tsx` — best location for decision UI (already has case management context)
- `src/db/persistence.js` — `snapshotInvestigation()` or equivalent for persistence
- Audit action constants in `server.js` — `AuditAction` object

---

### Sub-Task 8 — Surface Audit Trail in System Panel

**Status:** `[ ] pending`

**Intent:**
The `audit_events` SQLite table is real and populated on every significant action. But no UI panel displays it. The `SystemPanel.tsx` shows provider health and metrics but has no audit section. Adding a live audit feed there closes the transparency loop.

**Expected Outcomes:**
- `GET /api/audit?limit=50&investigationId=<optional>` endpoint returns recent audit events
- `SystemPanel.tsx` has a new "Audit Trail" section showing the last 50 events in a table: timestamp, actor, action, object type/ID
- Events auto-refresh every 30 seconds
- Events filterable by investigation ID if one is currently selected

**Todo List:**
1. In `server.js`: add `GET /api/audit` route (requires auth) that queries `audit_events` table via `persistence.js` or direct SQLite query; accepts `limit` and `investigationId` query params
2. In `src/services/api.tsx`: add `getAuditEvents(params?)` function that calls `GET /api/audit`
3. In `src/components/panels/SystemPanel.tsx`: add "Audit Trail" section at bottom with a table rendering the events; `useEffect` with 30s polling interval

**Relevant Context:**
- `src/db/persistence.js` — `logAuditEvent()` writes to `audit_events` table; read query needed
- `server.js` — existing audit middleware and `logAuditEvent()` helper
- `src/components/panels/SystemPanel.tsx` — add after the existing REST Endpoints section (currently line 242)
- `src/services/api.tsx` — follow pattern of other GET functions

---

### Sub-Task 9 — Add JSON Export to Report UI

**Status:** `[ ] pending`

**Intent:**
Report generation produces real data assembled from the investigation. HTML download works. A JSON export button is missing — JSON is needed for programmatic downstream processing and for investigators to archive structured evidence.

**Expected Outcomes:**
- Report UI has a "Download JSON" button alongside the existing HTML export
- Clicking it calls `GET /api/investigations/:id/report?format=json`
- Returns raw investigation JSON: artifact, findings, candidates, evidence chain, timeline, provenance graph
- File downloads as `verimedia-report-<id>.json`

**Todo List:**
1. In `server.js` report endpoint: check `req.query.format === 'json'`; if so, return `provenanceService.generateInvestigationReport(id, { format: 'json' })` as `application/json` with `Content-Disposition: attachment`
2. In `src/provenance/reporting.js` `generateInvestigationReport()`: add `format` option; when `'json'`, return the raw `reportData` object instead of rendering HTML template
3. In the report-related UI component (look for "Download" or "Export" button): add a "Download JSON" button that triggers `GET /api/investigations/:id/report?format=json` and initiates browser download

**Relevant Context:**
- `src/provenance/reporting.js` — `generateInvestigationReport()` builds `reportData` then renders HTML
- `server.js` — existing `/api/investigations/:id/report` GET route
- Wherever the "Download Report" button lives in the UI (likely `ReportPanel.tsx` or similar)

---

## Execution Order

Sub-tasks are ordered by impact / risk. Each is independently deployable.

```
1. Wire OriginalPanel → Genealogy API      (UI wiring, no install)
2. Wire PropagationGraph → Propagation API  (UI wiring, no install)
3. OCR implementation                       (npm install + new code)
4. Video forensics implementation           (npm install + new code)
5. C2PA stub                               (new file, no install needed)
6. Media file persistence                   (server-side, no UI change)
7. Human review decision recording          (backend + small UI addition)
8. Audit trail display                      (new API endpoint + UI section)
9. JSON export                             (backend format flag + UI button)
```

---

## Non-Negotiable Rules

- Never fabricate results, hardcoded scores, or mock API responses
- Every UI feature must connect to a real backend data path
- Unconfigured integrations must show `NOT CONFIGURED` — never fake results
- Demo data may exist only when clearly labeled `is_demo: true, mode: 'SIMULATED_SCENARIO'`
- All new analysis functions must return an object (never throw to caller) with an `error` field on failure
- All human decisions must be persisted AND appear in the audit trail

---

## Previously Completed (Prior Session)

- [x] Fixed `DEFAULT_SHOWCASE_RESULT` — `is_demo: true`, `mode: 'SIMULATED_SCENARIO'`
- [x] Fixed `/api/v1/detect/stats` — real artifact counts
- [x] Fixed `/api/v1/cases` — real investigations from `provenanceService`
- [x] Fixed `/health` endpoint — real `total_scans` count
- [x] Added `getArtifacts(investigationId?)` to `ProvenanceService`
- [x] Rewrote `DiscoveryPanel` — real `/api/providers` status + real search
- [x] Rewrote `EvidenceReasoningPanel` — real investigation reasoning + demo fallback
- [x] Rewrote `MonitoringService.runJob()` — real parallel provider searches
- [x] Added `tickMonitoringScheduler()` + 60s server interval
- [x] Fixed `handleMonitoringJobCreation` — maps modal config fields to job schema
- [x] Fixed `MonitoringJobModal.handleSubmit` — calls real API
- [x] Fixed earliest-appearance endpoint — honest `isEstimated`/`isGrounded` flags
