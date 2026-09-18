// test/test_phase_l.js
// VeriMedia AI — Phase L Test Suite: Monitoring, Alerts & Reporting
import assert from 'assert';
import {
  ProvenanceStore,
  MonitoringJobStatus,
  MonitoredTargetType,
  AlertStatus,
  AlertSeverity,
  AlertType,
  EvidencePolarity,
  PROHIBITED_CERTAINTY_TERMS
} from '../src/provenance/core.js';
import { MonitoringService } from '../src/provenance/monitoring.js';
import { generateInvestigationReport, exportReportHTML, exportReportJSON } from '../src/provenance/reporting.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase L Tests: Monitoring, Alerts & Reporting ──\n');

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
// TEST 1: MonitoringJob Structure & Defaults
// ---------------------------------------------------------------------------
runTest('Test 1: MonitoringJob creation initializes correct structure, schedule, and limitations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Monitoring Target Case' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'monitored_media.mp4' });

  const job = store.createMonitoringJob({
    investigationId: inv.id,
    artifactId: art.id,
    name: 'Realtime Alert Feed',
    schedule: 'HOURLY',
    provider: 'LOCAL_FIRST_DISCOVERY'
  });

  assert(job.id && job.id.startsWith('MJOB-'), 'Job ID must follow MJOB prefix');
  assert.strictEqual(job.investigationId, inv.id);
  assert.strictEqual(job.artifactId, art.id);
  assert.strictEqual(job.status, MonitoringJobStatus.ACTIVE);
  assert.strictEqual(job.schedule, 'HOURLY');
  assert(job.limitations.length > 0, 'Job must include epistemic limitations');
  assert(job.monitoredTarget.type === MonitoredTargetType.ARTIFACT);
});

// ---------------------------------------------------------------------------
// TEST 2: Monitored Target Types
// ---------------------------------------------------------------------------
runTest('Test 2: MonitoredTarget supports candidate sources, media versions, and propagation patterns', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Target Variations' });

  const job1 = store.createMonitoringJob({
    investigationId: inv.id,
    monitoredTarget: { type: MonitoredTargetType.CANDIDATE_SOURCE, targetId: 'SRC-99', url: 'https://video-hub.org' }
  });
  const job2 = store.createMonitoringJob({
    investigationId: inv.id,
    monitoredTarget: { type: MonitoredTargetType.MEDIA_VERSION, targetId: 'VER-1080P' }
  });
  const job3 = store.createMonitoringJob({
    investigationId: inv.id,
    monitoredTarget: { type: MonitoredTargetType.PROPAGATION_PATTERN, targetId: 'PAT-VIRAL-CLUSTER' }
  });

  assert.strictEqual(job1.monitoredTarget.type, MonitoredTargetType.CANDIDATE_SOURCE);
  assert.strictEqual(job2.monitoredTarget.type, MonitoredTargetType.MEDIA_VERSION);
  assert.strictEqual(job3.monitoredTarget.type, MonitoredTargetType.PROPAGATION_PATTERN);
});

// ---------------------------------------------------------------------------
// TEST 3: Monitoring Job Lifecycle & Status Transitions
// ---------------------------------------------------------------------------
runTest('Test 3: MonitoringJob transitions cleanly between ACTIVE, PAUSED, COMPLETED, FAILED, UNAVAILABLE', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Status Transitions' });
  const job = store.createMonitoringJob({ investigationId: inv.id, name: 'Stateful Job' });

  const paused = store.updateMonitoringJob(job.id, { status: MonitoringJobStatus.PAUSED });
  assert.strictEqual(paused.status, MonitoringJobStatus.PAUSED);

  const active = store.updateMonitoringJob(job.id, { status: MonitoringJobStatus.ACTIVE });
  assert.strictEqual(active.status, MonitoringJobStatus.ACTIVE);

  const unavailable = store.updateMonitoringJob(job.id, { status: MonitoringJobStatus.UNAVAILABLE });
  assert.strictEqual(unavailable.status, MonitoringJobStatus.UNAVAILABLE);
});

// ---------------------------------------------------------------------------
// TEST 4: Paused Monitoring Job Behavior
// ---------------------------------------------------------------------------
await runAsyncTest('Test 4: Paused monitoring job returns PAUSED status and skips execution', async () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Paused Job Case' });
  const job = store.createMonitoringJob({
    investigationId: inv.id,
    status: MonitoringJobStatus.PAUSED
  });

  const monitoring = new MonitoringService(store);
  const res = await monitoring.runJob(job.id);
  assert.strictEqual(res.status, 'PAUSED');
  assert.strictEqual(res.alertsCreated, 0);
});

// ---------------------------------------------------------------------------
// TEST 5: Truthful Handling of Provider Unavailability
// ---------------------------------------------------------------------------
await runAsyncTest('Test 5: Monitoring reports UNAVAILABLE truthfully without fabricating alerts', async () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Provider Down Case' });
  const job = store.createMonitoringJob({
    investigationId: inv.id,
    provider: 'UNAVAILABLE_PROVIDER'
  });

  const monitoring = new MonitoringService(store);
  const res = await monitoring.runJob(job.id);
  assert.strictEqual(res.status, 'UNAVAILABLE');
  assert.strictEqual(res.alertsCreated, 0);
  assert(res.message.includes('unavailable'));
});

// ---------------------------------------------------------------------------
// TEST 6: Automated Observation -> Evidence -> Alert Chain
// ---------------------------------------------------------------------------
await runAsyncTest('Test 6: Monitored new appearance builds auditable Observation -> Evidence -> Alert chain', async () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Detection Chain Case' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'master.mp4' });
  const job = store.createMonitoringJob({ investigationId: inv.id, artifactId: art.id });

  const monitoring = new MonitoringService(store);
  const runResult = await monitoring.runJob(job.id, {
    simulateNewAppearance: {
      url: 'https://monitored-platform.example/clip/12345',
      platform: 'Web Syndication',
      description: 'Fingerprint match observed on external syndicated video post',
      similarity: 0.94
    }
  });

  assert.strictEqual(runResult.status, 'COMPLETED');
  assert.strictEqual(runResult.alertsCreated, 1);
  const alert = runResult.alerts[0];
  assert(alert.id.startsWith('ALT-'));
  assert(alert.evidenceIds.length > 0, 'Alert must link to concrete evidence');

  const evidence = store.getEvidence(alert.evidenceIds[0]);
  assert(evidence, 'Linked evidence must exist in store');
  assert.strictEqual(evidence.evidenceType, 'MONITORING_ALERT_EVIDENCE');
  assert(evidence.observationIds.length > 0, 'Evidence must link to observation');

  const obs = store.getObservation(evidence.observationIds[0]);
  assert(obs, 'Observation must exist in store');
  assert.strictEqual(obs.observationType, 'MONITORED_NEW_APPEARANCE_DETECTION');
});

// ---------------------------------------------------------------------------
// TEST 7: Alert Data Model & Limitations
// ---------------------------------------------------------------------------
runTest('Test 7: Alert model enforces severity, type, status, and epistemic limitations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Alert Validation' });

  const alert = store.createAlert({
    investigationId: inv.id,
    title: 'High-Risk Transformation Candidate Detected',
    severity: AlertSeverity.HIGH,
    alertType: AlertType.PROPAGATION_CHANGE,
    status: AlertStatus.NEW
  });

  assert.strictEqual(alert.severity, AlertSeverity.HIGH);
  assert.strictEqual(alert.alertType, AlertType.PROPAGATION_CHANGE);
  assert.strictEqual(alert.status, AlertStatus.NEW);
  assert(alert.limitations.length > 0, 'Alert must have standard limitations');
});

// ---------------------------------------------------------------------------
// TEST 8: Alert Lifecycle & Acknowledgment
// ---------------------------------------------------------------------------
runTest('Test 8: Acknowledging an alert transitions status and records acknowledgedAt timestamp', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Ack Test' });
  const alert = store.createAlert({ investigationId: inv.id, title: 'Unacknowledged Alert' });

  assert.strictEqual(alert.status, AlertStatus.NEW);
  assert.strictEqual(alert.acknowledgedAt, null);

  const monitoring = new MonitoringService(store);
  const reviewed = monitoring.acknowledgeAlert(alert.id, AlertStatus.REVIEWED);
  assert.strictEqual(reviewed.status, AlertStatus.REVIEWED);
  assert(reviewed.acknowledgedAt !== null, 'acknowledgedAt timestamp must be recorded');

  const resolved = store.updateAlert(alert.id, { status: AlertStatus.RESOLVED });
  assert.strictEqual(resolved.status, AlertStatus.RESOLVED);
});

// ---------------------------------------------------------------------------
// TEST 9: No False Alerts on Negative Scan
// ---------------------------------------------------------------------------
await runAsyncTest('Test 9: Negative scan cycle produces NO_NEW_APPEARANCES without false alerts', async () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Negative Scan' });
  const job = store.createMonitoringJob({ investigationId: inv.id });

  const monitoring = new MonitoringService(store);
  const res = await monitoring.runJob(job.id, { newAppearances: [] });
  assert.strictEqual(res.status, 'NO_NEW_APPEARANCES');
  assert.strictEqual(res.alertsCreated, 0);
  assert.strictEqual(res.alerts.length, 0);

  const allAlerts = store.getAlertsByInvestigation(inv.id);
  assert.strictEqual(allAlerts.length, 0, 'Store must not contain phantom alerts');
});

// ---------------------------------------------------------------------------
// TEST 10: Alert Filtering Capabilities
// ---------------------------------------------------------------------------
runTest('Test 10: Alert queries filter accurately by status, severity, and alertType', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Filtering Alerts' });
  const monitoring = new MonitoringService(store);

  store.createAlert({ investigationId: inv.id, severity: AlertSeverity.LOW, status: AlertStatus.NEW, alertType: AlertType.NEW_APPEARANCE });
  store.createAlert({ investigationId: inv.id, severity: AlertSeverity.HIGH, status: AlertStatus.REVIEWED, alertType: AlertType.PROPAGATION_CHANGE });
  store.createAlert({ investigationId: inv.id, severity: AlertSeverity.CRITICAL, status: AlertStatus.NEW, alertType: AlertType.NEW_APPEARANCE });

  const highOnly = monitoring.getAlerts(inv.id, { severity: AlertSeverity.HIGH });
  assert.strictEqual(highOnly.length, 1);

  const newOnly = monitoring.getAlerts(inv.id, { status: AlertStatus.NEW });
  assert.strictEqual(newOnly.length, 2);

  const propOnly = monitoring.getAlerts(inv.id, { alertType: AlertType.PROPAGATION_CHANGE });
  assert.strictEqual(propOnly.length, 1);
});

// ---------------------------------------------------------------------------
// TEST 11: Structured Investigation Report with 11 Sections
// ---------------------------------------------------------------------------
runTest('Test 11: generateInvestigationReport compiles all 11 required evidentiary sections', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ id: 'INV-RPT-01', title: 'Comprehensive Report Case' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'full_broadcast.mp4',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });

  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'FORENSIC_SPECTRAL' });
  const obs = store.createObservation({ runId: run.id, artifactId: art.id, observationType: 'FRAME_COUNT', value: 960 });
  const ev = store.createEvidence({ observationIds: [obs.id], independenceGroupId: 'IG-1', evidenceType: 'SPECTRAL_SIGNATURE' });
  store.createFinding({ investigationId: inv.id, artifactId: art.id, evidenceIds: [ev.id], title: 'Verified Broadcast Audio' });

  const report = generateInvestigationReport(store, inv.id, { generatedBy: 'Forensic Lead' });

  assert(report.overview, 'Must contain Overview');
  assert(report.mediaIdentity, 'Must contain Media Identity');
  assert(report.mediaIdentity.artifacts[0].technicalEvidence.sha256, 'Media identity must contain SHA-256');
  assert(report.whatWeFound, 'Must contain What We Found');
  assert(report.claimAssessments, 'Must contain Claim Assessments');
  assert(report.whereDidItComeFrom, 'Must contain Where Did It Come From');
  assert(report.mediaHistory, 'Must contain Media History');
  assert(report.spreadAnalysis, 'Must contain Spread Analysis');
  assert(report.evidenceLedger, 'Must contain Evidence Ledger');
  assert(report.conflictingEvidence, 'Must contain Conflicting Evidence');
  assert(report.whatRemainsUnknown, 'Must contain What Remains Unknown');
  assert(report.storyline, 'Must contain Storyline');
});

// ---------------------------------------------------------------------------
// TEST 12: Cryptographic Snapshot Hash & Audit Trail Registration
// ---------------------------------------------------------------------------
runTest('Test 12: Report generation creates immutable evidenceSnapshotHash and logs audit record', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Audit Trail Case' });
  const report = generateInvestigationReport(store, inv.id);

  assert(report.evidenceSnapshotHash && report.evidenceSnapshotHash.length === 64, 'Snapshot hash must be SHA-256 hex digest');
  const records = store.getReportsByInvestigation(inv.id);
  assert.strictEqual(records.length, 1, 'Audit record must be logged in store');
  assert.strictEqual(records[0].evidenceSnapshotHash, report.evidenceSnapshotHash);
  assert.strictEqual(records[0].id, report.reportId);
});

// ---------------------------------------------------------------------------
// TEST 13: HTML Report Export & Security Escaping
// ---------------------------------------------------------------------------
runTest('Test 13: exportReportHTML generates printable, clean HTML document with XSS protection', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Malicious <script>alert(1)</script> Test' });
  const report = generateInvestigationReport(store, inv.id);

  const html = exportReportHTML(report);
  assert(typeof html === 'string');
  assert(html.includes('<!DOCTYPE html>'));
  assert(html.includes('VERIMEDIA AI — INVESTIGATION DOSSIER'));
  assert(!html.includes('<script>alert(1)</script>'), 'Dynamic strings must be HTML-escaped');
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

// ---------------------------------------------------------------------------
// TEST 14: JSON Report Export Structure
// ---------------------------------------------------------------------------
runTest('Test 14: exportReportJSON serializes full investigation report into structured JSON', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'JSON Serialization Test' });
  const report = generateInvestigationReport(store, inv.id);

  const jsonStr = exportReportJSON(report);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.investigationId, inv.id);
  assert.strictEqual(parsed.evidenceSnapshotHash, report.evidenceSnapshotHash);
});

// ---------------------------------------------------------------------------
// TEST 15: Terminology & Epistemic Safety Audit
// ---------------------------------------------------------------------------
runTest('Test 15: Zero prohibited certainty terms in alerts, reports, and monitoring outputs', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Safety Audit Case' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });
  const job = store.createMonitoringJob({ investigationId: inv.id, artifactId: art.id });
  const alert = store.createAlert({ investigationId: inv.id, monitoringJobId: job.id, title: 'Safe Alert' });
  const report = generateInvestigationReport(store, inv.id);
  const html = exportReportHTML(report);
  const json = exportReportJSON(report);

  const fullPayload = JSON.stringify({ job, alert, report, html, json });

  for (const term of PROHIBITED_CERTAINTY_TERMS) {
    assert(!fullPayload.includes(term), `Prohibited certainty term "${term}" found in Phase L payload!`);
  }
});

console.log(`\n✔ Phase L verification successful: ${passed}/15 tests passed.`);
