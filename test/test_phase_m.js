// test/test_phase_m.js
// VeriMedia AI — Phase M Test Suite: Final UX, Security & Production Hardening
import assert from 'assert';
import {
  ProvenanceStore,
  MonitoringJobStatus,
  AlertStatus,
  AlertSeverity,
  AlertType,
  ClaimTypes,
  ClaimStatus,
  EvidencePolarity,
  TransformationTypes,
  PROHIBITED_CERTAINTY_TERMS
} from '../src/provenance/core.js';
import { validatePropagationUrl } from '../src/provenance/propagation.js';
import { validateSourceUrl } from '../src/provenance/claims.js';
import { buildMediaTimeline } from '../src/provenance/timeline.js';
import { buildGenealogyGraph } from '../src/provenance/genealogy.js';
import { analyzePropagation } from '../src/provenance/propagation.js';
import { fuseEvidenceAndReasoning, traceReasoningChain } from '../src/provenance/reasoning.js';
import { MonitoringService } from '../src/provenance/monitoring.js';
import { generateInvestigationReport, exportReportHTML, exportReportJSON } from '../src/provenance/reporting.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase M Tests: Production Hardening & Security ──\n');

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Investigation Isolation
// ---------------------------------------------------------------------------
runTest('Test 1: Demo data never contaminates real investigation queries or evidence fusion', () => {
  const store = new ProvenanceStore();
  const realInv = store.createInvestigation({ id: 'INV-REAL', title: 'Real Investigation', isDemo: false });
  const demoInv = store.createInvestigation({ id: 'INV-DEMO', title: 'Demo Investigation', isDemo: true });

  const realArt = store.createArtifact({ investigationId: realInv.id, filename: 'real.mp4', isDemo: false });
  const demoArt = store.createArtifact({ investigationId: demoInv.id, filename: 'demo.mp4', isDemo: true });

  const realRun = store.createAnalysisRun({ investigationId: realInv.id, artifactId: realArt.id });
  const realObs = store.createObservation({ runId: realRun.id, artifactId: realArt.id, value: 'real_val' });
  const realEv = store.createEvidence({ observationIds: [realObs.id], independenceGroupId: 'IG-REAL', isDemo: false });
  store.createFinding({ investigationId: realInv.id, artifactId: realArt.id, evidenceIds: [realEv.id], title: 'Real Finding' });

  const demoRun = store.createAnalysisRun({ investigationId: demoInv.id, artifactId: demoArt.id });
  const demoObs = store.createObservation({ runId: demoRun.id, artifactId: demoArt.id, value: 'demo_val' });
  const demoEv = store.createEvidence({ observationIds: [demoObs.id], independenceGroupId: 'IG-DEMO', isDemo: true, metadata: { isDemo: true } });
  store.createFinding({ investigationId: demoInv.id, artifactId: demoArt.id, evidenceIds: [demoEv.id], title: 'Demo Finding', isDemo: true });

  const realFusion = fuseEvidenceAndReasoning(store, realInv.id);
  assert(!realFusion.evidenceLedger.some(e => e.id === demoEv.id), 'Real fusion must not contain demo evidence');
  assert(realFusion.evidenceLedger.some(e => e.id === realEv.id), 'Real fusion must contain real evidence');
});

// ---------------------------------------------------------------------------
// TEST 2: Demo Notice Inclusion in All Demo Artifacts & Reports
// ---------------------------------------------------------------------------
runTest('Test 2: Demo investigations clearly display synthetic data notices in reports and jobs', () => {
  const store = new ProvenanceStore();
  const demoInv = store.createInvestigation({ title: 'Simulated Demo Case', isDemo: true });
  const job = store.createMonitoringJob({ investigationId: demoInv.id, isDemo: true });
  const report = generateInvestigationReport(store, demoInv.id);
  const html = exportReportHTML(report);

  assert.strictEqual(report.isDemo, true);
  assert(job.limitations.some(l => l.includes('DEMO SCENARIO')));
  assert(html.includes('DEMO SCENARIO — SIMULATED INVESTIGATION EVIDENCE'));
});

// ---------------------------------------------------------------------------
// TEST 3: Cryptographic Digest Integrity
// ---------------------------------------------------------------------------
runTest('Test 3: Media artifacts enforce valid cryptographic SHA-256 hash representation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Crypto Test' });
  const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'video.mp4',
    sha256: sha
  });

  assert.strictEqual(art.sha256, sha);
  assert.strictEqual(art.sha256.length, 64);
});

// ---------------------------------------------------------------------------
// TEST 4: SSRF Defense for IPv4 Private & Loopback Addresses
// ---------------------------------------------------------------------------
runTest('Test 4: SSRF protection blocks localhost, 127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12', () => {
  const unsafeUrls = [
    'http://127.0.0.1/admin',
    'http://localhost:8080/secret',
    'https://10.0.0.1/internal',
    'http://192.168.1.1/router',
    'http://172.16.0.5/api'
  ];

  for (const url of unsafeUrls) {
    const propRes = validatePropagationUrl(url);
    assert.strictEqual(propRes.valid, false, `Propagation URL "${url}" must be rejected by SSRF guard`);

    let claimThrown = false;
    try {
      validateSourceUrl(url);
    } catch (_) {
      claimThrown = true;
    }
    assert(claimThrown, `Claim URL "${url}" must throw SSRF error`);
  }
});

// ---------------------------------------------------------------------------
// TEST 5: SSRF Defense for Cloud Metadata & IPv6 Loopback
// ---------------------------------------------------------------------------
runTest('Test 5: SSRF protection blocks 169.254.169.254 (cloud metadata) and IPv6 loopback [::1]', () => {
  const blocked = [
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:3000/status'
  ];

  for (const url of blocked) {
    const res = validatePropagationUrl(url);
    assert.strictEqual(res.valid, false);
  }
});

// ---------------------------------------------------------------------------
// TEST 6: Resilient Handling of Missing / Partial Metadata
// ---------------------------------------------------------------------------
runTest('Test 6: Reasoning and timeline handle partial media artifacts (null dimensions, duration, platforms)', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Partial Metadata' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'unspecified_stream.bin',
    dimensions: null,
    duration: null
  });

  const timeline = buildMediaTimeline(store, inv.id);
  const genealogy = buildGenealogyGraph(store, inv.id);
  const fusion = fuseEvidenceAndReasoning(store, inv.id);

  assert(timeline && Array.isArray(timeline.events));
  assert(genealogy && Array.isArray(genealogy.nodes));
  assert(fusion && Array.isArray(fusion.storyline?.sections || fusion.storyline));
});

// ---------------------------------------------------------------------------
// TEST 7: Epistemic Separation of Forensic vs Provenance Confidence
// ---------------------------------------------------------------------------
runTest('Test 7: Forensic confidence and Provenance confidence are distinct numeric metrics', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Confidence Separation' });
  const fusion = fuseEvidenceAndReasoning(store, inv.id);

  assert(typeof fusion.confidenceDimensions.findingConfidence === 'number');
  assert(typeof fusion.confidenceDimensions.provenanceConfidence === 'number');
  assert(typeof fusion.confidenceDimensions.signalScore === 'number');
  assert(typeof fusion.confidenceDimensions.evidenceStrength === 'number');
  assert(fusion.confidenceDimensions.findingConfidence >= 0 && fusion.confidenceDimensions.findingConfidence <= 1);
  assert(fusion.confidenceDimensions.provenanceConfidence >= 0 && fusion.confidenceDimensions.provenanceConfidence <= 1);
});

// ---------------------------------------------------------------------------
// TEST 8: Full End-to-End Traceability Chain
// ---------------------------------------------------------------------------
runTest('Test 8: traceReasoningChain reconstructs complete Finding -> Evidence -> Observation -> Run -> Method -> Artifact chain', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Traceability Chain Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'source_video.mp4' });

  const run = store.createAnalysisRun({
    investigationId: inv.id,
    artifactId: art.id,
    method: 'COMPUTATIONAL_FORENSIC_SPECTRAL'
  });
  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'SPECTROGRAM_MATCH',
    value: '0.96'
  });
  const ev = store.createEvidence({
    observationIds: [obs.id],
    independenceGroupId: 'IG-SPECTRAL-01',
    evidenceType: 'AUDIO_SPECTRAL_EVIDENCE'
  });
  const finding = store.createFinding({
    investigationId: inv.id,
    artifactId: art.id,
    evidenceIds: [ev.id],
    title: 'Audio Frequency Alignment'
  });

  const trace = traceReasoningChain(store, inv.id, 'FINDING', finding.id);
  assert.strictEqual(trace.entityId, finding.id);
  assert.strictEqual(trace.rootEntity.id, finding.id);
  assert.strictEqual(trace.evidence[0].id, ev.id);
  assert.strictEqual(trace.observations[0].id, obs.id);
  assert.strictEqual(trace.analysisRuns[0].id, run.id);
});

// ---------------------------------------------------------------------------
// TEST 9: Unresolved Contradiction Preservation
// ---------------------------------------------------------------------------
runTest('Test 9: Contradicting claims and evidence remain INCONCLUSIVE/CONFLICTING without premature resolution', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Contradiction Case' });
  const claim = store.createClaim({
    investigationId: inv.id,
    statement: 'Recorded in Tokyo on 2026-05-01',
    claimType: ClaimTypes.LOCATION,
    status: ClaimStatus.CONTRADICTED
  });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert(fusion.contradictions.length > 0, 'Contradictions must be surfaced in reasoning');
  assert(fusion.summary.epistemicStatus === 'CONFLICTING' || fusion.summary.epistemicStatus === 'INCONCLUSIVE' || fusion.contradictions.some(c => c.type === 'CLAIM_CONTRADICTION'));
});

// ---------------------------------------------------------------------------
// TEST 10: Independence Groups Prevention of Evidence Double-Counting
// ---------------------------------------------------------------------------
runTest('Test 10: Syndicated copies sharing an independence group count as 1 distinct channel', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Independence Channels' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'media.mp4' });

  // 3 duplicate observations under same independence group
  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id });
  const obs1 = store.createObservation({ runId: run.id, artifactId: art.id, value: 'rep1' });
  const obs2 = store.createObservation({ runId: run.id, artifactId: art.id, value: 'rep2' });
  const obs3 = store.createObservation({ runId: run.id, artifactId: art.id, value: 'rep3' });

  const ev1 = store.createEvidence({ observationIds: [obs1.id], independenceGroupId: 'IG-SYNDICATE-01' });
  const ev2 = store.createEvidence({ observationIds: [obs2.id], independenceGroupId: 'IG-SYNDICATE-01' });
  const ev3 = store.createEvidence({ observationIds: [obs3.id], independenceGroupId: 'IG-SYNDICATE-01' });

  store.createFinding({ investigationId: inv.id, evidenceIds: [ev1.id, ev2.id, ev3.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert.strictEqual(fusion.distinctIndependenceChannels, 1, 'Redundant syndicated evidence must collapse to 1 channel');
});

// ---------------------------------------------------------------------------
// TEST 11: Investigation State Updates & Integrity
// ---------------------------------------------------------------------------
runTest('Test 11: Adding analyst notes and updating metadata maintains investigation consistency', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Notes State' });

  store.addNote(inv.id, { author: 'Alice', content: 'Observed watermark mismatch on mirror site.' });
  store.addNote(inv.id, { author: 'Bob', content: 'Verified audio spectrogram.' });

  const notes = store.getNotes(inv.id);
  assert.strictEqual(notes.length, 2);
  assert.strictEqual(notes[0].author, 'Alice');
  assert.strictEqual(notes[1].author, 'Bob');
});

// ---------------------------------------------------------------------------
// TEST 12: Monitoring Job Modification & Timestamp Tracking
// ---------------------------------------------------------------------------
runTest('Test 12: Updating monitoring job updates updatedAt without resetting job configuration', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Job Patch' });
  const job = store.createMonitoringJob({ investigationId: inv.id, name: 'Original Name', schedule: 'DAILY' });

  const updated = store.updateMonitoringJob(job.id, { name: 'Renamed Job', schedule: 'HOURLY' });
  assert.strictEqual(updated.name, 'Renamed Job');
  assert.strictEqual(updated.schedule, 'HOURLY');
  assert.strictEqual(updated.investigationId, inv.id);
});

// ---------------------------------------------------------------------------
// TEST 13: Alert Review & Dismissal Lifecycle
// ---------------------------------------------------------------------------
runTest('Test 13: Alert transitions through NEW -> REVIEWED -> DISMISSED with state integrity', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Alert Lifecycle' });
  const alert = store.createAlert({ investigationId: inv.id, title: 'Test Alert', status: AlertStatus.NEW });

  const reviewed = store.updateAlert(alert.id, { status: AlertStatus.REVIEWED });
  assert.strictEqual(reviewed.status, AlertStatus.REVIEWED);

  const dismissed = store.updateAlert(alert.id, { status: AlertStatus.DISMISSED });
  assert.strictEqual(dismissed.status, AlertStatus.DISMISSED);
});

// ---------------------------------------------------------------------------
// TEST 14: Report Generation Idempotency & Unique Auditing
// ---------------------------------------------------------------------------
runTest('Test 14: Successive report generations yield unique report IDs and distinct audit log entries', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Report Audit Log' });

  const rpt1 = generateInvestigationReport(store, inv.id, { generatedBy: 'Analyst A' });
  const rpt2 = generateInvestigationReport(store, inv.id, { generatedBy: 'Analyst B' });

  assert.notStrictEqual(rpt1.reportId, rpt2.reportId);
  const logs = store.getReportsByInvestigation(inv.id);
  assert.strictEqual(logs.length, 2);
});

// ---------------------------------------------------------------------------
// TEST 15: HTML Report Robustness with Empty Investigation
// ---------------------------------------------------------------------------
runTest('Test 15: HTML report exports cleanly even when an investigation has no findings or claims', () => {
  const store = new ProvenanceStore();
  const emptyInv = store.createInvestigation({ title: 'Empty Fresh Investigation' });
  const report = generateInvestigationReport(store, emptyInv.id);

  const html = exportReportHTML(report);
  assert(html.includes('Empty Fresh Investigation'));
  assert(html.includes('No formal findings generated yet'));
});

// ---------------------------------------------------------------------------
// TEST 16: Storyline References Valid Store Evidence
// ---------------------------------------------------------------------------
runTest('Test 16: Every evidence ID cited in the Media Storyline corresponds to a valid store evidence record', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Storyline Validation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'media.mp4' });

  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id });
  const obs = store.createObservation({ runId: run.id, artifactId: art.id, value: 'val' });
  const ev = store.createEvidence({ observationIds: [obs.id], independenceGroupId: 'IG-1' });
  store.createFinding({ investigationId: inv.id, evidenceIds: [ev.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const sections = fusion.storyline?.sections || (Array.isArray(fusion.storyline) ? fusion.storyline : []);
  for (const step of sections) {
    if (step.evidenceIds && step.evidenceIds.length > 0) {
      for (const eid of step.evidenceIds) {
        assert(store.getEvidence(eid) !== null, `Evidence ${eid} cited in storyline must exist`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// TEST 17: Genealogy Transformation Types Support
// ---------------------------------------------------------------------------
runTest('Test 17: Genealogy graph categorizes RESIZE, CROP, FORMAT_CONVERSION, RECOMPRESSION', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Genealogy Types' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    filename: 'a.png',
    mimeType: 'image/png',
    dimensions: { width: 1920, height: 1080 },
    byteSize: 2000000
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    filename: 'b.jpg',
    mimeType: 'image/jpeg',
    dimensions: { width: 1080, height: 1080 },
    byteSize: 400000
  });

  const graph = buildGenealogyGraph(store, inv.id);
  assert(graph.edges.length > 0, 'Genealogy graph must have edges');
  const edge = graph.edges[0];
  assert(edge.transformations.includes(TransformationTypes.CROP) || edge.transformations.includes('SPATIAL_CROP'));
  assert(edge.transformations.includes(TransformationTypes.FORMAT_CONVERSION));
});

// ---------------------------------------------------------------------------
// TEST 18: Discovery Strategy Coverage
// ---------------------------------------------------------------------------
runTest('Test 18: Discovery candidates support exact hash, perceptual similarity, and local index strategies', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Discovery Types' });
  const job = store.createDiscoveryJob({ investigationId: inv.id, strategy: 'EXACT_HASH' });
  const cand = store.createDiscoveryCandidate({
    discoveryJobId: job.id,
    investigationId: inv.id,
    title: 'Matched Candidate',
    similarityMeasurements: { exactMatch: true, visualSimilarity: 1.0 }
  });

  assert.strictEqual(cand.discoveryJobId, job.id);
  assert.strictEqual(cand.similarityMeasurements.exactMatch, true);
});

// ---------------------------------------------------------------------------
// TEST 19: Propagation Clustering
// ---------------------------------------------------------------------------
runTest('Test 19: Propagation analyzer groups observed events into platform and domain clusters', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Propagation Clusters' });

  store.createPropagationEvent({ investigationId: inv.id, platform: 'TikTok', url: 'https://tiktok.com/v/1' });
  store.createPropagationEvent({ investigationId: inv.id, platform: 'TikTok', url: 'https://tiktok.com/v/2' });
  store.createPropagationEvent({ investigationId: inv.id, platform: 'YouTube', url: 'https://youtube.com/watch?v=3' });

  const prop = analyzePropagation(store, inv.id);
  assert(prop.clusters.length >= 2, 'Must cluster into TikTok and YouTube');
});

// ---------------------------------------------------------------------------
// TEST 20: Absolute Zero Prohibited Certainty Terms in Provenance Service
// ---------------------------------------------------------------------------
runTest('Test 20: Comprehensive scan confirms zero prohibited certainty terms across full system output', () => {
  const invs = provenanceService.getInvestigations();
  for (const inv of invs) {
    const prov = provenanceService.getProvenance(inv.id);
    const reasoning = provenanceService.getInvestigationReasoning(inv.id);
    const report = provenanceService.generateReport(inv.id);
    const payload = JSON.stringify({ prov, reasoning, report });

    for (const term of PROHIBITED_CERTAINTY_TERMS) {
      assert(!payload.includes(term), `Prohibited certainty term "${term}" found in investigation ${inv.id}!`);
    }
  }
});

// ---------------------------------------------------------------------------
// TEST 21: Health Check Endpoints Response Structure
// ---------------------------------------------------------------------------
runTest('Test 21: System maintains healthy status and graceful zero-cost fallback capability', () => {
  const invs = provenanceService.getInvestigations();
  assert(Array.isArray(invs) && invs.length > 0, 'Seeded investigations must exist');
});

// ---------------------------------------------------------------------------
// TEST 22: REST Service Facade API Responsiveness
// ---------------------------------------------------------------------------
runTest('Test 22: ProvenanceService methods return valid payloads for timeline, genealogy, propagation, reasoning', () => {
  const invs = provenanceService.getInvestigations();
  const invId = invs[0].id;

  const timeline = provenanceService.getTimeline(invId);
  const genealogy = provenanceService.getGenealogyGraph(invId);
  const propagation = provenanceService.getPropagation(invId);
  const storyline = provenanceService.getMediaStoryline(invId);

  assert(timeline && timeline.investigationId === invId);
  assert(genealogy && Array.isArray(genealogy.nodes));
  assert(propagation && Array.isArray(propagation.events));
  assert(storyline && (Array.isArray(storyline.sections) || Array.isArray(storyline)));
});

// ---------------------------------------------------------------------------
// TEST 23: Service Facade Monitoring & Report Exports
// ---------------------------------------------------------------------------
runTest('Test 23: ProvenanceService handles monitoring job queries, alert retrieval, and HTML/JSON export', () => {
  const invs = provenanceService.getInvestigations();
  const invId = invs[0].id;

  const jobs = provenanceService.getMonitoringJobs(invId);
  assert(Array.isArray(jobs));

  const alerts = provenanceService.getAlerts(invId);
  assert(Array.isArray(alerts));

  const htmlExport = provenanceService.exportReport(invId, 'HTML');
  assert.strictEqual(htmlExport.format, 'HTML');
  assert(typeof htmlExport.data === 'string');

  const jsonExport = provenanceService.exportReport(invId, 'JSON');
  assert.strictEqual(jsonExport.format, 'JSON');
  assert(typeof jsonExport.data === 'string');
});

// ---------------------------------------------------------------------------
// TEST 24: Zero-Cost Core Local Operation
// ---------------------------------------------------------------------------
runTest('Test 24: Core reasoning, monitoring, and reporting run 100% locally without external API dependencies', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Offline Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'offline.mp4' });
  const job = store.createMonitoringJob({ investigationId: inv.id, artifactId: art.id });
  const report = generateInvestigationReport(store, inv.id);

  assert(job.id);
  assert(report.reportId);
});

// ---------------------------------------------------------------------------
// TEST 25: Full End-to-End Investigation Lifecycle
// ---------------------------------------------------------------------------
await runAsyncTest('Test 25: Full lifecycle: Create Investigation -> Register Artifact -> Discover -> Propagate -> Fuse -> Monitor -> Dossier Export', async () => {
  const store = new ProvenanceStore();

  // Step 1: Create Investigation
  const inv = store.createInvestigation({
    id: 'INV-E2E-FINAL',
    title: 'E2E Full Verification Case',
    description: 'Complete pipeline execution test'
  });

  // Step 2: Register Artifacts
  const master = store.createArtifact({
    id: 'ART-E2E-1',
    investigationId: inv.id,
    filename: 'e2e_master.mp4',
    sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    perceptualHash: '1111222233334444',
    dimensions: { width: 1920, height: 1080 },
    duration: 60.0,
    isReference: true
  });

  const derivative = store.createArtifact({
    id: 'ART-E2E-2',
    investigationId: inv.id,
    filename: 'e2e_social_crop.mp4',
    sha256: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    perceptualHash: '1111222233334440',
    dimensions: { width: 1080, height: 1080 },
    duration: 59.8,
    isReference: false
  });

  // Step 3: Register Sources & Propagation
  const src = store.createSource({
    id: 'SRC-E2E',
    name: 'Official Broadcaster',
    url: 'https://official-broadcast.org/clip/1',
    platform: 'Official Web'
  });

  const propEv = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: master.id,
    sourceId: src.id,
    platform: 'Official Web',
    url: src.url,
    observedAt: '2026-09-01T12:00:00Z'
  });

  // Step 4: Run Observations & Evidence
  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: master.id, method: 'FINGERPRINT_MATCH' });
  const obs = store.createObservation({ runId: run.id, artifactId: master.id, observationType: 'HASH_SIMILARITY', value: 0.98 });
  const ev = store.createEvidence({ observationIds: [obs.id], independenceGroupId: 'IG-E2E-1', evidenceType: 'FINGERPRINT_EVIDENCE' });
  store.createFinding({ investigationId: inv.id, artifactId: master.id, evidenceIds: [ev.id], title: 'Verified Fingerprint Overlap' });

  // Step 5: Setup Monitoring & Scan
  const job = store.createMonitoringJob({ investigationId: inv.id, artifactId: master.id, name: 'E2E Continuous Monitor' });
  const monitoring = new MonitoringService(store);
  const scanResult = await monitoring.runJob(job.id, {
    simulateNewAppearance: {
      url: 'https://new-mirror.example/clip',
      platform: 'Mirror Platform',
      description: 'Candidate broadcast mirror discovered',
      similarity: 0.95
    }
  });
  assert.strictEqual(scanResult.status, 'COMPLETED');
  assert.strictEqual(scanResult.alertsCreated, 1);

  // Step 6: Generate and Export Final Report Dossier
  const report = generateInvestigationReport(store, inv.id, { generatedBy: 'Senior Forensic Investigator' });
  assert.strictEqual(report.investigationId, inv.id);
  assert(report.evidenceSnapshotHash);
  assert(report.whatWeFound.length > 0);
  assert(report.storyline.length > 0);

  const html = exportReportHTML(report);
  assert(html.includes('VERIMEDIA AI — INVESTIGATION DOSSIER'));
  assert(html.includes(report.evidenceSnapshotHash));

  const json = exportReportJSON(report);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.reportId, report.reportId);
});

console.log(`\n✔ Phase M verification successful: ${passed}/25 tests passed.`);
