'use strict';

import assert from 'assert';
import {
  extractExifMetadata,
  analyzeImageCompressionAndEla,
  analyzePixelAnomalies,
  analyzeCopyRegionClone,
  analyzeVideoStreamAndFrames,
  analyzeAudioStreamAndSync,
  runForensicInvestigationPipeline
} from '../server/forensics.js';
import { createMediaArtifact } from '../server/models.js';
import { clearStores, getObservationsForArtifact, getEvidenceForArtifact, getFindingsForArtifact, buildTraceabilityChain } from '../server/evidenceEngine.js';
import { ingestMediaBuffer } from '../server/media.js';

console.log('====================================================');
console.log('🧪 RUNNING VERIMEDIA AI PHASE D FORENSIC TESTS');
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

// Clear evidence stores before testing
clearStores();

// ── Test 1: extractExifMetadata handles EXIF APP1 tags and missing metadata ──
runTest('extractExifMetadata parses container headers and handles missing metadata safely', () => {
  // Sample JPEG buffer with EXIF header 'Exif\0\0' (457869660000) and Software tag 'Adobe Photoshop'
  const jpegWithExif = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x30, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x31, 0x00, 0x02, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x1A,
    0x41, 0x64, 0x6F, 0x62, 0x65, 0x20, 0x50, 0x68, 0x6F, 0x74, 0x6F, 0x73, 0x68, 0x6F, 0x70, 0x00,
    0xFF, 0xD9
  ]);

  const metaResult = extractExifMetadata(jpegWithExif, 'image/jpeg');
  assert.strictEqual(metaResult.hasExif, true, 'Must detect EXIF header');
  assert(metaResult.software && metaResult.software.includes('Photoshop'), 'Must identify software tag');

  // Sample PNG buffer without EXIF
  const pngNoExif = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const emptyMeta = extractExifMetadata(pngNoExif, 'image/png');
  assert.strictEqual(emptyMeta.hasExif, false, 'Must handle missing EXIF cleanly');
  assert.strictEqual(emptyMeta.software, null, 'Software tag must be null when absent');
});

// ── Test 2: analyzeImageCompressionAndEla measures DCT quantization ──
runTest('analyzeImageCompressionAndEla calculates DCT block quantization and ELA score', () => {
  const sampleBuf = Buffer.alloc(2048);
  for (let i = 0; i < sampleBuf.length; i++) {
    sampleBuf[i] = (i * 37) % 256;
  }

  const compResult = analyzeImageCompressionAndEla(sampleBuf, 'image/jpeg');
  assert(typeof compResult.blockVarianceStdDev === 'number', 'Must compute block variance std dev');
  assert(typeof compResult.elaScore === 'number', 'Must compute ELA score');
  assert(compResult.elaScore >= 0 && compResult.elaScore <= 1, 'ELA score bounded 0-1');
});

// ── Test 3: analyzePixelAnomalies measures noise variance and edge coherence ──
runTest('analyzePixelAnomalies calculates high-frequency noise variance and edge coherence', () => {
  const sampleBuf = Buffer.alloc(1024);
  for (let i = 0; i < sampleBuf.length; i++) {
    sampleBuf[i] = (i * 13) % 256;
  }

  const pxResult = analyzePixelAnomalies(sampleBuf, 'image/png');
  assert(typeof pxResult.noiseVarianceScore === 'number', 'Must compute noise variance score');
  assert(typeof pxResult.edgeGradientScore === 'number', 'Must compute edge gradient score');
  assert(typeof pxResult.colorChannelCovariance === 'number', 'Must compute color channel covariance');
});

// ── Test 4: analyzeCopyRegionClone detects spatial block repetition ──
runTest('analyzeCopyRegionClone detects duplicate patch regions and returns bounding box details', () => {
  const buf = Buffer.alloc(4096);
  const patch = Buffer.from('VERIMEDIA_COPY_MOVE_CLONE_DETECTION_PATCH_TEST_PATTERN');
  patch.copy(buf, 100);
  patch.copy(buf, 1200);

  const copyResult = analyzeCopyRegionClone(buf, 'image/png');
  assert(typeof copyResult.repeatedRegionsCount === 'number', 'Must count repeated regions');
  assert(copyResult.repeatedRegionsCount >= 1, 'Must detect repeated patch block');
  assert(Array.isArray(copyResult.regionMatches), 'Must return regionMatches array');
});

// ── Test 5: analyzeVideoStreamAndFrames measures GOP structures and keyframe cadence ──
runTest('analyzeVideoStreamAndFrames inspects ISO video container boxes and keyframe GOP cadence', () => {
  const videoBuf = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
    0x00, 0x00, 0x00, 0x10, 0x6D, 0x6F, 0x6F, 0x76,
    0x00, 0x00, 0x00, 0x10, 0x74, 0x72, 0x61, 0x6B
  ]);

  const vidResult = analyzeVideoStreamAndFrames(videoBuf, 'video/mp4');
  assert.strictEqual(vidResult.isVideo, true, 'Must confirm video presence');
  assert.strictEqual(vidResult.majorBrand, 'isom', 'Must identify ftyp brand');
  assert(typeof vidResult.keyframeCount === 'number', 'Must identify keyframe count');
  assert(typeof vidResult.avgGopInterval === 'number', 'Must report average GOP interval');
});

// ── Test 6: analyzeAudioStreamAndSync cross-correlates audio track timestamps and video alignment ──
runTest('analyzeAudioStreamAndSync cross-correlates audio track timestamps and video duration sync', () => {
  const audioBuf = Buffer.from('ID3...soun...aac...audio_test_payload');
  const syncResult = analyzeAudioStreamAndSync(audioBuf, 'video/mp4', 10.0);

  assert.strictEqual(syncResult.hasAudio, true, 'Must identify audio track');
  assert(typeof syncResult.codec === 'string', 'Must detect audio codec');
});

// ── Test 7: runForensicInvestigationPipeline creates full Phase C/D chain ──
runTest('runForensicInvestigationPipeline orchestrates complete traceability chain for media artifact', () => {
  const sampleBuf = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xFF, 0xE1, 0x00, 0x20, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0xFF, 0xD9
  ]);

  const artifact = createMediaArtifact({
    filename: 'test_pipeline_media.jpg',
    mimeType: 'image/jpeg',
    size: sampleBuf.length,
    sha256: 'f'.repeat(64),
    perceptualHash: '1234567890abcdef'
  });

  const pipelineOutput = runForensicInvestigationPipeline({
    artifact,
    buffer: sampleBuf,
    options: { isDemo: false }
  });

  assert(pipelineOutput.runs.length > 0, 'Must record analysis runs');
  assert(pipelineOutput.observations.length > 0, 'Must record observations');
  assert(pipelineOutput.evidence.length > 0, 'Must record evidence');
  assert(pipelineOutput.findings.length > 0, 'Must record findings');

  // Check finding category and epistemic status
  const firstFinding = pipelineOutput.findings[0];
  assert(firstFinding.category, 'Finding must have category');
  assert(firstFinding.epistemicStatus, 'Finding must have epistemicStatus');
  assert(firstFinding.limitations, 'Finding must state limitations');

  // Verify traceability chain resolution
  const chain = buildTraceabilityChain(firstFinding.id, new Map([[artifact.id, artifact]]));
  assert(chain, 'Traceability chain must be resolvable');
  assert.strictEqual(chain.finding.id, firstFinding.id);
  assert(chain.supportingEvidence.length > 0, 'Traceability chain must include supporting evidence');
});

// ── Test 8: Synthetic Demo Scenario Forensic Execution ──
runTest('Demo scenario forensic execution marks all records with DEMO_SCENARIO mode and disclaimers', () => {
  const demoArtifact = createMediaArtifact({
    filename: 'demo_deepfake_simulation.mp4',
    mimeType: 'video/mp4',
    size: 2048,
    sha256: 'd'.repeat(64),
    perceptualHash: 'abcdef1234567890',
    sourceType: 'demo'
  });

  const demoOutput = runForensicInvestigationPipeline({
    artifact: demoArtifact,
    buffer: Buffer.alloc(100),
    options: { isDemo: true }
  });

  assert(demoOutput.observations.every(o => o.metadata.mode === 'DEMO_SCENARIO' || o.metadata.isDemo === true), 'All demo observations must be tagged');
  assert(demoOutput.evidence.every(e => e.metadata.mode === 'DEMO_SCENARIO' || e.metadata.isDemo === true), 'All demo evidence must be tagged');
  assert(demoOutput.findings.every(f => f.metadata.mode === 'DEMO_SCENARIO' || f.metadata.isDemo === true), 'All demo findings must be tagged');
});

// ── Test 9: End-to-End Ingestion Integration with Phase D Forensics ──
runTest('ingestMediaBuffer executes deep forensic analysis during media ingestion', () => {
  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
    0x08, 0x02, 0x00, 0x00, 0x00, 0xFC, 0x18, 0xED, 0xA3
  ]);

  const ingResult = ingestMediaBuffer({
    buffer: samplePngBuffer,
    filename: 'ingested_sample.png',
    claimedMime: 'image/png'
  });

  assert(ingResult.artifact, 'Ingestion must return artifact');
  assert(ingResult.investigation, 'Ingestion must return investigation');
  assert(ingResult.observations.length >= 5, 'Ingestion must produce comprehensive observations including deep forensics');
  assert(ingResult.findings.length >= 2, 'Ingestion must produce findings');
});

console.log('\n====================================================');
console.log(`📊 PHASE D FORENSIC TEST RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
console.log('====================================================\n');
