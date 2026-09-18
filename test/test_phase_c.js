// test/test_phase_c.js
// VeriMedia AI — Phase C Regression: Evidence Engine

import assert from 'assert';
import { ProvenanceStore, EvidencePolarity, FindingStatus } from '../src/provenance/core.js';

console.log('── Running VeriMedia AI Phase C Tests (Evidence Engine) ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Phase C Test ${passed}: ${name}`);
}

run('Observation generation with confidence and metadata', () => {
  const store = new ProvenanceStore();
  const run = store.createAnalysisRun({ method: 'SPATIAL_FREQUENCY_ANALYSIS' });
  const obs = store.createObservation({
    runId: run.id,
    observationType: 'SPECTRAL_PEAK',
    target: 'high_freq_band',
    value: 0.88,
    confidence: 0.95
  });

  assert(obs.id.startsWith('OBS-'));
  assert.strictEqual(obs.confidence, 0.95);
  assert.strictEqual(obs.observationType, 'SPECTRAL_PEAK');
});

run('Evidence creation with independence group and polarity', () => {
  const store = new ProvenanceStore();
  const obs = store.createObservation({ observationType: 'WATERMARK_ABSENCE', value: true });
  const ev = store.createEvidence({
    observationIds: [obs.id],
    independenceGroupId: 'IG-AUDIO-1',
    evidenceType: 'AUDIO_FREQUENCY_ANOMALY',
    description: 'Distinct synthetic splice at 00:14',
    confidence: 0.91,
    polarity: EvidencePolarity.SUPPORTING
  });

  assert(ev.id.startsWith('EVD-'));
  assert.strictEqual(ev.polarity, EvidencePolarity.SUPPORTING);
  assert.strictEqual(ev.independenceGroupId, 'IG-AUDIO-1');
});

run('Finding creation with evidence linking and limitations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Phase C Verification' });
  const ev = store.createEvidence({ evidenceType: 'TEMPORAL_JITTER', confidence: 0.89 });

  const finding = store.createFinding({
    investigationId: inv.id,
    title: 'Temporal Inconsistency Confirmed',
    summary: 'Frames show jitter consistent with adversarial splice.',
    status: FindingStatus.SUPPORTED,
    confidence: 0.89,
    evidenceIds: [ev.id],
    limitations: ['Audio channel was compressed in transmission.']
  });

  assert(finding.id.startsWith('FND-'));
  assert.strictEqual(finding.evidenceIds.length, 1);
  assert.strictEqual(finding.limitations.length, 1);
  assert.strictEqual(inv.findingIds.includes(finding.id), true);
});

console.log(`Phase C Regression: ${passed}/3 PASSED\n`);
