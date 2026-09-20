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

  console.log('========================================');
  console.log('Non-Fabrication Test Suite: ALL PASSED');
  console.log('========================================');
}

runNonFabricationTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
