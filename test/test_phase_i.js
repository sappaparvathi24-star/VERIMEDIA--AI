// test/test_phase_i.js
// VeriMedia AI — Phase I Test Suite: Media Genealogy & Transformation Analysis
import assert from 'assert';
import {
  ProvenanceStore,
  RelationshipTypes,
  TransformationTypes,
  TransformationEpistemicStatus,
  TransformationDirection,
  EvidencePolarity,
  PROHIBITED_CERTAINTY_TERMS
} from '../src/provenance/core.js';
import {
  analyzeArtifactTransformations,
  compareTimestamps,
  buildGenealogyGraph,
  traceTransformation
} from '../src/provenance/genealogy.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase I Tests: Media Genealogy & Transformation Analysis ──\n');

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

// ---------------------------------------------------------------------------
// TEST 1: Exact hash identity returns EXACT_MATCH
// ---------------------------------------------------------------------------
runTest('Test 1: Exact hash identity returns EXACT_MATCH with zero transformations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Exact Match Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    filename: 'original.mp4',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    filename: 'copy.mp4',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  assert.strictEqual(res.isExactMatch, true);
  assert(
    res.relationship.relationshipType === RelationshipTypes.OBSERVED_SAME_CONTENT ||
    res.relationship.relationshipType === RelationshipTypes.EXACT_MATCH,
    'Relationship must represent exact content match'
  );
  assert.strictEqual(res.transformations.length, 0);
});

// ---------------------------------------------------------------------------
// TEST 2: Perceptual match creates TRANSFORMED_VERSION
// ---------------------------------------------------------------------------
runTest('Test 2: Perceptual similarity creates TRANSFORMED_VERSION relationship', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Perceptual Match Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    filename: 'master.png',
    sha256: '1111111111111111111111111111111111111111111111111111111111111111',
    perceptualHash: '1111222233334444',
    dimensions: { width: 1920, height: 1080 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    filename: 'scaled.png',
    sha256: '2222222222222222222222222222222222222222222222222222222222222222',
    perceptualHash: '1111222233334445', // 1 bit flip
    dimensions: { width: 1280, height: 720 }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  assert.strictEqual(res.isExactMatch, false);
  assert(res.perceptualSimilarity >= 0.85);
  assert.strictEqual(res.relationship.relationshipType, RelationshipTypes.TRANSFORMED_VERSION);
});

// ---------------------------------------------------------------------------
// TEST 3: Dimension downscaling detected as RESIZE
// ---------------------------------------------------------------------------
runTest('Test 3: Dimension downscaling detected as RESIZE with scale factor', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Resize Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 3840, height: 2160 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 1080 }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const resizeTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.RESIZE);
  assert(resizeTrf, 'Must detect RESIZE transformation');
  assert.strictEqual(resizeTrf.direction, TransformationDirection.FORWARD);
  assert.strictEqual(resizeTrf.measurements.scalingFactor, 0.5);
});

// ---------------------------------------------------------------------------
// TEST 4: Geometric crop detected from aspect ratio shift
// ---------------------------------------------------------------------------
runTest('Test 4: Aspect ratio shift detected as CROP transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Crop Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 1080 } // 16:9 = 1.78
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1080, height: 1080 } // 1:1 = 1.00
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const cropTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.CROP);
  assert(cropTrf, 'Must detect CROP transformation');
  assert(cropTrf.measurements.targetAspect === 1);
});

// ---------------------------------------------------------------------------
// TEST 5: Letterboxing / border padding detection
// ---------------------------------------------------------------------------
runTest('Test 5: Letterbox / border padding detected as LETTERBOX transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Letterbox Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 800 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 1080 },
    metadata: { letterbox: true, paddedBars: true }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const padTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.LETTERBOX);
  assert(padTrf, 'Must detect LETTERBOX transformation');
});

// ---------------------------------------------------------------------------
// TEST 6: Recompression and bitrate reduction detection
// ---------------------------------------------------------------------------
runTest('Test 6: Bitrate reduction detected as RECOMPRESSION transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Compression Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    byteSize: 15000000,
    metadata: { bitrate: 8000 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    byteSize: 3000000,
    metadata: { bitrate: 2000, recompression: true }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const compTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.RECOMPRESSION);
  assert(compTrf, 'Must detect RECOMPRESSION transformation');
  assert(compTrf.measurements.qualityReductionPct >= 70);
});

// ---------------------------------------------------------------------------
// TEST 7: Format container conversion detection
// ---------------------------------------------------------------------------
runTest('Test 7: MIME type conversion detected as FORMAT_CONVERSION with UNDIRECTED direction', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Format Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/quicktime'
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4'
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const fmtTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.FORMAT_CONVERSION);
  assert(fmtTrf, 'Must detect FORMAT_CONVERSION transformation');
  assert.strictEqual(fmtTrf.direction, TransformationDirection.UNDIRECTED);
});

// ---------------------------------------------------------------------------
// TEST 8: Metadata EXIF stripping detection
// ---------------------------------------------------------------------------
runTest('Test 8: Missing EXIF keys detected as METADATA_STRIPPING transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Meta Strip Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    metadata: { cameraModel: 'Sony A7S III', gpsLocation: '19.0760,72.8777', isoSpeed: 800 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    metadata: {}
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const stripTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.METADATA_STRIPPING);
  assert(stripTrf, 'Must detect METADATA_STRIPPING transformation');
  assert(stripTrf.measurements.strippedKeys.includes('cameraModel'));
});

// ---------------------------------------------------------------------------
// TEST 9: Metadata addition detection
// ---------------------------------------------------------------------------
runTest('Test 9: Added platform tags detected as METADATA_ADDITION transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Meta Add Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    metadata: {}
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    metadata: { encoder: 'Lavf60.16.100', platformTag: 'X_SYNDICATE_V2' }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const addTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.METADATA_ADDITION);
  assert(addTrf, 'Must detect METADATA_ADDITION transformation');
  assert(addTrf.measurements.addedKeys.includes('encoder'));
});

// ---------------------------------------------------------------------------
// TEST 10: Video duration reduction detected as VIDEO_TRIMMING
// ---------------------------------------------------------------------------
runTest('Test 10: Duration reduction detected as VIDEO_TRIMMING transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Video Trim Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    duration: 124.5
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    duration: 45.0
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const trimTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.VIDEO_TRIMMING);
  assert(trimTrf, 'Must detect VIDEO_TRIMMING transformation');
  assert.strictEqual(trimTrf.measurements.retainedDurationSeconds, 45.0);
});

// ---------------------------------------------------------------------------
// TEST 11: Video frame-rate modification detection
// ---------------------------------------------------------------------------
runTest('Test 11: Frame rate variance detected as FRAME_RATE_CONVERSION transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'FPS Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    frameRate: 60
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    frameRate: 30
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const fpsTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.FRAME_RATE_CONVERSION);
  assert(fpsTrf, 'Must detect FRAME_RATE_CONVERSION transformation');
  assert.strictEqual(fpsTrf.measurements.sourceFps, 60);
  assert.strictEqual(fpsTrf.measurements.targetFps, 30);
});

// ---------------------------------------------------------------------------
// TEST 12: Video codec transcode detection
// ---------------------------------------------------------------------------
runTest('Test 12: Codec variance detected as CODEC_TRANSCODE transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Codec Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    videoCodec: 'ProRes 422 HQ'
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    mimeType: 'video/mp4',
    videoCodec: 'H.264 / AVC'
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const codecTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.CODEC_TRANSCODE);
  assert(codecTrf, 'Must detect CODEC_TRANSCODE transformation');
});

// ---------------------------------------------------------------------------
// TEST 13: Audio sample rate / channel modification detection
// ---------------------------------------------------------------------------
runTest('Test 13: Audio sample rate change detected as AUDIO_RESAMPLE transformation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Audio Resample Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    audioSampleRate: 48000,
    audioChannels: 2
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    audioSampleRate: 44100,
    audioChannels: 1
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const audTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.AUDIO_RESAMPLE);
  assert(audTrf, 'Must detect AUDIO_RESAMPLE transformation');
  assert.strictEqual(audTrf.measurements.sourceSampleRate, 48000);
});

// ---------------------------------------------------------------------------
// TEST 14: Audio track modification detection
// ---------------------------------------------------------------------------
runTest('Test 14: Audio track removal or replacement detected as AUDIO_TRACK_MODIFICATION', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Audio Track Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    metadata: { hasAudioTrack: true, audioCodec: 'AAC' }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    metadata: { hasAudioTrack: false }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const trkTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.AUDIO_TRACK_MODIFICATION);
  assert(trkTrf, 'Must detect AUDIO_TRACK_MODIFICATION transformation');
});

// ---------------------------------------------------------------------------
// TEST 15: Audio frequency spectral modification detection
// ---------------------------------------------------------------------------
runTest('Test 15: Audio spectral divergence detected as AUDIO_SPECTRAL_MODIFICATION', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Audio Spectral Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    metadata: { audioSpectrogramMatch: 0.72, spectralLowPassDetected: true }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    metadata: { audioSpectrogramMatch: 0.72 }
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const specTrf = res.detailedTransformations.find(t => t.type === TransformationTypes.AUDIO_SPECTRAL_MODIFICATION);
  assert(specTrf, 'Must detect AUDIO_SPECTRAL_MODIFICATION transformation');
});

// ---------------------------------------------------------------------------
// TEST 16: Timestamp precedence comparison
// ---------------------------------------------------------------------------
runTest('Test 16: Earlier publication establishes precedence, not authorial creation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Precedence Case' });
  const src = store.createSource({ name: 'Platform X' });
  const artA = store.createArtifact({ investigationId: inv.id, filename: 'early.mp4' });
  const artB = store.createArtifact({ investigationId: inv.id, filename: 'late.mp4' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: artA.id,
    sourceId: src.id,
    observedAt: '2026-03-01T10:00:00Z',
    publishedAt: '2026-03-01T10:00:00Z'
  });
  store.createAppearance({
    investigationId: inv.id,
    artifactId: artB.id,
    sourceId: src.id,
    observedAt: '2026-03-02T14:00:00Z',
    publishedAt: '2026-03-02T14:00:00Z'
  });

  const precedence = compareTimestamps(store, artA.id, artB.id);
  assert.strictEqual(precedence.direction, TransformationDirection.FORWARD);
  assert.strictEqual(precedence.status, TransformationEpistemicStatus.SUPPORTED);
  assert(precedence.explanation.includes('precedes'));
});

// ---------------------------------------------------------------------------
// TEST 17: Conflicting timestamps remain INCONCLUSIVE
// ---------------------------------------------------------------------------
runTest('Test 17: Conflicting timestamps produce INCONCLUSIVE direction', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Conflict Case' });
  const src1 = store.createSource({ name: 'Platform 1' });
  const src2 = store.createSource({ name: 'Platform 2' });
  const artA = store.createArtifact({ investigationId: inv.id });
  const artB = store.createArtifact({ investigationId: inv.id });

  // Conflicting claims across sources
  store.createAppearance({
    investigationId: inv.id,
    artifactId: artA.id,
    sourceId: src1.id,
    publishedAt: '2026-03-01T10:00:00Z'
  });
  store.createAppearance({
    investigationId: inv.id,
    artifactId: artA.id,
    sourceId: src2.id,
    publishedAt: '2026-03-05T10:00:00Z'
  });
  store.createAppearance({
    investigationId: inv.id,
    artifactId: artB.id,
    sourceId: src1.id,
    publishedAt: '2026-03-03T10:00:00Z'
  });

  const precedence = compareTimestamps(store, artA.id, artB.id);
  assert.strictEqual(precedence.direction, TransformationDirection.UNDIRECTED);
  assert(precedence.explanation.includes('Conflicting') || precedence.direction === TransformationDirection.UNDIRECTED);
});

// ---------------------------------------------------------------------------
// TEST 18: Absence of publication records leaves direction HYPOTHETICAL
// ---------------------------------------------------------------------------
runTest('Test 18: Missing publication timestamps leaves direction HYPOTHETICAL', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'No Time Case' });
  const artA = store.createArtifact({ investigationId: inv.id });
  const artB = store.createArtifact({ investigationId: inv.id });

  const precedence = compareTimestamps(store, artA.id, artB.id);
  assert.strictEqual(precedence.direction, TransformationDirection.UNDIRECTED);
  assert.strictEqual(precedence.status, TransformationEpistemicStatus.HYPOTHETICAL);
});

// ---------------------------------------------------------------------------
// TEST 19: Competing derivation hypotheses generated
// ---------------------------------------------------------------------------
runTest('Test 19: Competing derivation hypotheses generated for plausible pathways', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Hypothesis Case' });
  const artA = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1920, height: 1080 }
  });
  const artB = store.createArtifact({
    investigationId: inv.id,
    dimensions: { width: 1080, height: 1080 },
    byteSize: 400000
  });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  assert(res.hypotheses.length > 0, 'Must generate competing hypotheses');
  assert(res.hypotheses.some(h => h.type.includes('CROP') || h.type.includes('RECOMPRESSION')));
});

// ---------------------------------------------------------------------------
// TEST 20: Epistemic status tracking (SUPPORTED, HYPOTHETICAL, REFUTED)
// ---------------------------------------------------------------------------
runTest('Test 20: Epistemic status properly tracked across transformation entities', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Status Case' });
  const artA = store.createArtifact({ investigationId: inv.id });
  const artB = store.createArtifact({ investigationId: inv.id });

  const trf = store.createTransformation({
    investigationId: inv.id,
    sourceArtifactId: artA.id,
    targetArtifactId: artB.id,
    type: TransformationTypes.AUDIO_RESAMPLE,
    direction: TransformationDirection.HYPOTHETICAL,
    epistemicStatus: TransformationEpistemicStatus.HYPOTHETICAL
  });

  assert.strictEqual(trf.epistemicStatus, TransformationEpistemicStatus.HYPOTHETICAL);
  store.updateTransformation(trf.id, { epistemicStatus: TransformationEpistemicStatus.SUPPORTED });
  assert.strictEqual(store.getTransformation(trf.id).epistemicStatus, TransformationEpistemicStatus.SUPPORTED);
});

// ---------------------------------------------------------------------------
// TEST 21: Limitations attached to transformation findings
// ---------------------------------------------------------------------------
runTest('Test 21: Epistemic limitations enforce similarity ≠ provenance origin', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Limitations Case' });
  const artA = store.createArtifact({ investigationId: inv.id, dimensions: { width: 1920, height: 1080 } });
  const artB = store.createArtifact({ investigationId: inv.id, dimensions: { width: 1280, height: 720 } });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  assert(res.findings.length > 0);
  const f = res.findings[0];
  assert(f.limitations.some(l => l.includes('similarity does not prove') || l.includes('Visual similarity does not prove')));
  assert(f.limitations.some(l => l.includes('technical consistency') || l.includes('historical order')));
});

// ---------------------------------------------------------------------------
// TEST 22: Genealogy graph generation with nodes, edges, and earliest appearance
// ---------------------------------------------------------------------------
runTest('Test 22: Build genealogy graph with nodes, directed edges, and earliest observed appearance', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Graph Case' });
  const art1 = store.createArtifact({ investigationId: inv.id, filename: 'master.mp4', dimensions: { width: 1920, height: 1080 } });
  const art2 = store.createArtifact({ investigationId: inv.id, filename: 'crop.mp4', dimensions: { width: 1080, height: 1080 } });
  const src = store.createSource({ name: 'Origin Broadcaster' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art1.id,
    sourceId: src.id,
    publishedAt: '2026-01-01T08:00:00Z'
  });

  const graph = buildGenealogyGraph(store, inv.id);
  assert.strictEqual(graph.nodes.length, 2);
  assert(graph.edges.length >= 1, 'Must contain transformation edges');
  assert(graph.earliestObservedAppearance, 'Must identify earliest appearance');
  assert.strictEqual(graph.earliestObservedAppearance.artifactId, art1.id);
});

// ---------------------------------------------------------------------------
// TEST 23: Graph cycles handled safely
// ---------------------------------------------------------------------------
runTest('Test 23: Genealogy graph handles bi-directional/mutual comparisons safely', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Cycles Case' });
  const art1 = store.createArtifact({ investigationId: inv.id, filename: 'clip1.mp4' });
  const art2 = store.createArtifact({ investigationId: inv.id, filename: 'clip2.mp4' });

  // Manually add bidirectional relationships
  store.createRelationship({
    investigationId: inv.id,
    fromArtifactId: art1.id,
    toArtifactId: art2.id,
    relationshipType: RelationshipTypes.TRANSFORMED_VERSION
  });
  store.createRelationship({
    investigationId: inv.id,
    fromArtifactId: art2.id,
    toArtifactId: art1.id,
    relationshipType: RelationshipTypes.TRANSFORMED_VERSION
  });

  const graph = buildGenealogyGraph(store, inv.id);
  assert(graph.nodes.length === 2);
  assert(graph.edges.length >= 1);
});

// ---------------------------------------------------------------------------
// TEST 24: Traceability chain complete
// ---------------------------------------------------------------------------
runTest('Test 24: Traceability chain complete: Transformation → Evidence → Observation → Run → Method', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Trace Case' });
  const artA = store.createArtifact({ investigationId: inv.id, dimensions: { width: 1920, height: 1080 } });
  const artB = store.createArtifact({ investigationId: inv.id, dimensions: { width: 1280, height: 720 } });

  const res = analyzeArtifactTransformations(store, inv.id, artA.id, artB.id);
  const trf = res.detailedTransformations[0];
  assert(trf, 'Transformation must exist');

  const trace = traceTransformation(store, trf.id);
  assert(trace.transformation);
  assert(trace.evidenceChain.length > 0);
  assert(trace.evidenceChain[0].evidence);
  assert(trace.evidenceChain[0].observations.length > 0);
  assert(trace.evidenceChain[0].observations[0].analysisRun);
});

// ---------------------------------------------------------------------------
// TEST 25: Strict Demo Isolation: Real genealogy excludes demo data
// ---------------------------------------------------------------------------
runTest('Test 25: Real genealogy operations exclude simulated demo artifacts and transformations', () => {
  const store = new ProvenanceStore();
  const realInv = store.createInvestigation({ title: 'Real Case', isDemo: false });
  const demoInv = store.createInvestigation({ title: 'Demo Case', isDemo: true });

  const realArt = store.createArtifact({ investigationId: realInv.id, filename: 'real.mp4', isDemo: false });
  const demoArt = store.createArtifact({ investigationId: demoInv.id, filename: 'demo.mp4', isDemo: true });

  const realGraph = buildGenealogyGraph(store, realInv.id);
  assert(realGraph.nodes.every(n => !n.isDemo));
  assert(realGraph.nodes.some(n => n.id === realArt.id));
  assert(!realGraph.nodes.some(n => n.id === demoArt.id));
});

// ---------------------------------------------------------------------------
// TEST 26: Demo genealogy operations operate cleanly in demo namespace
// ---------------------------------------------------------------------------
runTest('Test 26: Demo genealogy operations operate cleanly within isolated demo namespace', () => {
  const store = new ProvenanceStore();
  const demoInv = store.createInvestigation({ title: 'Demo Case', isDemo: true });
  const demoArt1 = store.createArtifact({ investigationId: demoInv.id, filename: 'demo1.mp4', isDemo: true, dimensions: { width: 1920, height: 1080 } });
  const demoArt2 = store.createArtifact({ investigationId: demoInv.id, filename: 'demo2.mp4', isDemo: true, dimensions: { width: 1280, height: 720 } });

  const res = analyzeArtifactTransformations(store, demoInv.id, demoArt1.id, demoArt2.id, { isDemo: true });
  assert.strictEqual(res.detailedTransformations[0].isDemo, true);
  assert(res.findings[0].limitations.some(l => l.includes('DEMO SCENARIO')));
});

// ---------------------------------------------------------------------------
// TEST 27: Manual genealogy relationship creation
// ---------------------------------------------------------------------------
runTest('Test 27: Manual genealogy relationship creation creates audited ledger entries', () => {
  const store = provenanceService.store;
  const inv = store.createInvestigation({ title: 'Manual Relationship Case' });
  const artA = store.createArtifact({ investigationId: inv.id, filename: 'src.mp4' });
  const artB = store.createArtifact({ investigationId: inv.id, filename: 'dst.mp4' });

  const result = provenanceService.createGenealogyRelationship({
    investigationId: inv.id,
    fromArtifactId: artA.id,
    toArtifactId: artB.id,
    transformationType: TransformationTypes.CROP,
    direction: TransformationDirection.FORWARD,
    confidence: 0.90
  });

  assert(result.relationship);
  assert(result.transformation);
  assert.strictEqual(result.transformation.type, TransformationTypes.CROP);
  assert.strictEqual(result.evidence.polarity, EvidencePolarity.SUPPORTING);
});

// ---------------------------------------------------------------------------
// TEST 28: Authoritative case INV-VM-2026-CHAMP contains seeded multi-version genealogy
// ---------------------------------------------------------------------------
runTest('Test 28: Seeded investigation INV-VM-2026-CHAMP contains multi-version genealogy with transformations', () => {
  const graph = provenanceService.getGenealogy('INV-VM-2026-CHAMP');
  assert(graph, 'Graph must exist for INV-VM-2026-CHAMP');
  assert(graph.nodes.length >= 3, 'Must have at least 3 multi-version artifacts');
  assert(graph.edges.length >= 2, 'Must have at least 2 transformation edges');
  assert(graph.earliestObservedAppearance, 'Must have earliest observed appearance');
});

// ---------------------------------------------------------------------------
// TEST 29: Provenance service genealogy methods return expected schemas
// ---------------------------------------------------------------------------
runTest('Test 29: Service methods getMediaHistory and getArtifactTransformations return valid data', () => {
  const invs = provenanceService.getInvestigations();
  const champInv = invs.find(i => i.id === 'INV-VM-2026-CHAMP');
  assert(champInv, 'INV-VM-2026-CHAMP must exist in provenance service');

  const history = provenanceService.getMediaHistory(champInv.id);
  assert(history.nodes && history.edges);

  const firstArtId = champInv.artifactIds[0];
  const trfs = provenanceService.getArtifactTransformations(firstArtId);
  assert(Array.isArray(trfs));
});

// ---------------------------------------------------------------------------
// TEST 30: Audit confirms zero prohibited certainty language across all outputs
// ---------------------------------------------------------------------------
runTest('Test 30: Audit confirms zero prohibited certainty language in Phase I outputs', () => {
  const graph = provenanceService.getGenealogy('INV-VM-2026-CHAMP');
  const graphStr = JSON.stringify(graph).toUpperCase();

  for (const term of PROHIBITED_CERTAINTY_TERMS) {
    assert(!graphStr.includes(term), `Prohibited term '${term}' found in genealogy graph output`);
  }
});

console.log('========================================');
console.log(`Phase I Test Suite: ${passed}/30 PASSED`);
console.log('========================================\n');
