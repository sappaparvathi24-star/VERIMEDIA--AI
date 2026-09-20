import assert from 'assert';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { ProvenanceStore } from '../src/provenance/core.js';
import { persistence } from '../src/db/persistence.js';

console.log('── Running VeriMedia AI Persistence Durability & SQLite Verification ──');

async function run() {
  const db = getDatabase();
  assert.ok(db, 'SQLite database connection must be active');

  const testSuffix = Date.now().toString().slice(-6);
  const invId = `INV-DURABLE-${testSuffix}`;
  const artId = `ART-DURABLE-${testSuffix}`;
  const runId = `RUN-DURABLE-${testSuffix}`;
  const obsId = `OBS-DURABLE-${testSuffix}`;
  const evdId = `EVD-DURABLE-${testSuffix}`;
  const fndId = `FND-DURABLE-${testSuffix}`;

  console.log('  1. Creating provenance entity hierarchy...');
  const store1 = new ProvenanceStore();

  // Create Investigation
  const inv = store1.createInvestigation({
    id: invId,
    title: `Durability Case ${testSuffix}`,
    description: 'Verifying SQLite durability across process restarts',
    status: 'ACTIVE',
    leadInvestigator: 'LEAD_FORENSIC_ANALYST'
  });
  assert.strictEqual(inv.id, invId);

  // Create Artifact
  const art = store1.createArtifact({
    id: artId,
    investigationId: invId,
    filename: `sample_${testSuffix}.mp4`,
    byteSize: 1048576,
    mimeType: 'video/mp4',
    sha256: 'a'.repeat(64),
    phash: '0101010101010101'
  });
  assert.strictEqual(art.id, artId);

  // Create Analysis Run
  const run = store1.createAnalysisRun({
    id: runId,
    investigationId: invId,
    artifactId: artId,
    method: 'SPECTRAL_FREQUENCY_ANALYSIS',
    parameters: { windowSize: 1024, overlap: 0.5 },
    status: 'COMPLETED'
  });
  assert.strictEqual(run.id, runId);

  // Create Observation
  const obs = store1.createObservation({
    id: obsId,
    investigationId: invId,
    runId: runId,
    artifactId: artId,
    observationType: 'SPECTRAL_ANOMALY',
    target: 'audio_high_frequencies',
    value: { cutoffHz: 16000, artificialCarrier: true },
    confidence: 0.93
  });
  assert.strictEqual(obs.id, obsId);

  // Create Evidence
  const evd = store1.createEvidence({
    id: evdId,
    investigationId: invId,
    observationIds: [obsId],
    evidenceType: 'SYNTHETIC_SPECTRUM_ARTIFACT',
    title: 'High frequency cutoff artifact detected',
    confidence: 0.91
  });
  assert.strictEqual(evd.id, evdId);

  // Create Finding
  const fnd = store1.createFinding({
    id: fndId,
    investigationId: invId,
    title: 'Synthetic Audio Manipulation Finding',
    statement: 'Audio exhibits frequency cutoff at 16kHz characteristic of neural vocoder.',
    category: 'AUDIO_INTEGRITY',
    evidenceIds: [evdId],
    confidence: 0.89,
    limitations: ['Requires validation against uncompressed reference track']
  });
  assert.strictEqual(fnd.id, fndId);

  console.log('✔ [PASS] Test 1: Created Investigation, Artifact, AnalysisRun, Observation, Evidence, Finding');

  // Verify direct SQLite reads via raw db queries
  console.log('  2. Verifying entities exist directly in SQLite tables...');
  const sqliteRun = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(runId);
  assert.ok(sqliteRun, 'Analysis run must exist in SQLite table analysis_runs');
  assert.strictEqual(sqliteRun.method_name, 'SPECTRAL_FREQUENCY_ANALYSIS');

  const sqliteObs = db.prepare('SELECT * FROM observations WHERE id = ?').get(obsId);
  assert.ok(sqliteObs, 'Observation must exist in SQLite table observations');
  assert.strictEqual(sqliteObs.observation_type, 'SPECTRAL_ANOMALY');
  assert.strictEqual(sqliteObs.confidence_score, 0.93);

  const sqliteEvd = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evdId);
  assert.ok(sqliteEvd, 'Evidence must exist in SQLite table evidence');
  assert.strictEqual(sqliteEvd.title, 'High frequency cutoff artifact detected');
  assert.strictEqual(sqliteEvd.strength_score, 0.91);

  const sqliteFnd = db.prepare('SELECT * FROM findings WHERE id = ?').get(fndId);
  assert.ok(sqliteFnd, 'Finding must exist in SQLite table findings');
  assert.strictEqual(sqliteFnd.statement, 'Audio exhibits frequency cutoff at 16kHz characteristic of neural vocoder.');
  assert.strictEqual(sqliteFnd.confidence_score, 0.89);

  console.log('✔ [PASS] Test 2: Verified raw SQLite rows in analysis_runs, observations, evidence, and findings');

  // Verify persistence.load* methods query SQLite
  console.log('  3. Verifying persistence.load* methods directly query SQLite...');
  const loadedRuns = persistence.loadAnalysisRuns({ investigationId: invId });
  assert.ok(loadedRuns.some(r => r.id === runId));

  const loadedObss = persistence.loadObservations({ investigationId: invId });
  assert.ok(loadedObss.some(o => o.id === obsId));

  const loadedEvds = persistence.loadEvidence({ investigationId: invId });
  assert.ok(loadedEvds.some(e => e.id === evdId));

  const loadedFnds = persistence.loadFindings({ investigationId: invId });
  assert.ok(loadedFnds.some(f => f.id === fndId));

  console.log('✔ [PASS] Test 3: persistence.load* methods returned SQLite records correctly');

  // Simulate process restart: create a completely fresh store and hydrate it from SQLite
  console.log('  4. Simulating process restart & store re-hydration from SQLite...');
  const store2 = new ProvenanceStore();
  assert.strictEqual(store2.investigations.has(invId), false, 'Fresh store must not have investigation yet');
  assert.strictEqual(store2.analysisRuns.has(runId), false, 'Fresh store must not have run yet');
  assert.strictEqual(store2.observations.has(obsId), false, 'Fresh store must not have observation yet');
  assert.strictEqual(store2.evidence.has(evdId), false, 'Fresh store must not have evidence yet');
  assert.strictEqual(store2.findings.has(fndId), false, 'Fresh store must not have finding yet');

  await store2.hydrate();

  assert.ok(store2.investigations.has(invId), 'Hydrated store must restore investigation from SQLite');
  assert.ok(store2.artifacts.has(artId), 'Hydrated store must restore artifact from SQLite');
  assert.ok(store2.analysisRuns.has(runId), 'Hydrated store must restore analysis run from SQLite');
  assert.ok(store2.observations.has(obsId), 'Hydrated store must restore observation from SQLite');
  assert.ok(store2.evidence.has(evdId), 'Hydrated store must restore evidence from SQLite');
  assert.ok(store2.findings.has(fndId), 'Hydrated store must restore finding from SQLite');

  const restoredObs = store2.getObservation(obsId);
  assert.strictEqual(restoredObs.observationType, 'SPECTRAL_ANOMALY');
  assert.strictEqual(restoredObs.confidence, 0.93);

  const restoredEvd = store2.getEvidence(evdId);
  assert.strictEqual(restoredEvd.title, 'High frequency cutoff artifact detected');
  assert.strictEqual(restoredEvd.confidence, 0.91);

  const restoredFnd = store2.getFinding(fndId);
  assert.strictEqual(restoredFnd.title, 'Synthetic Audio Manipulation Finding');
  assert.strictEqual(restoredFnd.confidence, 0.89);

  console.log('✔ [PASS] Test 4: Re-hydrated store successfully restored all entities from SQLite across simulated restart');

  // Verify ON CONFLICT DO UPDATE behavior
  console.log('  5. Verifying ON CONFLICT DO UPDATE updates SQLite records cleanly...');
  persistence.saveFinding({
    id: fndId,
    investigationId: invId,
    title: 'Synthetic Audio Manipulation Finding (Updated)',
    statement: 'Updated statement with conclusive secondary vocoder validation.',
    status: 'SUPPORTED',
    confidenceScore: 0.97,
    limitations: ['Validated against reference track']
  });

  const updatedSqliteFnd = db.prepare('SELECT * FROM findings WHERE id = ?').get(fndId);
  assert.strictEqual(updatedSqliteFnd.title, 'Synthetic Audio Manipulation Finding (Updated)');
  assert.strictEqual(updatedSqliteFnd.status, 'SUPPORTED');
  assert.strictEqual(updatedSqliteFnd.confidence_score, 0.97);

  console.log('✔ [PASS] Test 5: ON CONFLICT DO UPDATE verified in SQLite');

  console.log('========================================');
  console.log('Persistence Durability Test Suite: ALL PASSED');
  console.log('========================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
