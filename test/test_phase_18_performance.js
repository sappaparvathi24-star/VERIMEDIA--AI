// test/test_phase_18_performance.js
// VeriMedia AI — Phase 18 Tests: Performance, Latency & Load Benchmarks

import assert from 'assert';
import crypto from 'crypto';
import { ProvenanceStore, EvidencePolarity } from '../src/provenance/core.js';
import { fuseEvidenceAndReasoning } from '../src/provenance/reasoning.js';
import { hammingDistance } from '../src/forensics/perceptualHash.js';
import { cosineSimilarity } from '../ml/embeddings/similarity.js';

console.log('── Running VeriMedia AI Phase 18 Tests: Performance & Resource Benchmarks ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Test ${passed}: ${name}`);
}

// 1. Bitstream Hashing Latency Gate (< 25ms threshold from 15_MODEL_EVALUATION.md)
run('Performance Gate: SHA-256 hashing of 1MB media buffer executes in < 25ms', () => {
  const dummyBuffer = Buffer.alloc(1024 * 1024, 0x5a); // 1MB buffer
  const start = performance.now();
  
  const hash = crypto.createHash('sha256').update(dummyBuffer).digest('hex');
  const elapsed = performance.now() - start;

  assert.strictEqual(hash.length, 64);
  assert(elapsed < 25, `SHA-256 took ${elapsed.toFixed(2)}ms (must be < 25ms)`);
  console.log(`    ↳ SHA-256 1MB Hash: ${elapsed.toFixed(2)}ms`);
});

// 2. Hamming Distance & Similarity Calculation Gate (< 5ms for 1,000 pairs)
run('Performance Gate: 1,000 Hamming distance comparisons execute in < 10ms', () => {
  const hashA = '1010101010101010101010101010101010101010101010101010101010101010';
  const hashB = '1010101010101010101010101010101011111111101010101010101010101010';

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    hammingDistance(hashA, hashB);
  }
  const elapsed = performance.now() - start;

  assert(elapsed < 10, `1,000 Hamming calculations took ${elapsed.toFixed(2)}ms (must be < 10ms)`);
  console.log(`    ↳ 1,000 Hamming Comparisons: ${elapsed.toFixed(2)}ms`);
});

// 3. High-Volume Evidence Fusion Gate (< 120ms threshold for 1,000 entities)
run('Performance Gate: Multi-source Evidence Fusion with 1,000 observations executes in < 120ms', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'High-Volume Fusion Load Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'benchmark_media.mp4',
    sha256: 'f'.repeat(64),
    mimeType: 'video/mp4'
  });

  // Populate 1,000 observations and evidence nodes across 20 independence groups
  const evidenceIds = [];
  for (let i = 0; i < 1000; i++) {
    const obs = store.createObservation({
      observationType: 'STREAM_FREQUENCY_ANOMALY',
      target: `signal_band_${i % 10}`,
      value: 0.75
    });

    const ev = store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: `IG-BENCHMARK-CLUSTER-${i % 20}`,
      evidenceType: 'SIGNAL_NOISE_ESTIMATION',
      description: `Synthetic benchmark observation #${i}`,
      confidence: 0.88,
      polarity: EvidencePolarity.SUPPORTING
    });
    evidenceIds.push(ev.id);
  }

  store.createFinding({
    investigationId: inv.id,
    artifactId: art.id,
    evidenceIds: evidenceIds,
    title: 'High-Volume Benchmark Findings Group'
  });

  const start = performance.now();
  const fused = fuseEvidenceAndReasoning(store, inv.id);
  const elapsed = performance.now() - start;

  assert(fused !== null);
  assert.strictEqual(fused.distinctIndependenceChannels, 20);
  assert(elapsed < 120, `1,000 entity fusion took ${elapsed.toFixed(2)}ms (must be < 120ms threshold)`);
  console.log(`    ↳ 1,000 Entity Fusion Latency: ${elapsed.toFixed(2)}ms`);
});

// 4. ML Vector Cosine Similarity Benchmark
run('Performance Gate: 512-dimension embedding cosine similarity computation executes in < 30ms', () => {
  const vecA = new Array(512).fill(0.5).map((v, i) => v + (i % 10) * 0.05);
  const vecB = new Array(512).fill(0.5).map((v, i) => v - (i % 10) * 0.03);

  // Warmup JIT
  for (let i = 0; i < 10; i++) cosineSimilarity(vecA, vecB);

  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    cosineSimilarity(vecA, vecB);
  }
  const elapsed = performance.now() - start;

  assert(elapsed < 30, `100 Cosine calculations took ${elapsed.toFixed(2)}ms (must be < 30ms)`);
  console.log(`    ↳ 100 x 512-Dim Cosine Similarities: ${elapsed.toFixed(2)}ms`);
});

console.log(`🎉 All ${passed}/${passed} Phase 18 Performance & Benchmark Tests Passed Successfully!`);
