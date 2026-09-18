import assert from 'assert';
import {
  createNewInvestigation,
  getInvestigation,
  listInvestigations,
  updateInvestigation,
  addArtifactToInvestigation,
  addNoteToInvestigation,
  getNotesForInvestigation,
  getTimelineEventsForInvestigation,
  getInvestigationPackage,
  recordTimelineEvent,
  investigationsStore
} from '../server/investigations.js';
import {
  createMediaArtifact,
  createObservation,
  createEvidence,
  createFinding,
  createAnalysisRun
} from '../server/models.js';
import {
  recordObservation,
  recordEvidence,
  recordFinding,
  recordAnalysisRun,
  buildTraceabilityChain,
  artifactsStore
} from '../server/evidence.js';
import { processForensicSignalsToEvidence } from '../server/evidenceEngine.js';
import { runForensicInvestigationPipeline } from '../server/forensics.js';

console.log('----------------------------------------------------');
console.log('VeriMedia AI — Phase E Test Suite (Investigation & Case Management)');
console.log('----------------------------------------------------\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    if (err.stack) console.error(`   ${err.stack.split('\n')[1]}`);
    failed++;
  }
}

// ── Test 1: Investigation Creation & Persistence ─────────────────────
runTest('Test 1: Create investigation and verify persistence', () => {
  const inv = createNewInvestigation({
    title: 'Deepfake Ingestion Case #102',
    description: 'Investigating manipulated video feed on social network',
    priority: 'HIGH',
    tags: ['deepfake', 'video', 'urgent'],
    createdBy: 'Senior Analyst Smith',
    mode: 'REAL_INVESTIGATION'
  });

  assert.ok(inv.id.startsWith('inv_'), 'Investigation ID should have prefix inv_');
  assert.strictEqual(inv.title, 'Deepfake Ingestion Case #102');
  assert.strictEqual(inv.status, 'OPEN');
  assert.strictEqual(inv.priority, 'HIGH');
  assert.deepStrictEqual(inv.tags, ['deepfake', 'video', 'urgent']);
  assert.strictEqual(inv.createdBy, 'Senior Analyst Smith');

  const fetched = getInvestigation(inv.id);
  assert.ok(fetched, 'Investigation should be retrievable from store');
  assert.strictEqual(fetched.id, inv.id);

  const list = listInvestigations({ title: 'Deepfake' });
  assert.ok(list.some(item => item.id === inv.id), 'Investigation should appear in search results');
});

// ── Test 2: Add Real Phase B Artifact & Verify Ownership ──────────────
runTest('Test 2: Add real Phase B media artifact and verify ownership', () => {
  const inv = createNewInvestigation({
    title: 'Media Verification #103',
    createdBy: 'Analyst Jones'
  });

  const artifact = createMediaArtifact({
    filename: 'evidence_clip_01.mp4',
    mimeType: 'video/mp4',
    size: 2048500,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sourceType: 'upload'
  });
  artifactsStore.set(artifact.id, artifact);

  const updatedInv = addArtifactToInvestigation(inv.id, artifact, 'Analyst Jones', artifactsStore);
  assert.ok(updatedInv.artifactIds.includes(artifact.id), 'Artifact ID should be added to investigation artifactIds');
  assert.strictEqual(updatedInv.artifactId, artifact.id);

  const pkg = getInvestigationPackage(inv.id, artifactsStore);
  assert.ok(pkg.artifacts.some(a => a.id === artifact.id), 'Artifact should be returned in investigation package');
});

// ── Test 3: Run Forensic Analysis & Verify Investigation Visibility ──
runTest('Test 3: Run forensic analysis and verify findings/evidence visible in investigation', () => {
  const inv = createNewInvestigation({ title: 'Forensic Package Test' });
  const buffer = Buffer.from('FAKE_JPEG_IMAGE_HEADER_DATA_1234567890');
  
  const artifact = createMediaArtifact({
    filename: 'suspicious_photo.jpg',
    mimeType: 'image/jpeg',
    size: buffer.length,
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef'
  });
  artifactsStore.set(artifact.id, artifact);
  addArtifactToInvestigation(inv.id, artifact, 'Analyst', artifactsStore);

  const deepPkg = runForensicInvestigationPipeline({ artifact, buffer });

  const invPkg = getInvestigationPackage(inv.id, artifactsStore);
  assert.ok(invPkg.findings.length > 0, 'Investigation package should reflect findings from analysis');
  assert.ok(invPkg.evidence.length > 0, 'Investigation package should reflect evidence items');
  assert.ok(invPkg.observations.length > 0, 'Investigation package should reflect observations');
});

// ── Test 4: Finding Navigation Traceability ───────────────────────────
runTest('Test 4: Finding navigation traceability (Investigation -> Finding -> Evidence -> Observation)', () => {
  const artifact = createMediaArtifact({ filename: 'traceability_test.png' });
  artifactsStore.set(artifact.id, artifact);

  const run = createAnalysisRun({ artifactId: artifact.id, methodId: 'method_ela_v1' });
  recordAnalysisRun(run);

  const obs = createObservation({
    artifactId: artifact.id,
    type: 'ela_error_variance',
    value: 0.88,
    analysisRunId: run.id
  });
  recordObservation(obs);

  const evd = createEvidence({
    artifactId: artifact.id,
    observationIds: [obs.id],
    analysisRunId: run.id,
    type: 'ela_discrepancy'
  });
  recordEvidence(evd);

  const fnd = createFinding({
    artifactId: artifact.id,
    category: 'IMAGE_MANIPULATION',
    statement: 'Localized ELA error variance indicates re-compression anomaly.',
    evidenceIds: [evd.id]
  });
  recordFinding(fnd);

  const inv = createNewInvestigation({ title: 'Traceability Case' });
  addArtifactToInvestigation(inv.id, artifact, 'Analyst', artifactsStore);

  const chain = buildTraceabilityChain(fnd.id);
  assert.strictEqual(chain.finding.id, fnd.id);
  assert.strictEqual(chain.supportingEvidence[0].id, evd.id);
  assert.strictEqual(chain.supportingEvidence[0].observations[0].id, obs.id);
  assert.strictEqual(chain.supportingEvidence[0].observations[0].analysisRun.id, run.id);
});

// ── Test 5: Timeline Event Recording in Chronological Order ──────────
runTest('Test 5: Timeline event recording in chronological order', () => {
  const inv = createNewInvestigation({ title: 'Timeline Audit Test' });
  
  recordTimelineEvent({
    investigationId: inv.id,
    type: 'ANALYSIS_STARTED',
    actor: 'Forensic Engine',
    description: 'Pipeline execution initiated.'
  });

  recordTimelineEvent({
    investigationId: inv.id,
    type: 'ANALYSIS_COMPLETED',
    actor: 'Forensic Engine',
    description: 'Pipeline execution finished.'
  });

  updateInvestigation(inv.id, { status: 'IN_REVIEW' }, 'Lead Investigator');

  const timeline = getTimelineEventsForInvestigation(inv.id);
  assert.ok(timeline.length >= 4, 'Timeline should contain creation, analysis, and status change events');
  
  // Verify chronological ordering
  for (let i = 1; i < timeline.length; i++) {
    const tPrev = new Date(timeline[i - 1].timestamp).getTime();
    const tCurr = new Date(timeline[i].timestamp).getTime();
    assert.ok(tCurr >= tPrev, 'Timeline events must be strictly chronological');
  }

  assert.ok(timeline.some(e => e.type === 'STATUS_CHANGED'), 'Status change event recorded');
});

// ── Test 6: Analyst Notes Creation & Retrieval ────────────────────────
runTest('Test 6: Analyst notes creation & retrieval, clearly distinguished from evidence', () => {
  const inv = createNewInvestigation({ title: 'Analyst Notes Case' });

  const note1 = addNoteToInvestigation(inv.id, 'Spoke with copyright holder; original raw file was shot on Sony A7III.', 'Analyst Miller');
  const note2 = addNoteToInvestigation(inv.id, 'Comparing shadow vectors in frame 120 against sun angle database.', 'Analyst Miller');

  assert.ok(note1.id.startsWith('nte_'), 'Note ID prefix should be nte_');
  assert.strictEqual(note1.authorId, 'Analyst Miller');
  assert.strictEqual(note1.text, 'Spoke with copyright holder; original raw file was shot on Sony A7III.');

  const notes = getNotesForInvestigation(inv.id);
  assert.strictEqual(notes.length, 2);
  assert.strictEqual(notes[0].text, note1.text);

  const timeline = getTimelineEventsForInvestigation(inv.id);
  assert.ok(timeline.some(e => e.type === 'NOTE_ADDED'), 'Note addition should be logged in timeline');
});

// ── Test 7: Unavailable Information Appears as UNKNOWN ────────────────
runTest('Test 7: Unavailable information appears as UNKNOWN in investigation package', () => {
  const inv = createNewInvestigation({ title: 'Unknowns Test' });
  
  // Artifact without EXIF
  const artifact = createMediaArtifact({
    filename: 'no_exif_image.png',
    metadata: { hasExif: false }
  });
  artifactsStore.set(artifact.id, artifact);
  addArtifactToInvestigation(inv.id, artifact, 'Analyst', artifactsStore);

  const pkg = getInvestigationPackage(inv.id, artifactsStore);
  assert.ok(pkg.whatRemainsUnknown.length > 0, 'Unavailable metadata must appear in whatRemainsUnknown');
  assert.ok(
    pkg.whatRemainsUnknown.some(u => u.topic && u.topic.includes('EXIF')) ||
    pkg.whatRemainsUnknown.some(u => u.statement && u.statement.includes('metadata')),
    'EXIF unavailability recorded clearly'
  );
});

// ── Test 8: Conflicting Evidence Remains Separately Visible ───────────
runTest('Test 8: Conflicting evidence remains separately visible without averaging', () => {
  const inv = createNewInvestigation({ title: 'Conflict Case' });
  const artifact = createMediaArtifact({ filename: 'conflicting_file.jpg' });
  artifactsStore.set(artifact.id, artifact);
  addArtifactToInvestigation(inv.id, artifact, 'Analyst', artifactsStore);

  const obs = createObservation({ artifactId: artifact.id, type: 'fps_reading', value: 24 });
  recordObservation(obs);

  const evdConflict = createEvidence({
    artifactId: artifact.id,
    observationIds: [obs.id],
    type: 'frame_rate_variance',
    description: 'Method A indicates 24fps constant; Method B indicates 29.97fps variable container.',
    status: 'CONFLICTING',
    strength: 0.5
  });
  recordEvidence(evdConflict);

  const pkg = getInvestigationPackage(inv.id, artifactsStore);
  assert.ok(pkg.conflictingEvidence.length > 0, 'Conflicting evidence must be explicitly preserved');
  assert.strictEqual(pkg.conflictingEvidence[0].status, 'CONFLICTING');
});

// ── Test 9: Demo Isolation Policy ─────────────────────────────────────
runTest('Test 9: Demo isolation policy (demo artifacts cannot enter real investigation)', () => {
  const realInv = createNewInvestigation({
    title: 'Real Law Enforcement Case',
    mode: 'REAL_INVESTIGATION'
  });

  const demoArtifact = createMediaArtifact({
    filename: 'synthetic_demo.jpg',
    sourceType: 'demo',
    metadata: { isDemo: true }
  });

  assert.throws(() => {
    addArtifactToInvestigation(realInv.id, demoArtifact, 'Analyst', artifactsStore);
  }, /DEMO ISOLATION POLICY/, 'Attempting to add demo artifact to REAL_INVESTIGATION must throw DEMO ISOLATION POLICY error');
});

// ── Test 10: Phase A-D Regression Check ──────────────────────────────
runTest('Test 10: Phase A-D regression check (Traceability & Evidence Engine intact)', () => {
  const artifact = createMediaArtifact({ filename: 'regression_check.jpg' });
  artifactsStore.set(artifact.id, artifact);

  const run = createAnalysisRun({ artifactId: artifact.id });
  recordAnalysisRun(run);

  const obs = createObservation({ artifactId: artifact.id, type: 'test_obs', analysisRunId: run.id });
  recordObservation(obs);

  const evd = createEvidence({ artifactId: artifact.id, observationIds: [obs.id], analysisRunId: run.id });
  recordEvidence(evd);

  const fnd = createFinding({ artifactId: artifact.id, category: 'GENERAL_FORENSIC', statement: 'Regression test finding statement', evidenceIds: [evd.id] });
  recordFinding(fnd);

  const chain = buildTraceabilityChain(fnd.id);
  assert.ok(chain.finding, 'Finding present');
  assert.ok(chain.supportingEvidence.length === 1, 'Supporting evidence present');
  assert.ok(chain.supportingEvidence[0].observations.length === 1, 'Observation present');
});

console.log('\n----------------------------------------------------');
console.log(`Test Suite Complete: ${passed} Passed, ${failed} Failed`);
console.log('----------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
