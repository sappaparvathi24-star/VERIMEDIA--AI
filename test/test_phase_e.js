// test/test_phase_e.js
// VeriMedia AI — Phase E Regression: Investigation & Case Management

import assert from 'assert';
import { ProvenanceStore } from '../src/provenance/core.js';

console.log('── Running VeriMedia AI Phase E Tests (Investigation & Case Management) ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Phase E Test ${passed}: ${name}`);
}

run('Investigation lifecycle and artifact registration', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({
    title: 'Case VM-2026-E',
    status: 'ACTIVE'
  });

  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'case_evidence.mp4'
  });

  assert.strictEqual(inv.artifactIds.includes(art.id), true);
  assert.strictEqual(store.getInvestigation(inv.id).status, 'ACTIVE');
});

run('AnalysisRun tracking with method and timestamps', () => {
  const store = new ProvenanceStore();
  const runObj = store.createAnalysisRun({
    method: 'DEEPFAKE_FACIAL_LANDMARK_CONSISTENCY',
    metadata: { model: 'ResNet-18-Face' }
  });

  assert(runObj.id.startsWith('RUN-'));
  assert(runObj.startedAt && runObj.completedAt);
  assert.strictEqual(runObj.method, 'DEEPFAKE_FACIAL_LANDMARK_CONSISTENCY');
});

run('Multi-artifact association with unified investigation record', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Multi-Asset Case' });

  const a1 = store.createArtifact({ investigationId: inv.id, filename: 'doc1.jpg' });
  const a2 = store.createArtifact({ investigationId: inv.id, filename: 'doc2.jpg' });

  assert.strictEqual(inv.artifactIds.length, 2);
  assert.strictEqual(inv.artifactIds[0], a1.id);
  assert.strictEqual(inv.artifactIds[1], a2.id);
});

run('Analyst Notes lifecycle, authorship, and persistence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Note Tracking Case' });

  const note = store.addNote(inv.id, {
    author: 'Lead Investigator J. Doe',
    text: 'Phase E persistence test note: forensic fingerprint matches reference broadcast.',
    tags: ['PERSISTENCE_TEST', 'CHAIN_OF_CUSTODY']
  });

  assert(note.id.startsWith('NOTE-'));
  assert.strictEqual(note.investigationId, inv.id);
  assert.strictEqual(note.author, 'Lead Investigator J. Doe');
  assert.strictEqual(note.text, 'Phase E persistence test note: forensic fingerprint matches reference broadcast.');
  assert(note.createdAt);

  const notes = store.getNotes(inv.id);
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].id, note.id);
});

console.log(`Phase E Regression: ${passed}/4 PASSED\n`);
