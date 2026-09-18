'use strict';

import assert from 'assert';
import {
  createMediaArtifact,
  createObservation,
  createEvidence,
  createFinding,
  createAnalysisRun,
  createInvestigation
} from '../server/models.js';
import {
  observationsStore,
  evidenceStore,
  findingsStore,
  analysisRunsStore,
  clearStores,
  validateAndCreateObservation,
  validateAndCreateEvidence,
  validateAndCreateFinding,
  recordObservation,
  recordEvidence,
  recordFinding,
  recordAnalysisRun,
  getObservationsForArtifact,
  getEvidenceForArtifact,
  getFindingsForArtifact,
  getAnalysisRunsForArtifact,
  buildTraceabilityChain,
  processForensicSignalsToEvidence
} from '../server/evidenceEngine.js';
import { getAllMethods, getMethod } from '../server/methods.js';
import { ingestMediaBuffer } from '../server/media.js';

console.log('====================================================');
console.log('🧪 RUNNING VERIMEDIA AI PHASE C EVIDENCE ENGINE TESTS');
console.log('====================================================\n');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✅ [TEST ${totalCount}] PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [TEST ${totalCount}] FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Clear stores before starting
clearStores();
const mockArtifactsStore = new Map();

// ── Test 1: Real Media Ingestion produces verified MediaArtifact ──
runTest('Phase B Media Ingestion produces valid MediaArtifact with SHA-256 and pHash', () => {
  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, 0x20,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x46, 0x21, 0x82, 0xCE
  ]);
  const result = ingestMediaBuffer({
    buffer: samplePngBuffer,
    filename: 'test_image.png',
    claimedMime: 'image/png'
  });

  assert(result.artifact, 'Must return an artifact');
  assert.strictEqual(result.artifact.mimeType, 'image/png');
  assert.strictEqual(result.artifact.metadata.width, 64);
  assert.strictEqual(result.artifact.metadata.height, 32);
  assert(result.artifact.sha256 && result.artifact.sha256.length === 64, 'Must have valid SHA-256');
  assert(result.artifact.perceptualHash, 'Must have perceptual hash');
  assert(result.observations.length > 0, 'Must produce observations in Evidence Engine');
  assert(result.evidence.length > 0, 'Must produce evidence items in Evidence Engine');
  assert(result.findings.length > 0, 'Must produce findings in Evidence Engine');

  mockArtifactsStore.set(result.artifact.id, result.artifact);
});

// ── Test 2: Observation Validation & Ledger Recording ──
runTest('validateAndCreateObservation validates artifactId, type, status, and methodId', () => {
  const art = Array.from(mockArtifactsStore.values())[0];

  // Missing artifact
  const invalid1 = validateAndCreateObservation({ type: 'sample_metric' }, mockArtifactsStore);
  assert.strictEqual(invalid1.valid, false);

  // Invalid artifact ID
  const invalid2 = validateAndCreateObservation({ artifactId: 'non_existent_art', type: 'sample' }, mockArtifactsStore);
  assert.strictEqual(invalid2.valid, false);

  // Invalid status
  const invalid3 = validateAndCreateObservation({ artifactId: art.id, type: 'sample', status: 'INVALID_STATUS' }, mockArtifactsStore);
  assert.strictEqual(invalid3.valid, false);

  // Invalid methodId
  const invalid4 = validateAndCreateObservation({ artifactId: art.id, type: 'sample', status: 'OBSERVED', methodId: 'non_existent_method' }, mockArtifactsStore);
  assert.strictEqual(invalid4.valid, false);

  // Valid OBSERVED
  const valid1 = validateAndCreateObservation({
    artifactId: art.id,
    type: 'pixel_grid_uniformity',
    value: 0.98,
    unit: 'ratio',
    status: 'OBSERVED',
    methodId: 'method_media_identity_v1'
  }, mockArtifactsStore);
  assert.strictEqual(valid1.valid, true);
  assert.strictEqual(valid1.observation.value, 0.98);
  recordObservation(valid1.observation);

  // Valid UNKNOWN (value must be nullified)
  const valid2 = validateAndCreateObservation({
    artifactId: art.id,
    type: 'exif_location_gps',
    value: 'some_spoofed_val',
    status: 'UNKNOWN',
    methodId: 'method_metadata_extract_v1'
  }, mockArtifactsStore);
  assert.strictEqual(valid2.valid, true);
  assert.strictEqual(valid2.observation.value, null, 'UNKNOWN observation value must be null');
  recordObservation(valid2.observation);
});

// ── Test 3: Evidence Validation & Observation Linkage ──
runTest('validateAndCreateEvidence enforces valid observation linkage and supported statuses', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const observations = getObservationsForArtifact(art.id);
  assert(observations.length >= 2, 'Must have at least 2 recorded observations');

  // Empty observation IDs
  const invalid1 = validateAndCreateEvidence({ artifactId: art.id, observationIds: [] }, mockArtifactsStore);
  assert.strictEqual(invalid1.valid, false);

  // Non-existent observation ID
  const invalid2 = validateAndCreateEvidence({ artifactId: art.id, observationIds: ['obs_ghost_123'] }, mockArtifactsStore);
  assert.strictEqual(invalid2.valid, false);

  // Valid SUPPORTED evidence
  const valid1 = validateAndCreateEvidence({
    artifactId: art.id,
    observationIds: [observations[0].id],
    type: 'pixel_integrity',
    strength: 0.95,
    status: 'SUPPORTED',
    limitations: 'Spatial grid sampling resolution limits fine detail detection.'
  }, mockArtifactsStore);
  assert.strictEqual(valid1.valid, true);
  recordEvidence(valid1.evidence);

  // Valid CONFLICTING evidence
  const valid2 = validateAndCreateEvidence({
    artifactId: art.id,
    observationIds: [observations[0].id],
    type: 'frequency_anomaly',
    strength: 0.60,
    status: 'CONFLICTING',
    limitations: 'High-frequency noise can be affected by lossy downsampling.'
  }, mockArtifactsStore);
  assert.strictEqual(valid2.valid, true);
  recordEvidence(valid2.evidence);

  // Valid INCONCLUSIVE evidence
  const valid3 = validateAndCreateEvidence({
    artifactId: art.id,
    observationIds: [observations[1].id],
    type: 'metadata_provenance',
    strength: 0.30,
    status: 'INCONCLUSIVE',
    limitations: 'External origin cannot be validated without indexed timestamp matches.'
  }, mockArtifactsStore);
  assert.strictEqual(valid3.valid, true);
  recordEvidence(valid3.evidence);
});

// ── Test 4: Finding Validation & Evidence Linkage ──
runTest('validateAndCreateFinding enforces valid evidence linkage and epistemic statuses', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const evidenceList = getEvidenceForArtifact(art.id);
  assert(evidenceList.length >= 1, 'Must have recorded evidence');

  // Missing category / statement
  const invalid1 = validateAndCreateFinding({ artifactId: art.id, evidenceIds: [evidenceList[0].id] }, mockArtifactsStore);
  assert.strictEqual(invalid1.valid, false);

  // Non-existent evidence ID
  const invalid2 = validateAndCreateFinding({
    artifactId: art.id,
    category: 'MEDIA_INTEGRITY',
    statement: 'Sample statement',
    evidenceIds: ['evd_ghost_456']
  }, mockArtifactsStore);
  assert.strictEqual(invalid2.valid, false);

  // Valid finding with INCONCLUSIVE epistemic status
  const validFinding = validateAndCreateFinding({
    artifactId: art.id,
    category: 'MEDIA_INTEGRITY',
    statement: 'Pixel structure indicates baseline uniform encoding without localized tamper spikes.',
    evidenceIds: [evidenceList[0].id],
    confidence: 0.88,
    epistemicStatus: 'SUPPORTED',
    limitations: 'Limited to discrete 8x8 block resolution.'
  }, mockArtifactsStore);
  assert.strictEqual(validFinding.valid, true);
  recordFinding(validFinding.finding);
});

// ── Test 5: Full Traceability Chain Generation ──
runTest('buildTraceabilityChain resolves full trace Finding -> Evidence -> Observation -> AnalysisRun -> Method -> Artifact', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const findings = getFindingsForArtifact(art.id);
  assert(findings.length > 0, 'Must have recorded findings');

  const testFinding = findings[0];
  const chain = buildTraceabilityChain(testFinding.id, mockArtifactsStore);

  assert(chain, 'Traceability chain must be returned');
  assert.strictEqual(chain.finding.id, testFinding.id);
  assert.strictEqual(chain.artifact.id, art.id);
  assert(Array.isArray(chain.supportingEvidence), 'Must have supportingEvidence array');
  assert(chain.supportingEvidence.length > 0, 'Must have at least one supporting evidence');

  const firstEvd = chain.supportingEvidence[0];
  assert(Array.isArray(firstEvd.observations), 'Evidence must have underlying observations');
  assert(firstEvd.observations.length > 0, 'Underlying observations must be populated');

  const firstObs = firstEvd.observations[0];
  assert(firstObs.analysisMethod || firstObs.analysisRun, 'Observations must link to analysisMethod or run');
  assert(chain.traceabilitySummary, 'Must include traceability summary');
  assert(chain.traceabilitySummary.evidenceCount > 0);
  assert(chain.traceabilitySummary.observationsCount > 0);
});

// ── Test 6: Method Registry Coverage ──
runTest('Analysis Methods Registry contains standard verifiable methods', () => {
  const methods = getAllMethods();
  assert(Array.isArray(methods), 'Must return array of methods');
  assert(methods.length >= 6, 'Must have at least 6 registered analysis methods');

  const identityMethod = getMethod('method_media_identity_v1');
  assert(identityMethod, 'Must have method_media_identity_v1');
  assert.strictEqual(identityMethod.epistemicCategory, 'CRYPTOGRAPHIC_MEASUREMENT');

  const jpegMethod = getMethod('method_jpeg_artifact_v1');
  assert(jpegMethod, 'Must have method_jpeg_artifact_v1');
  assert.strictEqual(jpegMethod.epistemicCategory, 'COMPRESSION_STATISTICAL_HEURISTIC');
});

// ── Test 7: AnalysisRuns Management ──
runTest('AnalysisRuns are recorded and retrievable per artifact', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const runs = getAnalysisRunsForArtifact(art.id);
  assert(Array.isArray(runs), 'Must return array of analysis runs');
  assert(runs.length > 0, 'Must have recorded analysis runs from ingestion');

  const newRun = createAnalysisRun({
    artifactId: art.id,
    analysisType: 'CUSTOM_INSPECTION_RUN',
    status: 'COMPLETED',
    methodId: 'method_media_identity_v1',
    resultSummary: 'Custom run summary for test'
  });
  recordAnalysisRun(newRun);

  const updatedRuns = getAnalysisRunsForArtifact(art.id);
  assert.strictEqual(updatedRuns.length, runs.length + 1);
});

// ── Test 8: Epistemic Integrity & Absence of Fabrication ──
runTest('Unknown/missing properties are recorded as UNKNOWN without hallucinating', () => {
  const syntheticArtifact = createMediaArtifact({
    id: 'art_synthetic_test_01',
    filename: 'unlabeled_sample.bin',
    mimeType: 'application/octet-stream',
    size: 1024,
    sha256: 'a'.repeat(64),
    perceptualHash: '0'.repeat(16),
    metadata: { hasExif: false }
  });

  const pkg = processForensicSignalsToEvidence({
    artifact: syntheticArtifact,
    rawSignals: {},
    mode: 'REAL_INVESTIGATION'
  });

  const exifObs = pkg.observations.find(o => o.type === 'exif_camera_metadata');
  assert(exifObs, 'Must record EXIF observation');
  assert.strictEqual(exifObs.status, 'UNKNOWN', 'Missing EXIF must have status UNKNOWN');
  assert.strictEqual(exifObs.value, null, 'UNKNOWN observation value must be null');
});

// ── Test 9: Conflicting Forensic Signal Handling ──
runTest('High JPEG discrepancy produces INCONCLUSIVE finding rather than unsupported assertion', () => {
  const suspiciousArtifact = createMediaArtifact({
    id: 'art_suspicious_test_02',
    filename: 'compressed_patch.jpg',
    mimeType: 'image/jpeg',
    size: 2048,
    sha256: 'b'.repeat(64),
    perceptualHash: 'f'.repeat(16)
  });

  const pkg = processForensicSignalsToEvidence({
    artifact: suspiciousArtifact,
    rawSignals: {
      jpegArtifacts: 0.82 // High quantization difference
    },
    mode: 'REAL_INVESTIGATION'
  });

  const jpegFinding = pkg.findings.find(f => f.category === 'COMPRESSION_ANALYSIS');
  assert(jpegFinding, 'Must record COMPRESSION_ANALYSIS finding');
  assert.strictEqual(jpegFinding.epistemicStatus, 'INCONCLUSIVE', 'Quantization anomaly alone must remain INCONCLUSIVE');
  assert(jpegFinding.limitations.length > 0, 'Must state limitations');
});

// ── Test 10: Mode Separation (REAL_INVESTIGATION vs DEMO_SCENARIO) ──
runTest('Demo artifacts are explicitly marked as DEMO_SCENARIO', () => {
  const demoArtifact = createMediaArtifact({
    id: 'demo_art_test_03',
    filename: 'synthetic_crop.mp4',
    mimeType: 'video/mp4',
    size: 4096,
    sha256: 'c'.repeat(64),
    perceptualHash: 'e'.repeat(16),
    sourceType: 'demo'
  });

  const pkg = processForensicSignalsToEvidence({
    artifact: demoArtifact,
    rawSignals: {
      frameConsistency: 0.40
    },
    mode: 'DEMO_SCENARIO'
  });

  assert(pkg.observations.every(o => o.metadata.mode === 'DEMO_SCENARIO'));
  assert(pkg.evidence.every(e => e.metadata.mode === 'DEMO_SCENARIO'));
  assert(pkg.findings.every(f => f.metadata.mode === 'DEMO_SCENARIO'));
});

// ── Test 11: End-to-End Ingestion Data Model Consistency ──
runTest('ingestMediaBuffer generates complete investigation record with linked evidence and runs', () => {
  const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9]);
  const ingResult = ingestMediaBuffer({
    buffer: jpegBuf,
    filename: 'camera_capture.jpg',
    claimedMime: 'image/jpeg'
  });

  assert(ingResult.investigation, 'Must create investigation');
  assert(ingResult.investigation.status === 'INGESTED' || ingResult.investigation.status === 'COMPLETED');
  assert(ingResult.investigation.findings.length > 0);
  assert(ingResult.investigation.evidence.length > 0);
  assert(ingResult.investigation.observations.length > 0);
  assert(ingResult.investigation.analysisRuns.length > 0);
});

// ── Test 12: Biometric Forensics Signal Adaptation ──
runTest('Biometric signal adaptation handles facial boundary alignment without fabrication', () => {
  const faceArtifact = createMediaArtifact({
    id: 'art_face_test_04',
    filename: 'portrait.png',
    mimeType: 'image/png',
    size: 8192,
    sha256: 'd'.repeat(64),
    perceptualHash: '1'.repeat(16)
  });

  const pkg = processForensicSignalsToEvidence({
    artifact: faceArtifact,
    rawSignals: {
      faceLandmarks: 0.35 // Anomaly in facial boundary
    },
    mode: 'REAL_INVESTIGATION'
  });

  const faceFinding = pkg.findings.find(f => f.category === 'BIOMETRIC_ANALYSIS');
  assert(faceFinding, 'Must create BIOMETRIC_ANALYSIS finding');
  assert.strictEqual(faceFinding.epistemicStatus, 'INCONCLUSIVE');
  assert(faceFinding.statement.includes('Facial boundary anomaly detected'));
});

// ── Test 13: Temporal Cadence Video Forensics Signal Adaptation ──
runTest('Temporal motion vector signal adaptation properly detects cadence irregularities', () => {
  const videoArtifact = createMediaArtifact({
    id: 'art_video_test_05',
    filename: 'action_clip.mp4',
    mimeType: 'video/mp4',
    size: 16384,
    sha256: 'e'.repeat(64),
    perceptualHash: '2'.repeat(16)
  });

  const pkg = processForensicSignalsToEvidence({
    artifact: videoArtifact,
    rawSignals: {
      frameConsistency: 0.95 // Smooth, continuous flow
    },
    mode: 'REAL_INVESTIGATION'
  });

  const temporalFinding = pkg.findings.find(f => f.category === 'TEMPORAL_ANALYSIS');
  assert(temporalFinding, 'Must create TEMPORAL_ANALYSIS finding');
  assert.strictEqual(temporalFinding.epistemicStatus, 'SUPPORTED');
  assert(temporalFinding.statement.includes('consistent'));
});

// ── Test 14: Independence Group Tracking on Evidence ──
runTest('Evidence items record independence groups for cross-corroboration', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const evidenceList = getEvidenceForArtifact(art.id);

  const cryptoEvd = evidenceList.find(e => e.type === 'cryptographic_identity');
  assert(cryptoEvd, 'Must have cryptographic_identity evidence');
  assert.strictEqual(cryptoEvd.independenceGroup, 'byte_level_hashing');

  const pHashEvd = evidenceList.find(e => e.type === 'perceptual_invariant');
  assert(pHashEvd, 'Must have perceptual_invariant evidence');
  assert.strictEqual(pHashEvd.independenceGroup, 'perceptual_distance');
});

// ── Test 15: Limitations are Mandatorily Preserved ──
runTest('All generated Evidence and Findings contain non-empty limitations caveats', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const evidenceList = getEvidenceForArtifact(art.id);
  const findingsList = getFindingsForArtifact(art.id);

  for (const evd of evidenceList) {
    assert(typeof evd.limitations === 'string' && evd.limitations.length > 0, `Evidence ${evd.id} must have limitations caveat`);
  }

  for (const fnd of findingsList) {
    assert(typeof fnd.limitations === 'string' && fnd.limitations.length > 0, `Finding ${fnd.id} must have limitations caveat`);
  }
});

// ── Test 16: Non-circular Data Relations ──
runTest('Traceability chains have no cyclical loops and resolve cleanly', () => {
  const art = Array.from(mockArtifactsStore.values())[0];
  const findings = getFindingsForArtifact(art.id);

  for (const fnd of findings) {
    const chain = buildTraceabilityChain(fnd.id, mockArtifactsStore);
    assert(chain, `Traceability chain for ${fnd.id} must resolve`);
    assert.strictEqual(chain.finding.id, fnd.id);
  }
});

// ── Test 17: Investigation Store Isolation and Clean Querying ──
runTest('Evidence Engine stores support multi-artifact query isolation without cross-pollution', () => {
  const artA = createMediaArtifact({ id: 'art_isolated_A', filename: 'A.png', mimeType: 'image/png', size: 100, sha256: '1'.repeat(64), perceptualHash: '1'.repeat(16) });
  const artB = createMediaArtifact({ id: 'art_isolated_B', filename: 'B.png', mimeType: 'image/png', size: 200, sha256: '2'.repeat(64), perceptualHash: '2'.repeat(16) });

  mockArtifactsStore.set(artA.id, artA);
  mockArtifactsStore.set(artB.id, artB);

  processForensicSignalsToEvidence({ artifact: artA, mode: 'REAL_INVESTIGATION' });
  processForensicSignalsToEvidence({ artifact: artB, mode: 'REAL_INVESTIGATION' });

  const obsA = getObservationsForArtifact(artA.id);
  const obsB = getObservationsForArtifact(artB.id);

  assert(obsA.length > 0 && obsB.length > 0);
  assert(obsA.every(o => o.artifactId === artA.id), 'Observations for A must only belong to A');
  assert(obsB.every(o => o.artifactId === artB.id), 'Observations for B must only belong to B');
});

console.log('\n====================================================');
console.log(`📊 PHASE C REGRESSION RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
console.log('====================================================\n');
