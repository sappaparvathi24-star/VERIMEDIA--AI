# VeriMedia AI — Gap Closure Plan

## Overview

Nine implementation tasks derived from `AUDIT_AGAINST_MASTER_PROMPT.md`, processed in dependency order. Each task maps to a numbered "Prompt" from the handoff document. Tasks run one at a time; each verification block must pass before the next begins.

**Non-negotiable house rules enforced throughout:**
1. Never fabricate a result, score, URL, timestamp, or source — return `null` with a reason instead.
2. Never use overclaiming language. Route conclusions through `scanForProhibitedCertaintyTerms()` / `sanitizeProhibitedCertaintyTerms()` in `src/provenance/core.js`.
3. Every conclusion must link to the evidence that supports it.
4. Additive changes only — do not alter existing API response fields or route paths; the 10 test files in `test/` depend on them.
5. Secrets stay server-side.
6. Run the verification block and report real output before marking done.

**Key facts verified against actual workspace files (second-pass subagent read):**
- `server.js` is 3743+ lines; all routes live there.
- `src/provenance/core.js` holds `ProvenanceStore` (Map-based in-memory store, Maps at lines 311–332) and all entity constants. `FindingStatus` (lines 117–122) has only `SUPPORTED`, `INFERRED`, `INCONCLUSIVE`, `CONFLICTING` — missing `RESOLVED`, `UNASSESSED`, `PARTIALLY_SUPPORTED`, `CONTRADICTED`, `UNKNOWN`.
- `src/provenance/service.js` (1117 lines) wraps the store; `getFindings(investigationId)` is **missing** (called defensively elsewhere but never defined).
- `src/forensics/videoForensics.js` exports `analyzeVideoMetadata()` and `extractKeyframe()` but neither is imported or called. Video returns SKIPPED at server.js lines **1705–1720** and **1873–1888**.
- `src/forensics/perceptualHash.js` (90 lines) exports `computeAverageHash`, `hammingDistance`, `hashSimilarity` — **no `computeDifferenceHash` exists**.
- `src/matching/candidateReport.js` — **FILE DOES NOT EXIST** in this workspace.
- `src/matching/autoVerify.js` — **FILE DOES NOT EXIST** in this workspace.
- `src/components/panels/ComparisonLayer.tsx` — **FILE DOES NOT EXIST** in this workspace.
- `src/hooks/useDetection.tsx` **EXISTS** (63 lines) — simple async/await with no setTimeout stage narration. It does not have the cosmetic parallel-narration pattern Prompt 4 describes; the concern from that prompt may apply to inline stage logic elsewhere in `Dashboard.tsx`.
- `demo/images/` — **DIRECTORY DOES NOT EXIST** in this workspace. Test fixtures for Prompt 3 must be generated using bundled ffmpeg.
- `test_e2e_check.mjs` **EXISTS** at the **root level** (not in `test/`) — 191 lines covering 9 stages. It is thin relative to the 18-step chain Prompt 9 targets; that concern is valid.
- `src/App.tsx` mounts Dashboard directly inside AuthGate with no router — no landing page.
- `src/provenance/monitoring.js` has `runJob()` but **no scheduler** — jobs are manually triggered only.
- `src/db/persistence.js` uses `snapshotAll()` on interval — no write-through on mutations.
- The `npm test` script runs 10 files sequentially; new test files must be appended to it.
- Propagation cluster implementation is at `propagation.js` lines **261–271** (exact, verified).

---

## Task 1 — Human Review and Finding Decisions (§21, §23)

**Status**: `[x] done`

### Intent
Give investigators the ability to create findings, change their status, and record immutable human review decisions. The core principle "AI assists; human decides" has zero implementation today.

### Expected Outcomes
- CRUD routes for findings and a review chain endpoint are live.
- A finding cannot reach RESOLVED without at least one review (enforced server-side).
- Two sequential reviews on one finding both persist.
- A user cannot review another user's investigation finding (403).
- Reviews survive a graceful server restart.
- `test/test_human_review.js` passes and is registered in `npm test`.

### Todo List
1. **Extend `FindingStatus`** in `src/provenance/core.js`: add `PARTIALLY_SUPPORTED`, `CONTRADICTED`, `UNKNOWN`, `UNASSESSED`, `RESOLVED`.
2. **Add `reviews` Map** to `ProvenanceStore` constructor. Add `createReview()`, `getReviews(findingId)` methods.
3. **Add `getFindings(investigationId)`** and **`updateFinding(id, patch)`** to `ProvenanceStore`.
4. **Add `InvestigationStatus`** enum with `OPEN`, `IN_REVIEW`, `RESOLVED`, `ARCHIVED` and legal transition table. Add `updateInvestigationStatus(id, newStatus, actorId)` to the store.
5. **Add service wrappers** in `src/provenance/service.js`: `getFindings()`, `createFinding()`, `updateFinding()`, `createReview()`, `getReviews()`, `updateInvestigationStatus()`.
6. **Add 6 routes** in `server.js`, grouped near the existing `GET /api/findings/:id/trace`:
   - `POST /api/investigations/:id/findings` — create
   - `GET /api/investigations/:id/findings` — list with evidence counts
   - `PATCH /api/findings/:id` — update statement/status
   - `POST /api/findings/:id/review` — record human decision (append-only)
   - `GET /api/findings/:id/reviews` — list review chain
   - `PATCH /api/investigations/:id/status` — change investigation status with transition validation
7. Each route must call `auditService.logAuditEvent()` and write a timeline event, matching the pattern in neighboring routes. Use `requireAuth` and `authorizeChain(provenanceService)` exactly as existing investigation routes do.
8. **Add review persistence** to `src/db/persistence.js`: `saveReview()`, `loadReviews()`, `hydrateAll()` extension.
9. **Create `src/components/panels/ReviewPanel.tsx`**: list findings with status/evidence count; selected finding shows statement, supporting evidence, conflicting evidence, unknowns; four decision buttons (ACCEPT/REJECT/INCONCLUSIVE/REQUEST_FURTHER_INVESTIGATION) with required rationale for REJECT and INCONCLUSIVE; immutable prior review chain.
10. **Register `ReviewPanel`** as a new tab in `src/pages/Dashboard.tsx` and add it to the nav.
11. **Write `test/test_human_review.js`** covering all four acceptance points; append to `npm test` in `package.json`.

### Relevant Context
- `src/provenance/core.js`: `ProvenanceStore` constructor lines 311–332; `createFinding()` lines 609–650; `FindingStatus` lines 117–122.
- `src/provenance/service.js`: `traceFinding()` lines 289–327; investigate how `authorizeChain()` is used in neighboring routes.
- `src/security/auth.js`: `requireAuth`, `authorizeChain`.
- `src/audit/auditService.js`: `logAuditEvent`, `AuditAction`, `AuditObjectType`.
- `server.js` line 2352: existing `GET /api/findings/:id/trace` — add new routes adjacent.
- `src/db/persistence.js`: `PersistenceManager`; `hydrateAll()` / `snapshotAll()`.

---

## Task 2 — Repost Collapsing by Content Family (§18)

**Status**: `[ ] pending`

### Intent
500 copies of one image across 500 accounts must count as "1 content family", not as 500 independent pieces of corroboration. The current platform-name clustering in `propagation.js` inflates confidence exactly as the spec warns.

### Expected Outcomes
- New `src/provenance/contentFamily.js` groups artifacts by perceptual similarity.
- Propagation clusters use content families as the unit; platform breakdown remains as a separate field.
- Evidence fusion counts one family as one corroboration unit.
- 12 near-identical variants + 2 unrelated images → 3 families (1 large + 2 singletons).
- Existing propagation endpoints return their original fields unchanged (additive).
- `PropagationGraph.tsx` renders families as expandable nodes.
- `test/test_content_family.js` passes.

### Todo List
1. **Add `computeDifferenceHash()`** to `src/forensics/perceptualHash.js` (difference/gradient hash algorithm on 9×8 pixel grid). Export it.
2. **Create `src/provenance/contentFamily.js`**: single-linkage clustering using fused similarity (aHash × 0.6 + dHash × 0.4); threshold 0.88; family record holds `familyId`, representative, `memberIds`, `appearanceCount`, `distinctSourceCount`, `earliestAt`, `latestAt`, `transformationVariants`.
3. **Update `src/provenance/propagation.js`** (lines ~250–271): replace the platform-name cluster loop with a call to `groupIntoContentFamilies()`; keep existing platform breakdown as `platformBreakdown` field. Add `contentFamilies` field to the return.
4. **Update evidence fusion in `src/provenance/core.js`**: wherever evidence strength is aggregated (search for the confidence/strength accumulation loop), treat each unique `familyId` as one unit rather than each individual evidence record.
5. **Update `src/components/panels/PropagationGraph.tsx`**: render content family nodes that expand to show member artifacts; display "N appearances across M sources · 1 content family".
6. **Write `test/test_content_family.js`** with the 12+2 case using generated or real image buffers; append to `npm test`.

### Relevant Context
- `src/forensics/perceptualHash.js`: `computeAverageHash()` (line 15), `hammingDistance()` (line 59), `hashSimilarity()` (line 85).
- `src/provenance/propagation.js` lines 250–271: current platform clustering.
- Fusion weighting documented in prompt as 0.6/0.4 — implement in `contentFamily.js` only; do not scatter.

---

## Task 3 — Video Support via Keyframe Extraction (§6, §8, §13, §14)

**Status**: `[ ] pending`

### Intent
`videoForensics.js` has working `extractKeyframe()` but it is never called. Video uploads return SKIPPED. This task wires the existing function into the pipeline for maximum unlock with minimal new code.

### Expected Outcomes
- An `.mp4` upload produces keyframe hashes, per-keyframe forensics, and a reverse-search attempt — not SKIPPED.
- A trimmed copy of the same video matches the original with a reported temporal offset.
- An audio-only `.mp3` still returns an honest SKIPPED with a specific reason.
- A video never reports a whole-video similarity figure that is actually a single-frame measurement without saying so.
- `test/test_video_keyframes.js` passes.

### Todo List
1. **Add `sampleKeyframes(filePath, { count = 8, strategy = 'UNIFORM' })`** to `src/forensics/videoForensics.js`: call `analyzeVideoMetadata()` for duration; extract frames uniformly spaced; return `[{ timestampSeconds, buffer }]`.
2. **Add `buildVideoFingerprint(keyframes)`** to `videoForensics.js`: ordered list of per-keyframe fused hashes plus duration, resolution, fps, codec.
3. **Add `compareVideoFingerprints(fpA, fpB)`** to `videoForensics.js`: sliding-window offset matching; report `matchedFrameCount`, `meanSimilarity`, `estimatedOffset`.
4. **Add `selectStrongestKeyframe(keyframes)`** (highest Shannon entropy) to `videoForensics.js`.
5. **Import `videoForensics.js` functions in `server.js`** at the top with other forensics imports.
6. **Remove SKIPPED short-circuits for video** in `server.js` (lines ~1705–1719, ~1873–1887) and in `src/provenance/core.js` (line ~666–684). Replace with: if `filePath` is available, run `sampleKeyframes()` + per-keyframe image pipeline; if no `filePath` or audio-only, return honest SKIPPED with reason `'audio-only files require a file path and audio forensic pipeline'`.
7. **Per-keyframe**: call existing `computeAverageHash` + `computeDifferenceHash`, ELA via `performErrorLevelAnalysis()`, entropy via `computeImageStatistics()`, OCR via `performOCR()`. Label all results as keyframe-derived, not whole-video.
8. **Reverse search on strongest keyframe**: call into `autoVerify.js` (or the multi-source discovery path); include `{ keyframeTimestamp, note: 'reverse search ran on keyframe, not whole video' }` in the result.
9. **Detect video transformations**: trimming (duration delta with matching frame sequence), fps change, resolution change, codec transcode.
10. **Generate test fixtures** using the bundled ffmpeg: a 10s clip, a 6s trim, a re-encoded copy, one unrelated clip. Store in `test/fixtures/video/`.
11. **Write `test/test_video_keyframes.js`**; append to `npm test`.

### Relevant Context
- `src/forensics/videoForensics.js`: `analyzeVideoMetadata()` lines 23–91; `extractKeyframe()` lines 99–126.
- `src/forensics/imageForensics.js`: `performErrorLevelAnalysis()`, `computeImageStatistics()`.
- `src/forensics/ocr.js`: `performOCR()`.
- `src/forensics/perceptualHash.js`: `computeAverageHash()`, new `computeDifferenceHash()` from Task 2.
- `server.js` lines ~1705–1887: video SKIPPED short-circuits.
- `src/provenance/core.js` lines ~666–684: SKIPPED in `runImageForensicAnalysis()`.

---

## Task 4 — Plain-Language Layer and Technical Disclosure (§32, §47)

**Status**: `[ ] pending`

### Intent
The UI currently leads with DCT terminology, sensor PRNU, epistemic signal fusion — language a journalist or juror cannot parse. Technical content must move behind a one-click disclosure; plain summaries must lead.

### Expected Outcomes
- No jargon term from the mapping appears in a panel's primary text.
- Every hash, raw metadata blob, and method name is reachable in at most one click.
- Progress text during a scan corresponds to actual backend stage events (not hardcoded setTimeout strings).
- `npx tsc --noEmit && npm run build` passes.

### Todo List
1. **Create `src/lib/plainLanguage.ts`**: exported `PLAIN_LANGUAGE_MAP` covering at minimum: perceptual hash distance, DCT variance anomaly, epistemic classification, ELA, graph traversal, EXIF, pHash/dHash, entailment, PRNU. Each entry: `{ plain: string, explanation: string }`. One source of truth — no scattering.
2. **Create `src/components/common/TechnicalDetails.tsx`**: a `<details>`/`<summary>` (or accessible equivalent) collapsed by default. Props: `summary: string` (plain text, always visible), `children` (technical content inside).
3. **Refactor `ForensicPanel.tsx`**: primary text uses `PLAIN_LANGUAGE_MAP` translations; hashes, raw EXIF, method names, evidence IDs, provider names, latencies move into `<TechnicalDetails>`.
4. **Refactor `DiscoveryPanel.tsx`**: same pattern.
5. **Refactor `EvidenceReasoningPanel.tsx`**: same pattern.
6. **Refactor `OriginPanel.tsx`**: same pattern.
7. **If `ComparisonLayer.tsx` exists after Task 6**: apply same pattern.
8. **Remove/replace theatrical stage narration**: locate the `setTimeout`-based stage label strings in `src/hooks/useDetection.tsx` (currently missing — if implemented as inline code in Dashboard.tsx, locate there). Replace with SSE-event-driven labels using plain names: "Checking the file", "Reading camera details", "Looking for copies online", "Weighing the evidence".
9. Run `npx tsc --noEmit && npm run build`.

### Relevant Context
- `src/pages/Dashboard.tsx`: check for inline stage label logic since `useDetection.tsx` does not exist.
- Panels in `src/components/panels/`: ForensicPanel.tsx, DiscoveryPanel.tsx, EvidenceReasoningPanel.tsx, OriginPanel.tsx.

---

## Task 5 — Landing Page (§33)

**Status**: `[ ] pending`

### Intent
`src/App.tsx` mounts Dashboard directly inside AuthGate — no landing page. The first thing a judge sees is the authenticated dashboard. This task adds a credible landing page at `/` with the dashboard at `/investigate`.

### Expected Outcomes
- `/` renders without authentication; `/investigate` is AuthGate-protected.
- Fully responsive; legible when projected.
- Keyboard reachable; headings in correct order; body text contrast ≥ 4.5:1.
- `npx tsc --noEmit && npm run build` passes.

### Todo List
1. **Install `react-router-dom`** (or implement a minimal view-state switch in `App.tsx` if less invasive — prefer the latter given no router today, to avoid changing 10+ import paths).
2. **Create `src/pages/LandingPage.tsx`**: restrained palette (light theme or dark with single accent); no emoji; no glow effects; strong typographic hierarchy; real prose. Content per spec:
   - H1: VeriMedia AI
   - H2: Digital Content Misuse Detection & Verification System
   - Subtitle: "Don't just ask whether content is suspicious. Reconstruct the evidence behind it."
   - Primary CTA: "Start an Investigation" → `/investigate`
   - Secondary CTA: "Explore How It Works" → anchored `#how-it-works` section
   - Pipeline visual: Upload → Analyze → Discover → Trace → Explain → Review (six steps, one plain sentence each)
   - Thesis contrast section: traditional "Is this fake?" vs. VeriMedia "What happened? How do versions relate? Where did it appear? What evidence supports the conclusion?"
3. **Update `src/App.tsx`**: add a view-state switch (`currentView: 'landing' | 'dashboard'`); render `LandingPage` when unauthenticated at root; render `AuthGate` + `Dashboard` at `/investigate` path.
4. **Accessibility pass**: visible focus rings, correct heading order, contrast check.
5. Run `npx tsc --noEmit && npm run build`.

### Relevant Context
- `src/App.tsx` (27 lines): currently `AuthGate → Dashboard` with no router.
- No `react-router-dom` in current `package.json` — evaluate adding it vs. view-state.

---

## Task 6 — Comparison Viewer: Zoom, Pan, Video (§37)

**Status**: `[ ] pending`

### Intent
The comparison panel is referenced in `ComparisonLayer.tsx` but that file does not exist. This task creates it with zoom/pan/toggle, difference highlighting, and video synchronization. Note: depends on Task 3 for video keyframe data.

### Expected Outcomes
- Synchronised zoom and pan across both panes.
- Toggle mode (flip between two images in place).
- Difference highlighting with clear disclaimer that it is a pixel difference map, not a manipulation detector.
- Video mode: synchronised playback, shared scrub timeline, frame stepping, side-by-side keyframe comparison.
- Proxy URL path (`/api/proxy/thumbnail`) preserved; zoom/diff controls disable gracefully when proxy returns SVG placeholder.
- `npx tsc --noEmit && npm run build` passes.

### Todo List
1. **Create `src/components/panels/ComparisonLayer.tsx`**: side-by-side panes with bucket logic (KNOWN/UNKNOWN/NOT_MATCHED) and per-result report rendering — replicate what was referenced in Dashboard.
2. **Add synchronised zoom and pan**: wheel/pinch to zoom, drag to pan, double-click to reset; both panes locked to same viewport matrix.
3. **Add view mode toggle**: `'side-by-side' | 'toggle' | 'difference'` — difference mode computes pixel difference on a canvas.
4. **Difference highlighting**: canvas-based pixel difference map; threshold-based region outlining; label: "Raw pixel difference. Misaligned or rescaled images will highlight everywhere. This is not a manipulation detector."
5. **Detect SVG placeholder** from proxy: when `Content-Type` is `image/svg+xml`, disable zoom and difference controls and show "Preview unavailable — original source blocked hotlinking."
6. **Video mode** (uses keyframe data from Task 3): synchronised `<video>` playback, shared scrub bar, frame step buttons (±1 frame), side-by-side keyframe image with its timestamp label.
7. **Register in Dashboard.tsx** if not already present as a tab.
8. Run `npx tsc --noEmit && npm run build`.

### Relevant Context
- `src/components/panels/`: existing panels for pattern reference.
- `/api/proxy/thumbnail`: existing proxy route in `server.js`.
- Task 3 keyframe data shape: `{ timestampSeconds, buffer }` per frame.

---

## Task 7 — Persistence Hardening (§29)

**Status**: `[ ] pending`

### Intent
All runtime state is in Maps; SQLite is only written on interval or graceful shutdown. A hard crash loses all data since the last snapshot. This task adds immediate write-through while keeping the Maps as a read cache so no existing code or tests break.

### Expected Outcomes
- A SIGKILL mid-analysis: on restart, investigation, artifacts, and all evidence written before the kill are present.
- All 10 existing test files still pass unchanged.
- Restoring 500 artifacts completes in under 2 seconds.
- New `test/test_persistence_crash_recovery.js` passes.

### Todo List
1. **Audit which `create*` and `update*` methods in `ProvenanceStore`** touch the 14 entity types listed in the prompt. Map them to their corresponding `PersistenceManager` methods.
2. **Add `PersistenceManager` instance** to `ProvenanceStore` constructor (injected or imported). On each `create*`/`update*`, call the corresponding `persistence.save*()` immediately before returning — synchronous SQLite write is acceptable (better-sqlite3 is synchronous by design).
3. **Wrap multi-entity operations** in `runImageForensicAnalysis()` (creates artifact + observations + evidence) in a single SQLite transaction using `better-sqlite3`'s `db.transaction()`.
4. **Update `hydrateAll()`** in `persistence.js` to hydrate all 14 entity types including the new `reviews` Map from Task 1. Log counts on boot.
5. **Keep `snapshotAll()`** as a periodic consistency backstop — reduce interval comment to indicate it is a backstop, not primary.
6. **Supabase mirror**: if `SUPABASE_URL` and key are present, mirror writes; if absent, log "Storage: local SQLite only" on boot. UI must show "Local storage — data is not synced to cloud" when Supabase is absent.
7. **Update `.env.example`** with comments for every required and optional variable, explaining what breaks without each.
8. **Write `test/test_persistence_crash_recovery.js`**: spawn server, create investigation + evidence, SIGKILL, restart, assert recovery.
9. Append new test to `npm test` in `package.json`.

### Relevant Context
- `src/provenance/core.js` lines 311–332: Maps; lines 657–812: `runImageForensicAnalysis()` multi-entity operation.
- `src/db/persistence.js`: `PersistenceManager`, `hydrateAll()`, `snapshotAll()`, `save*()` methods.
- `server.js` line ~355: existing Supabase detection logic.

---

## Task 8 — Monitoring Scheduler (§27)

**Status**: `[ ] pending`

### Intent
Monitoring jobs marked ACTIVE have been created, not started. There is no scheduler. An ACTIVE badge over a non-running scheduler is the kind of misleading claim this product exists to argue against. Path A (implement the scheduler) is the better demo.

### Expected Outcomes (Path A)
- A job with a 60-second interval runs at least twice in 150 seconds, raising alerts only for genuinely new URLs.
- Vision quota consumption is bounded and reported.
- Jobs reschedule after a restart.
- `GET /api/monitoring/scheduler/status` returns real scheduler state.
- `test/test_monitoring_scheduler.js` passes with observed run timestamps.

### Todo List
1. **Create `src/jobs/monitoringScheduler.js`**: `MonitoringScheduler` class with `start()`, `stop()`, `scheduleJob(job)`, `cancelJob(jobId)`, `getStatus()`.
2. **On boot**: load all `ACTIVE` jobs from store; schedule each on its interval using `setTimeout`/`setInterval` chains (no external scheduler library needed).
3. **Each run**: call `src/provenance/monitoring.js` `runJob()` → which calls `src/matching/autoVerify.js` or multi-source discovery; diff results against `job.seenCandidateUrls`; raise alerts only for `NEW_APPEARANCE`, `PLATFORM_EXPANSION`, `TRANSFORMATION_VARIANT`.
4. **Quota guard**: check `src/matching/visionQuotaGuard.js` before each run; if quota is exhausted, mark run as SKIPPED_QUOTA and record it on the job.
5. **Job state updates**: `lastRunAt`, `nextRunAt`, `runCount`, `consecutiveFailures`; move to FAILED after configurable failure count (default 3).
6. **Restart recovery**: on boot, read `lastRunAt` and `interval` from persisted job; schedule `nextRunAt = lastRunAt + interval` (or immediately if overdue).
7. **Add route** `GET /api/monitoring/scheduler/status` to `server.js` returning `{ running, scheduledJobCount, jobs: [{ id, nextRunAt, runCount }] }`.
8. **Export `scheduler` instance** from `monitoringScheduler.js` and call `scheduler.start()` in `server.js` after store hydration.
9. **Write `test/test_monitoring_scheduler.js`**: create a job with 60s interval, wait 150s, assert ≥ 2 runs with timestamps; assert new URL triggers alert, repeat URL does not.
10. Append to `npm test`.

### Relevant Context
- `src/provenance/monitoring.js`: `MonitoringService`, `runJob()` (lines 48–80).
- `src/matching/visionQuotaGuard.js`: quota guard.
- `src/matching/autoVerify.js` or `src/matching/providers/index.js`: discovery execution.
- `server.js`: existing monitoring routes for pattern reference.

---

## Task 9 — End-to-End Acceptance Test and Investigation Summary (§50, §53)

**Status**: `[ ] pending` (depends on Tasks 1, 2, 3, 7)

### Intent
No E2E test covers the 18-step chain. The five-part investigation summary is partially assembled but never exposed as a dedicated endpoint. Without these, no claim about the system being "working" can be substantiated on a projector.

### Expected Outcomes
- `test/test_e2e_investigation.js` passes all 18 steps, including traceability walk (finding → evidence → observation → artifact).
- Anti-fabrication rules verified end-to-end: no similarity score without `similarityBasis`; no prohibited certainty terms.
- `GET /api/investigations/:id/summary` returns a five-part plain-language summary with evidence citations.
- Investigation dashboard opens with the summary block.
- Summary is included in generated reports.
- All commands in the verify block report real output.

### Todo List
1. **Create `src/provenance/investigationSummary.js`**: assemble five-part plain-language summary from live store state:
   - *What We Observed*: artifacts, metadata, forensic observations
   - *What The Evidence Supports*: findings with status and evidence IDs cited
   - *What Changed*: transformations with types and confidence
   - *Where It Appeared*: propagation events, content families (from Task 2), distinct sources
   - *What Remains Uncertain*: unfetchable candidates, missing metadata, skipped analyses, absent providers — never empty on a real investigation
   - Plus: human review decision and notes (from Task 1)
   - Every line cites the evidence ID it rests on.
2. **Register route** `GET /api/investigations/:id/summary` in `server.js` (the route already exists at server.js but may only return partial `whatWeKnow` — replace its handler with `investigationSummary.buildSummary(id)`).
3. **Add summary block** to investigation dashboard in `src/pages/Dashboard.tsx` as the opening panel.
4. **Include summary** in `src/provenance/reporting.js` report generation.
5. **Write `test/test_e2e_investigation.js`** covering all 18 steps from a cold server start:
   - create investigation → upload real image → confirm preservation → SHA-256 → extract metadata → run forensic analysis → run OCR → generate discovery candidates (or assert honest unavailability) → compare a candidate → identify a transformation → create provenance relationship → build propagation graph → generate evidence → generate a finding → perform human review (Task 1) → record decision → generate report → verify audit trail
   - Traceability walk: finding → evidence → observation → artifact (every link must resolve)
   - Anti-fabrication assertions: no similarity score without `similarityBasis`; no prohibited certainty terms in any response field
6. Run all commands in verify block; report actual output.
7. Append `test/test_e2e_investigation.js` to `npm test`.

### Relevant Context
- `src/provenance/service.js`: `getInvestigationSummary()` — examine what it currently returns.
- `src/provenance/propagation.js`: `whatWeKnow` array.
- `src/provenance/reporting.js`: `generateReport()`.
- `src/provenance/core.js`: `scanForProhibitedCertaintyTerms()`.
- Tasks 1, 2, 3, 7 must be complete first.

---

## Dependency Order

```
Task 1 (findings + reviews)
  └── Task 7 (persistence hardening — reviews must persist)
        └── Task 9 (E2E test — needs findings, persistence, video)
Task 2 (content family)
  └── Task 9
Task 3 (video keyframes)
  └── Task 6 (comparison viewer video mode)
  └── Task 9
Task 4 (plain language) — independent after Task 6 is done
Task 5 (landing page) — independent
Task 8 (monitoring scheduler) — independent
```

Tasks 1 → 7 → 9 form the critical chain. Tasks 2, 3, 5, 8 can each start once Task 1 is done (they do not depend on each other). Task 4 is safest last since it touches multiple panels that may change in Tasks 6 and 3.

**Recommended implementation order**: 1 → 2 → 3 → 7 → 5 → 8 → 4 → 6 → 9
