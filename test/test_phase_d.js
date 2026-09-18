// test/test_phase_d.js
// VeriMedia AI — Phase D Regression: Advanced Media Forensics

import assert from 'assert';
import { ProvenanceStore } from '../src/provenance/core.js';
import { compareArtifacts } from '../src/provenance/comparator.js';

console.log('── Running VeriMedia AI Phase D Tests (Advanced Media Forensics) ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Phase D Test ${passed}: ${name}`);
}

run('Perceptual hash analysis identifies visual match', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Phase D Forensics' });
  const a = store.createArtifact({
    investigationId: inv.id,
    perceptualHash: 'ffff0000aaaa5555'
  });
  const b = store.createArtifact({
    investigationId: inv.id,
    perceptualHash: 'ffff0000aaaa5554'
  });

  const res = compareArtifacts(store, inv.id, a.id, b.id);
  assert(res.perceptualSimilarity > 0.90, 'Close hashes must yield >90% perceptual similarity');
  assert.strictEqual(res.isExactMatch, false);
});

run('Forensic dimension transformation detection', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Phase D Crop Test' });
  const a = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 1080 }
  });
  const b = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1080, height: 1080 } // Aspect ratio change -> crop
  });

  const res = compareArtifacts(store, inv.id, a.id, b.id);
  assert(res.transformations.some(t => t.includes('crop') || t.includes('aspect')), 'Must detect crop/aspect transformation');
});

run('Forensic confidence distinct from provenance status', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({
    title: 'Phase D Confidence Check',
    metadata: { forensicConfidence: 0.92 }
  });

  assert.strictEqual(inv.forensicConfidence, 0.92);
});

console.log(`Phase D Regression: ${passed}/3 PASSED\n`);
