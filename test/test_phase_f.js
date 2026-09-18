// test/test_phase_f.js
// VeriMedia AI — Phase F Test Suite: Provenance & Media Timeline

import assert from 'assert';
import { ProvenanceStore, RelationshipTypes, AppearanceStatus, FindingStatus, EvidencePolarity } from '../src/provenance/core.js';
import { compareArtifacts } from '../src/provenance/comparator.js';
import { buildMediaTimeline } from '../src/provenance/timeline.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase F Tests ──');
let passedCount = 0;
const totalTests = 13;

function runTest(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`✔ [PASS] Test ${passedCount}: ${name}`);
  } catch (err) {
    console.error(`✘ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Create two real artifacts
// ---------------------------------------------------------------------------
runTest('Create two real artifacts', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 1 Investigation' });

  const art1 = store.createArtifact({
    investigationId: inv.id,
    filename: 'source_broadcast.mp4',
    mimeType: 'video/mp4',
    byteSize: 10485760,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    perceptualHash: '1122334455667788',
    dimensions: { width: 1920, height: 1080 }
  });

  const art2 = store.createArtifact({
    investigationId: inv.id,
    filename: 'social_crop.mp4',
    mimeType: 'video/mp4',
    byteSize: 4194304,
    sha256: 'cca18204cd29f276686a3b684182562479e0a0d9b13994792472c2d8850d4ff4',
    perceptualHash: '1122334455667789',
    dimensions: { width: 1080, height: 1080 }
  });

  assert(art1 && art1.id.startsWith('ART-'), 'Artifact 1 must be created');
  assert(art2 && art2.id.startsWith('ART-'), 'Artifact 2 must be created');
  assert.strictEqual(art1.dimensions.width, 1920);
  assert.strictEqual(art2.dimensions.width, 1080);
  assert.notStrictEqual(art1.sha256, art2.sha256);
});

// ---------------------------------------------------------------------------
// TEST 2: Compare exact hashes
// ---------------------------------------------------------------------------
runTest('Compare exact hashes', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 2 Investigation' });
  const fixedHash = '7d1a54127b222502f5b79b5fb0803061152a44f92b37e23c65dd004176160138';

  const artA = store.createArtifact({
    investigationId: inv.id,
    filename: 'identical_copy_1.mp4',
    sha256: fixedHash,
    perceptualHash: 'aabbccddeeff0011'
  });

  const artB = store.createArtifact({
    investigationId: inv.id,
    filename: 'identical_copy_2.mp4',
    sha256: fixedHash,
    perceptualHash: 'aabbccddeeff0011'
  });

  const comparison = compareArtifacts(store, inv.id, artA.id, artB.id);

  assert.strictEqual(comparison.isExactMatch, true);
  assert.strictEqual(comparison.relationship.relationshipType, RelationshipTypes.OBSERVED_SAME_CONTENT);
  assert.strictEqual(comparison.relationship.confidence, 1.0);
  assert(comparison.evidence.some(e => e.evidenceType === 'EXACT_HASH_MATCH'), 'Must produce EXACT_HASH_MATCH evidence');
});

// ---------------------------------------------------------------------------
// TEST 3: Compare visually related artifacts
// ---------------------------------------------------------------------------
runTest('Compare visually related artifacts', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 3 Investigation' });

  const artA = store.createArtifact({
    investigationId: inv.id,
    filename: 'master_1080p.mp4',
    sha256: '1111111111111111111111111111111111111111111111111111111111111111',
    perceptualHash: '1234567890abcdef',
    dimensions: { width: 1920, height: 1080 }
  });

  const artB = store.createArtifact({
    investigationId: inv.id,
    filename: 'resized_720p.mp4',
    sha256: '2222222222222222222222222222222222222222222222222222222222222222',
    perceptualHash: '1234567890abcdee', // 1 bit flip
    dimensions: { width: 1280, height: 720 }
  });

  const comparison = compareArtifacts(store, inv.id, artA.id, artB.id);

  assert.strictEqual(comparison.isExactMatch, false);
  assert(comparison.perceptualSimilarity >= 0.85, 'Must report high visual similarity');
  assert(
    comparison.relationship.relationshipType === RelationshipTypes.TRANSFORMED_VERSION ||
    comparison.relationship.relationshipType === RelationshipTypes.POSSIBLY_DERIVED,
    'Relationship must represent transformation/derivation, not proven origin'
  );
  // Verify Similarity ≠ provenance warning
  assert(
    comparison.findings.some(f => f.limitations.some(l => l.includes('similarity does not prove'))),
    'Finding must explicitly note that similarity does not prove which artifact came first'
  );
});

// ---------------------------------------------------------------------------
// TEST 4: Create observed appearances
// ---------------------------------------------------------------------------
runTest('Create observed appearances', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 4 Investigation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'item.mp4' });

  const src = store.createSource({
    name: 'Verified News Portal',
    url: 'https://newsportal.com/story/clip1',
    domain: 'newsportal.com',
    platform: 'WEB'
  });

  const app = store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    observedAt: '2026-09-18T10:30:00Z',
    publishedAt: '2026-09-17T15:20:00Z'
  });

  assert(app && app.id.startsWith('APP-'));
  assert.strictEqual(app.observedAt, '2026-09-18T10:30:00Z');
  assert.strictEqual(app.publishedAt, '2026-09-17T15:20:00Z');
  assert.notStrictEqual(app.observedAt, app.publishedAt, 'observedAt and publishedAt must remain distinct');
});

// ---------------------------------------------------------------------------
// TEST 5: Build media timeline
// ---------------------------------------------------------------------------
runTest('Build media timeline', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 5 Investigation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'timeline_video.mp4' });

  const src1 = store.createSource({ name: 'Site A', url: 'https://site-a.com/post' });
  const src2 = store.createSource({ name: 'Site B', url: 'https://site-b.com/post' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src1.id,
    observedAt: '2026-08-11T12:00:00Z',
    publishedAt: '2026-08-10T10:00:00Z'
  });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src2.id,
    observedAt: '2026-08-14T12:00:00Z',
    publishedAt: '2026-08-13T10:00:00Z'
  });

  const timeline = buildMediaTimeline(store, inv.id);

  assert.strictEqual(timeline.events.length, 2);
  assert.strictEqual(timeline.events[0].sourceName, 'Site A');
  assert.strictEqual(timeline.events[1].sourceName, 'Site B');
  assert(timeline.events[0].timestampValue < timeline.events[1].timestampValue, 'Timeline events must be chronological');
});

// ---------------------------------------------------------------------------
// TEST 6: Determine earliest observed appearance
// ---------------------------------------------------------------------------
runTest('Determine earliest observed appearance', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 6 Investigation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  const srcEarly = store.createSource({ name: 'Early Source', domain: 'early.org' });
  const srcLate = store.createSource({ name: 'Late Source', domain: 'late.com' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: srcLate.id,
    publishedAt: '2026-08-20T00:00:00Z'
  });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: srcEarly.id,
    publishedAt: '2026-08-05T00:00:00Z'
  });

  const timeline = buildMediaTimeline(store, inv.id);

  assert(timeline.earliestAppearance !== null, 'Earliest appearance must be determined');
  assert.strictEqual(timeline.earliestAppearance.event.sourceName, 'Early Source');
  assert.strictEqual(timeline.earliestAppearance.event.publishedAt, '2026-08-05T00:00:00Z');
});

// ---------------------------------------------------------------------------
// TEST 7: Verify earliest observed ≠ absolute original
// ---------------------------------------------------------------------------
runTest('Verify earliest observed ≠ absolute original', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 7 Investigation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'origin_test.mp4' });
  const src = store.createSource({ name: 'First Seen Source' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    publishedAt: '2026-01-01T00:00:00Z'
  });

  const timeline = buildMediaTimeline(store, inv.id);
  const label = timeline.earliestAppearance.label;
  const note = timeline.earliestAppearance.note;

  // Must strictly adhere to Phase F Section 2 & 8:
  // Never use "ORIGINAL SOURCE", "ORIGINAL FILE", "ABSOLUTE ORIGIN"
  const forbiddenTerms = ['ORIGINAL SOURCE', 'ORIGINAL FILE', 'ABSOLUTE ORIGIN'];
  for (const term of forbiddenTerms) {
    assert(!label.includes(term), `Label must NOT contain '${term}'. Current label: '${label}'`);
  }

  assert(
    label === 'EARLIEST OBSERVED APPEARANCE' || label === 'EARLIEST OBSERVED VERSION IN AVAILABLE EVIDENCE',
    `Expected 'EARLIEST OBSERVED APPEARANCE', got: '${label}'`
  );
  assert(note.includes('does not establish absolute origin'), 'Note must state it does not establish absolute origin');
});

// ---------------------------------------------------------------------------
// TEST 8: Verify conflicting timestamps remain conflicting
// ---------------------------------------------------------------------------
runTest('Verify conflicting timestamps remain conflicting', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 8 Investigation' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'conflict_media.mp4' });

  const srcA = store.createSource({ name: 'Claimant A' });
  const srcB = store.createSource({ name: 'Claimant B' });

  // Two conflicting appearances marked with CONFLICTING status
  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: srcA.id,
    publishedAt: '2026-05-01T12:00:00Z',
    status: AppearanceStatus.CONFLICTING
  });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: srcB.id,
    publishedAt: '2026-05-01T11:00:00Z',
    status: AppearanceStatus.CONFLICTING
  });

  const timeline = buildMediaTimeline(store, inv.id);

  assert.strictEqual(timeline.status, 'CONFLICTING');
  assert(timeline.conflicts.length > 0, 'Must record conflict details');
  assert(timeline.whatRemainsUnknown.some(u => u.includes('conflicting source timestamps')), 'Unknowns must mention conflict');
});

// ---------------------------------------------------------------------------
// TEST 9: Verify provenance confidence remains separate from forensic confidence
// ---------------------------------------------------------------------------
runTest('Verify provenance confidence remains separate from forensic confidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({
    title: 'Test 9 Investigation',
    metadata: { forensicConfidence: 0.94 }
  });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'dual_confidence.mp4' });
  const src = store.createSource({ name: 'Source X' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    publishedAt: '2026-06-10T00:00:00Z'
  });

  const timeline = buildMediaTimeline(store, inv.id);

  assert.strictEqual(typeof timeline.forensicConfidence, 'number');
  assert.strictEqual(timeline.forensicConfidence, 0.94);
  assert.strictEqual(typeof timeline.provenanceConfidence, 'number');
  assert.strictEqual(timeline.provenanceConfidence, 0.55);
  assert.notStrictEqual(timeline.forensicConfidence, timeline.provenanceConfidence, 'Forensic and provenance confidence must remain separate');
});

// ---------------------------------------------------------------------------
// TEST 10: Verify provenance relationships reference real evidence IDs
// ---------------------------------------------------------------------------
runTest('Verify provenance relationships reference real evidence IDs', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Test 10 Investigation' });

  const art1 = store.createArtifact({
    investigationId: inv.id,
    filename: 'video_a.mp4',
    perceptualHash: '1111222233334444',
    dimensions: { width: 1920, height: 1080 }
  });

  const art2 = store.createArtifact({
    investigationId: inv.id,
    filename: 'video_b.mp4',
    perceptualHash: '1111222233334445',
    dimensions: { width: 1280, height: 720 }
  });

  const comparison = compareArtifacts(store, inv.id, art1.id, art2.id);
  const rel = comparison.relationship;

  assert(rel.evidenceIds.length > 0, 'Relationship must have evidence IDs');
  for (const eid of rel.evidenceIds) {
    const ev = store.getEvidence(eid);
    assert(ev !== null, `Evidence ${eid} must exist in the store`);
    assert(ev.id === eid);
  }
});

// ---------------------------------------------------------------------------
// TEST 11: Verify unknown provenance remains UNKNOWN/INCONCLUSIVE
// ---------------------------------------------------------------------------
runTest('Verify unknown provenance remains UNKNOWN/INCONCLUSIVE', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Empty Investigation' });

  const timeline = buildMediaTimeline(store, inv.id);

  assert.strictEqual(timeline.status, 'UNKNOWN');
  assert.strictEqual(timeline.provenanceConfidence, 'UNKNOWN');
  assert.strictEqual(timeline.earliestAppearance, null);
  assert(timeline.whatRemainsUnknown.some(u => u.includes('unknown')), 'Must document unknown status');
});

// ---------------------------------------------------------------------------
// TEST 12: Verify demo provenance remains isolated
// ---------------------------------------------------------------------------
runTest('Verify demo provenance remains isolated', () => {
  const cases = provenanceService.getInvestigations();
  const demoCase = cases.find(c => c.isDemo);
  const realCase = cases.find(c => !c.isDemo);

  assert(demoCase, 'Demo case must exist');
  assert(realCase, 'Real case must exist');
  assert.strictEqual(demoCase.isDemo, true);
  assert.strictEqual(realCase.isDemo, false);

  const demoProvenance = provenanceService.getProvenance(demoCase.id);
  assert.strictEqual(demoProvenance.isDemo, true);
  assert.strictEqual(demoCase.metadata.demoNotice, 'DEMO SCENARIO — SIMULATED EVIDENCE');

  // Verify demo artifacts are distinct from real artifacts
  const demoArtifacts = demoProvenance.artifacts;
  const realArtifacts = provenanceService.getProvenance(realCase.id).artifacts;

  for (const da of demoArtifacts) {
    assert(!realArtifacts.some(ra => ra.id === da.id), 'Demo artifacts must not leak into real investigation');
  }
});

// ---------------------------------------------------------------------------
// TEST 13: Verify full traceability
// Provenance Finding → Evidence → Observation → Source / Artifact → AnalysisRun → AnalysisMethod
// ---------------------------------------------------------------------------
runTest('Verify full traceability: Finding → Evidence → Observation → Source/Artifact → AnalysisRun → AnalysisMethod', () => {
  const cases = provenanceService.getInvestigations();
  const realCase = cases.find(c => !c.isDemo);
  assert(realCase, 'Real investigation required for traceability check');

  const provenance = provenanceService.getProvenance(realCase.id);
  assert(provenance.findings.length > 0, 'Investigation must contain findings');

  const finding = provenance.findings[0];
  const trace = provenanceService.traceFinding(finding.id);

  assert(trace.verified, 'Trace must be verified');
  assert.strictEqual(trace.finding.id, finding.id);
  assert(trace.traceChain.length > 0, 'Trace chain must contain evidence');

  const firstChain = trace.traceChain[0];
  assert(firstChain.evidence && firstChain.evidence.id.startsWith('EVD-'), 'Must trace to Evidence');
  assert(firstChain.observations.length > 0, 'Must trace to Observations');

  const firstObs = firstChain.observations[0];
  assert(firstObs.observation && firstObs.observation.id.startsWith('OBS-'), 'Must trace to Observation');
  assert(firstObs.artifact || firstObs.source, 'Must trace to Artifact or Source');
  assert(firstObs.analysisRun && firstObs.analysisRun.id.startsWith('RUN-'), 'Must trace to AnalysisRun');
  assert(typeof firstObs.analysisMethod === 'string' && firstObs.analysisMethod.length > 0, 'Must trace to AnalysisMethod');
});

console.log(`\n========================================`);
console.log(`Phase F Test Suite: ${passedCount}/${totalTests} PASSED`);
console.log(`========================================\n`);
