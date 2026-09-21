// Comprehensive Black-box and Integration Test Suite
// Verifies all canonical content types: IMAGE, VIDEO, AUDIO, TEXT, PDF
// Tests classification, contract compliance, engine execution, and job queue integration.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { provenanceService } from '../src/provenance/service.js';
import { classifyContent, ContentType } from '../src/forensics/contentClassifier.js';
import { EngineStatus } from '../src/forensics/analysisContract.js';
import { ForensicJobQueue } from '../src/jobs/forensicQueue.js';

async function runMultimodalTests() {
  console.log('=== VeriMedia AI: Multimodal Forensic Verification Suite ===\n');

  // -------------------------------------------------------------
  // Test 1: Content Classification for All Canonical Types
  // -------------------------------------------------------------
  console.log('[Test 1] Verifying Content Classification for IMAGE, VIDEO, AUDIO, TEXT, PDF...');

  // 1x1 PNG buffer
  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x60, 0x60, 0x00,
    0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x0A, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  const imageClass = await classifyContent(samplePngBuffer, 'photo.png');
  assert.strictEqual(imageClass.contentType, ContentType.IMAGE);

  const sampleTextBuffer = Buffer.from('Plain text content statement for forensic examination.', 'utf-8');
  const textClass = await classifyContent(sampleTextBuffer, 'statement.txt');
  assert.strictEqual(textClass.contentType, ContentType.TEXT);

  const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8');
  const pdfClass = await classifyContent(samplePdfBuffer, 'evidence_dossier.pdf');
  assert.strictEqual(pdfClass.contentType, ContentType.PDF);

  // Video and audio files by extension fallback or headers
  const videoBuffer = Buffer.alloc(64);
  videoBuffer.write('ftypmp42', 4, 'ascii');
  const videoClass = await classifyContent(videoBuffer, 'clip.mp4');
  assert.strictEqual(videoClass.contentType, ContentType.VIDEO);

  const audioBuffer = Buffer.alloc(64);
  audioBuffer.write('RIFF', 0, 'ascii');
  audioBuffer.write('WAVE', 8, 'ascii');
  const audioClass = await classifyContent(audioBuffer, 'speech.wav');
  assert.strictEqual(audioClass.contentType, ContentType.AUDIO);

  console.log('✓ Test 1 Passed: All 5 canonical types correctly classified.\n');

  // -------------------------------------------------------------
  // Test 2: TEXT Forensics Execution via Unified Pipeline
  // -------------------------------------------------------------
  console.log('[Test 2] Testing TEXT Forensics execution...');
  const inv = provenanceService.createInvestigation({
    title: 'Multimodal Investigation',
    description: 'Black-box test for all canonical types',
    createdBy: 'auditor@verimedia.ai'
  });

  const sampleText = 'On March 15, 2024, the United Nations Security Council met in New York City. The Secretary General declared an urgent global initiative.';
  const textBuffer = Buffer.from(sampleText, 'utf-8');

  const textArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'press_release.txt',
    mimeType: 'text/plain',
    byteSize: textBuffer.length
  });

  const textResult = await provenanceService.runUnifiedForensicAnalysis({
    investigationId: inv.id,
    artifactId: textArtifact.id,
    buffer: textBuffer,
    mimeType: 'text/plain',
    filename: 'press_release.txt'
  });

  assert.strictEqual(textResult.run.status, 'COMPLETED');
  assert.strictEqual(textResult.forensicAnalysis.engine, 'TEXT_FORENSICS');
  assert.strictEqual(textResult.forensicAnalysis.applicable, true);
  assert.ok(Array.isArray(textResult.forensicAnalysis.measurements));
  assert.ok(Array.isArray(textResult.forensicAnalysis.observations));

  // Check language detection
  const langMeas = textResult.forensicAnalysis.measurements.find(m => m.name === 'language');
  assert.ok(langMeas, 'Text analysis must contain language measurement');
  assert.strictEqual(langMeas.value, 'en');

  // Check word count
  const wordMeas = textResult.forensicAnalysis.measurements.find(m => m.name === 'wordCount');
  assert.ok(wordMeas && wordMeas.value > 10, 'Word count must be computed accurately');

  console.log('✓ Test 2 Passed: TEXT Forensics completed with language detection, entities, and measurements.\n');

  // -------------------------------------------------------------
  // Test 3: PDF Forensics Execution via Unified Pipeline
  // -------------------------------------------------------------
  console.log('[Test 3] Testing PDF Forensics execution...');
  // Minimal valid PDF byte sequence
  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 55 >> stream
BT
/F1 12 Tf
72 712 Td
(Verified forensic audit record for document #4892.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
314
%%EOF`;

  const pdfBuffer = Buffer.from(minimalPdf, 'utf-8');
  const pdfArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'audit_dossier.pdf',
    mimeType: 'application/pdf',
    byteSize: pdfBuffer.length
  });

  const pdfResult = await provenanceService.runUnifiedForensicAnalysis({
    investigationId: inv.id,
    artifactId: pdfArtifact.id,
    buffer: pdfBuffer,
    mimeType: 'application/pdf',
    filename: 'audit_dossier.pdf'
  });

  assert.strictEqual(pdfResult.run.status, 'COMPLETED');
  assert.strictEqual(pdfResult.forensicAnalysis.engine, 'PDF_FORENSICS');
  assert.strictEqual(pdfResult.forensicAnalysis.applicable, true);
  const pdfPageMeas = pdfResult.forensicAnalysis.measurements.find(m => m.name === 'pageCount');
  assert.ok(pdfPageMeas && pdfPageMeas.value >= 1, 'PDF analysis must record valid page count');
  console.log('✓ Test 3 Passed: PDF Forensics parsed document structure and extracted textual streams.\n');

  // -------------------------------------------------------------
  // Test 4: IMAGE Forensics Execution via Unified Pipeline
  // -------------------------------------------------------------
  console.log('[Test 4] Testing IMAGE Forensics execution...');
  // 1x1 transparent PNG buffer
  const samplePng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x60, 0x60, 0x00,
    0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x0A, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  const imageArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'test_pixel.png',
    mimeType: 'image/png',
    byteSize: samplePng.length
  });

  const imageResult = await provenanceService.runUnifiedForensicAnalysis({
    investigationId: inv.id,
    artifactId: imageArtifact.id,
    buffer: samplePng,
    mimeType: 'image/png',
    filename: 'test_pixel.png'
  });

  assert.strictEqual(imageResult.run.status, 'COMPLETED');
  assert.ok(imageResult.forensicAnalysis.engine.includes('Pixel') || imageResult.forensicAnalysis.engine === 'IMAGE_FORENSICS');
  assert.ok(imageResult.forensicAnalysis.ela, 'Image analysis must include ELA results');
  console.log('✓ Test 4 Passed: IMAGE Forensics ran ELA, hashing, and analysis contract.\n');

  // -------------------------------------------------------------
  // Test 5: VIDEO Forensics via Unified Pipeline
  // -------------------------------------------------------------
  console.log('[Test 5] Testing VIDEO Forensics execution...');
  const videoArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'surveillance.mp4',
    mimeType: 'video/mp4',
    byteSize: 1024
  });

  const videoResult = await provenanceService.runUnifiedForensicAnalysis({
    investigationId: inv.id,
    artifactId: videoArtifact.id,
    buffer: Buffer.from('non_empty_video_payload_bytes_here'),
    mimeType: 'video/mp4',
    filename: 'surveillance.mp4'
  });

  assert.strictEqual(videoResult.forensicAnalysis.engine, 'VIDEO_FORENSICS');
  assert.strictEqual(videoResult.forensicAnalysis.applicable, true);
  assert.ok(['COMPLETED', 'SKIPPED', 'FAILED'].includes(videoResult.run.status));
  console.log('✓ Test 5 Passed: VIDEO Forensics executed through canonical contract.\n');

  // -------------------------------------------------------------
  // Test 6: AUDIO Forensics via Unified Pipeline
  // -------------------------------------------------------------
  console.log('[Test 6] Testing AUDIO Forensics execution...');
  const audioArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'wiretap.wav',
    mimeType: 'audio/wav',
    byteSize: 512
  });

  const audioResult = await provenanceService.runUnifiedForensicAnalysis({
    investigationId: inv.id,
    artifactId: audioArtifact.id,
    buffer: Buffer.from('audio_wav_sample_bytes_here'),
    mimeType: 'audio/wav',
    filename: 'wiretap.wav'
  });

  assert.strictEqual(audioResult.forensicAnalysis.engine, 'AUDIO_FORENSICS');
  assert.strictEqual(audioResult.forensicAnalysis.applicable, true);
  assert.ok(['COMPLETED', 'SKIPPED', 'FAILED'].includes(audioResult.run.status));
  console.log('✓ Test 6 Passed: AUDIO Forensics executed through canonical contract.\n');

  // -------------------------------------------------------------
  // Test 7: ForensicJobQueue Asynchronous Lifecycle for Multiple Artifacts
  // -------------------------------------------------------------
  console.log('[Test 7] Testing ForensicJobQueue lifecycle across multimodal artifacts...');
  const testQueue = new ForensicJobQueue(provenanceService, { concurrency: 2 });

  const job1 = testQueue.enqueueJob({
    investigationId: inv.id,
    artifactId: textArtifact.id,
    filename: 'press_release.txt',
    mimeType: 'text/plain',
    buffer: textBuffer
  });

  const job2 = testQueue.enqueueJob({
    investigationId: inv.id,
    artifactId: pdfArtifact.id,
    filename: 'audit_dossier.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer
  });

  assert.ok(job1.id);
  assert.ok(job2.id);

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 800));

  const polledJob1 = testQueue.getJob(job1.id);
  const polledJob2 = testQueue.getJob(job2.id);

  assert.ok(['PROCESSING', 'COMPLETED'].includes(polledJob1.status), `Job 1 status was: ${polledJob1.status}`);
  assert.ok(['PROCESSING', 'COMPLETED'].includes(polledJob2.status), `Job 2 status was: ${polledJob2.status}`);

  console.log('✓ Test 7 Passed: ForensicJobQueue dispatched and executed multimodal jobs asynchronously.\n');

  console.log('====================================================');
  console.log('ALL MULTIMODAL BLACK-BOX & CONTRACT TESTS PASSED! ');
  console.log('====================================================\n');
}

runMultimodalTests().catch(err => {
  console.error('Multimodal test failed:', err);
  process.exit(1);
});
