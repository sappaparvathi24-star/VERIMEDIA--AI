// VeriMedia AI — Test Suite: Non-Fabrication & Honest Pipelines
import assert from 'assert';
import { ProvenanceService } from '../src/provenance/service.js';
import { ProvenanceStore } from '../src/provenance/core.js';
import sharp from 'sharp';

async function runNonFabricationTests() {
  console.log('── Running VeriMedia AI Non-Fabrication & Forensic Fallback Tests ──');

  const store = new ProvenanceStore();
  const service = new ProvenanceService(store);

  // Generate a test JPEG buffer
  const testBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 120, g: 140, b: 160 }
    }
  }).jpeg().toBuffer();

  const inv = store.createInvestigation({
    title: 'Non-Fabrication Test Case',
    description: 'Verifying that uncomputed fields and missing vision verdicts are not fabricated.'
  });

  const artifact = store.createArtifact({
    investigationId: inv.id,
    type: 'IMAGE',
    filename: 'test_sample.jpg',
    mimeType: 'image/jpeg',
    byteSize: testBuffer.length
  });

  // Test 1: Fallback when Gemini Vision is NOT called or fails
  console.log('1. Testing Gemini vision failure fallback (no callGeminiFn)...');
  const resultWithoutVision = await service.runImageForensicAnalysis({
    investigationId: inv.id,
    artifactId: artifact.id,
    buffer: testBuffer,
    mimeType: 'image/jpeg',
    filename: 'test_sample.jpg',
    callGeminiFn: null // Simulating missing or failed vision call
  });

  const analysis = resultWithoutVision.forensicAnalysis;
  assert.strictEqual(analysis.authenticity, null, 'Authenticity must be null when vision model fails/is absent');
  assert.strictEqual(analysis.trustScore, null, 'Trust score must be null (never 92 or 35) when vision model fails');
  assert.strictEqual(analysis.manipulationProbability, null, 'Manipulation probability must be null when vision model fails');
  assert.strictEqual(analysis.status, 'INCONCLUSIVE', 'Status must be INCONCLUSIVE');
  assert.ok(analysis.reason, 'A clear explanatory reason must be provided');
  assert.strictEqual(analysis.source, null, 'Source must be null when no vision model ran');
  assert.ok(Array.isArray(analysis.limitations), 'Limitations array must be present');
  assert.strictEqual(analysis.signals.color_diff, null, 'color_diff must be null (not hardcoded 0.12)');
  assert.strictEqual(analysis.signals.watermark_detected, null, 'watermark_detected must be null (not hardcoded 0.0)');
  console.log('✔ [PASS] Test 1: Fallback without vision model returns null authenticity/trustScore, status INCONCLUSIVE, and no fabricated constants.');

  // Test 2: Gemini Vision execution attaches LLM_VISION_OPINION and limitations
  console.log('2. Testing Gemini vision success with mock vision function...');
  const mockVisionOutput = {
    authenticity: 'MANIPULATED',
    trust_score: 41,
    manipulation_probability: 0.73,
    confidence: 0.86,
    verdict: 'Facial Boundary Anomaly Observed',
    summary: 'Localized blending discrepancies along mandibular contour.',
    subject_description: 'Portrait photograph',
    visual_findings: ['Color discontinuity along jawline'],
    signals: {
      spatial_diff: 0.68,
      noise_score: 0.55,
      face_landmark: 0.72,
      edge_consistency: 0.40
    },
    detected_anomalies: ['Jawline inpainting trace'],
    risk_level: 'HIGH',
    recommended_action: 'TAKEDOWN',
    dmca_needed: true
  };

  const mockCallGemini = async () => ({
    text: JSON.stringify(mockVisionOutput),
    model: 'gemini-2.5-flash'
  });

  const resultWithVision = await service.runImageForensicAnalysis({
    investigationId: inv.id,
    artifactId: artifact.id,
    buffer: testBuffer,
    mimeType: 'image/jpeg',
    filename: 'test_sample.jpg',
    callGeminiFn: mockCallGemini
  });

  const visionAnalysis = resultWithVision.forensicAnalysis;
  assert.strictEqual(visionAnalysis.authenticity, 'MANIPULATED');
  assert.strictEqual(visionAnalysis.trustScore, 41);
  assert.strictEqual(visionAnalysis.source, 'LLM_VISION_OPINION', 'Source must be LLM_VISION_OPINION');
  assert.ok(Array.isArray(visionAnalysis.limitations), 'Limitations array must be attached');
  assert.ok(visionAnalysis.limitations.some(l => l.includes('subjective probabilistic visual interpretations') || l.includes('uncalibrated') || l.includes('qualitative')), 'Must include calibration limitations note');
  assert.strictEqual(visionAnalysis.signals.color_diff, null, 'Uncomputed color_diff must remain null');
  console.log('✔ [PASS] Test 2: Successful vision execution attaches source: LLM_VISION_OPINION and explicit calibration limitations.');

  // Test 3: Gemini Vision prompt format without pre-set trust_score / confidence (Prompt 10)
  console.log('3. Testing downstream calibration when model outputs categorical label and justification only...');
  const categoricalOnlyVisionOutput = {
    authenticity: 'AI_GENERATED',
    verdict: 'Synthetic diffusion characteristics observed in background and anatomical regions',
    summary: 'High-frequency diffusion textures with loss of epidermal pore resolution and unnatural specular reflections.',
    subject_description: 'Synthetic portrait rendering',
    visual_findings: [
      'Nonsensical geometric patterns in background foliage',
      'Synthetic smoothing across facial cutaneous structures'
    ],
    detected_anomalies: [
      'Prompt leakage artifacts along perimeter',
      'Hallucinated limb topology'
    ],
    risk_level: 'HIGH',
    recommended_action: 'REQUEST_ATTRIBUTION',
    dmca_needed: false
    // Note: NO trust_score, NO confidence, NO manipulation_probability provided by model
  };

  const mockCategoricalGemini = async () => ({
    text: JSON.stringify(categoricalOnlyVisionOutput),
    model: 'gemini-2.5-flash'
  });

  const resultCategorical = await service.runImageForensicAnalysis({
    investigationId: inv.id,
    artifactId: artifact.id,
    buffer: testBuffer,
    mimeType: 'image/jpeg',
    filename: 'test_sample.jpg',
    callGeminiFn: mockCategoricalGemini
  });

  const catAnalysis = resultCategorical.forensicAnalysis;
  assert.strictEqual(catAnalysis.authenticity, 'AI_GENERATED');
  assert.ok(typeof catAnalysis.trustScore === 'number', 'Trust score must be calibrated downstream (number)');
  assert.ok(catAnalysis.trustScore <= 25, 'Calibrated trust score for AI_GENERATED should reflect low authenticity');
  assert.ok(typeof catAnalysis.manipulationProbability === 'number', 'Manipulation probability must be calibrated downstream');
  assert.ok(catAnalysis.manipulationProbability >= 0.80, 'Calibrated manipulation probability for AI_GENERATED should be >= 0.80');
  assert.ok(typeof catAnalysis.confidence === 'number', 'Confidence must be calibrated downstream');
  console.log('✔ [PASS] Test 3: Downstream calibration derives numeric metrics from categorical label and physical signals without prompt anchors.');

  // Test 4: Grounded propagation confidence derivation (Prompt 11)
  console.log('4. Testing propagation event confidence derivation from backing discovery candidates...');
  const { analyzePropagation } = await import('../src/provenance/propagation.js');

  const propInv = store.createInvestigation({
    title: 'Propagation Calibration Test',
    description: 'Verifying that synthesized propagation events do not use a flat 0.85 constant.'
  });

  const artExact = store.createArtifact({
    investigationId: propInv.id,
    type: 'IMAGE',
    filename: 'exact.jpg',
    mimeType: 'image/jpeg',
    byteSize: 5000
  });

  const artPerceptual = store.createArtifact({
    investigationId: propInv.id,
    type: 'IMAGE',
    filename: 'perceptual.jpg',
    mimeType: 'image/jpeg',
    byteSize: 5000
  });

  const artText = store.createArtifact({
    investigationId: propInv.id,
    type: 'IMAGE',
    filename: 'text.jpg',
    mimeType: 'image/jpeg',
    byteSize: 5000
  });

  const artUnbacked = store.createArtifact({
    investigationId: propInv.id,
    type: 'IMAGE',
    filename: 'unbacked.jpg',
    mimeType: 'image/jpeg',
    byteSize: 5000
  });

  const src1 = store.createSource({ platform: 'Web', url: 'https://example.com/exact' });
  const src2 = store.createSource({ platform: 'Reddit', url: 'https://reddit.com/r/pic/perceptual' });
  const src3 = store.createSource({ platform: 'YouTube', url: 'https://youtube.com/watch?v=text' });
  const src4 = store.createSource({ platform: 'Twitter', url: 'https://twitter.com/unbacked' });

  // 1. Exact match candidate
  store.createDiscoveryCandidate({
    investigationId: propInv.id,
    sourceId: src1.id,
    matchedArtifactId: artExact.id,
    similarityMeasurements: {
      exactMatch: true,
      comparisonMethod: 'SHA256_HASH'
    }
  });

  // 2. Perceptual match candidate with visualSimilarity: 0.92
  store.createDiscoveryCandidate({
    investigationId: propInv.id,
    sourceId: src2.id,
    matchedArtifactId: artPerceptual.id,
    similarityMeasurements: {
      exactMatch: false,
      visualSimilarity: 0.92,
      comparisonMethod: 'PDQ_PERCEPTUAL_HASH'
    }
  });

  // 3. Weak semantic text match candidate
  store.createDiscoveryCandidate({
    investigationId: propInv.id,
    sourceId: src3.id,
    matchedArtifactId: artText.id,
    similarityMeasurements: {
      exactMatch: false,
      similarityStatus: 'TEXT_MATCH_ONLY',
      comparisonMethod: 'EXTERNAL_API_METADATA_SEARCH'
    }
  });

  // Create appearances for all 4 artifacts
  store.createAppearance({
    investigationId: propInv.id,
    artifactId: artExact.id,
    sourceId: src1.id,
    publishedAt: '2026-01-01T10:00:00Z'
  });

  store.createAppearance({
    investigationId: propInv.id,
    artifactId: artPerceptual.id,
    sourceId: src2.id,
    publishedAt: '2026-01-02T10:00:00Z'
  });

  store.createAppearance({
    investigationId: propInv.id,
    artifactId: artText.id,
    sourceId: src3.id,
    publishedAt: '2026-01-03T10:00:00Z'
  });

  store.createAppearance({
    investigationId: propInv.id,
    artifactId: artUnbacked.id,
    sourceId: src4.id,
    publishedAt: '2026-01-04T10:00:00Z'
  });

  // Run propagation analysis (fallback to appearances)
  const propAnalysis = analyzePropagation(store, propInv.id);

  const exactEvent = propAnalysis.events.find(e => e.artifactId === artExact.id);
  const perceptualEvent = propAnalysis.events.find(e => e.artifactId === artPerceptual.id);
  const textEvent = propAnalysis.events.find(e => e.artifactId === artText.id);
  const unbackedEvent = propAnalysis.events.find(e => e.artifactId === artUnbacked.id);

  assert.strictEqual(exactEvent.confidence, 1.0, 'Exact match must score 1.0 confidence');
  assert.strictEqual(exactEvent.retrievalMethod, 'EXACT_HASH_MATCH');

  assert.strictEqual(perceptualEvent.confidence, 0.92, 'Perceptual match must score visualSimilarity (0.92)');
  assert.strictEqual(perceptualEvent.retrievalMethod, 'PERCEPTUAL_FINGERPRINT_MATCH');

  assert.strictEqual(textEvent.confidence, 0.50, 'Text match only must score 0.50 confidence');
  assert.strictEqual(textEvent.retrievalMethod, 'EXTERNAL_API_METADATA_SEARCH');

  assert.strictEqual(unbackedEvent.confidence, null, 'Unbacked appearance must have null confidence (UNKNOWN)');
  assert.strictEqual(unbackedEvent.retrievalMethod, 'UNKNOWN');

  console.log('✔ [PASS] Test 4: Propagation appearances derive confidence from backing candidate data; unbacked appearances get null confidence.');

  console.log('========================================');
  console.log('Non-Fabrication Test Suite: ALL PASSED');
  console.log('========================================');
}

runNonFabricationTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
