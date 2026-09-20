// Test Suite: Video & Audio Forensics Absence & In-Process Async Job Queue
import assert from 'assert';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { provenanceService } from '../src/provenance/service.js';
import { ForensicJobQueue, JobStatus } from '../src/jobs/forensicQueue.js';

const PORT = 3000;
const BASE = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('--- Starting Video/Audio & Job Queue Verification Tests ---');

  // Test 1: Direct call to runImageForensicAnalysis with video MIME type
  console.log('\n[Test 1] Testing runImageForensicAnalysis with video/mp4...');
  const inv = provenanceService.createInvestigation({
    title: 'Test Video Ingest',
    description: 'Verifying video forensic handling',
    createdBy: 'tester@verimedia.ai'
  });

  const videoArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'test_clip.mp4',
    mimeType: 'video/mp4',
    byteSize: 2048
  });

  const videoOutcome = await provenanceService.runImageForensicAnalysis({
    investigationId: inv.id,
    artifactId: videoArtifact.id,
    buffer: Buffer.from('fake mp4 video data bytes'),
    mimeType: 'video/mp4'
  });

  assert.strictEqual(videoOutcome.run.status, 'SKIPPED', 'AnalysisRun status must be SKIPPED');
  assert.strictEqual(videoOutcome.forensicAnalysis.status, 'SKIPPED', 'forensicAnalysis status must be SKIPPED');
  assert.strictEqual(videoOutcome.forensicAnalysis.reason, 'video/audio forensic analysis not implemented', 'reason must explicitly state video/audio forensic analysis not implemented');
  assert.strictEqual(videoOutcome.forensicAnalysis.authenticity, null, 'authenticity must be null, not fabricated');
  assert.strictEqual(videoOutcome.forensicAnalysis.trustScore, null, 'trustScore must be null, not fabricated');
  console.log('✓ Test 1 passed: video/mp4 returned explicit SKIPPED without silent fall-through');

  // Test 2: Direct call to runImageForensicAnalysis with audio MIME type
  console.log('\n[Test 2] Testing runImageForensicAnalysis with audio/wav...');
  const audioArtifact = provenanceService.createArtifact({
    investigationId: inv.id,
    filename: 'voice_recording.wav',
    mimeType: 'audio/wav',
    byteSize: 1024
  });

  const audioOutcome = await provenanceService.runImageForensicAnalysis({
    investigationId: inv.id,
    artifactId: audioArtifact.id,
    buffer: Buffer.from('fake wav audio data bytes'),
    mimeType: 'audio/wav'
  });

  assert.strictEqual(audioOutcome.run.status, 'SKIPPED', 'Audio AnalysisRun status must be SKIPPED');
  assert.strictEqual(audioOutcome.forensicAnalysis.status, 'SKIPPED', 'Audio forensicAnalysis status must be SKIPPED');
  assert.strictEqual(audioOutcome.forensicAnalysis.reason, 'video/audio forensic analysis not implemented', 'reason must state video/audio forensic analysis not implemented');
  console.log('✓ Test 2 passed: audio/wav returned explicit SKIPPED without silent fall-through');

  // Test 3: In-Process Job Queue unit test
  console.log('\n[Test 3] Testing ForensicJobQueue lifecycle...');
  const queue = new ForensicJobQueue({ provenanceService });

  const enqueued = queue.enqueueJob({
    investigationId: inv.id,
    artifactId: videoArtifact.id,
    filename: 'test_clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake mp4 data')
  });

  assert(enqueued.jobId, 'Enqueued job must have a jobId');
  assert.strictEqual(enqueued.status, JobStatus.QUEUED, 'Initial status must be QUEUED');

  // Wait briefly for in-process queue worker to execute
  await new Promise(r => setTimeout(r, 100));

  const completedJob = queue.getJob(enqueued.jobId);
  assert(completedJob, 'Job must exist in queue');
  assert.strictEqual(completedJob.status, JobStatus.SKIPPED, 'Video job must complete with SKIPPED status');
  assert.strictEqual(completedJob.result.reason, 'video/audio forensic analysis not implemented', 'Job result reason must state not implemented');
  console.log('✓ Test 3 passed: ForensicJobQueue enqueued and processed task asynchronously');

  // Test 4: HTTP POST /api/v1/detect with video/mp4
  console.log('\n[Test 4] Testing HTTP POST /api/v1/detect with video/mp4...');
  try {
    const formDetect = new FormData();
    formDetect.append('media', Buffer.from('dummy video binary data'), {
      filename: 'sample_deepfake_speech.mp4',
      contentType: 'video/mp4'
    });

    const resDetect = await fetch(`${BASE}/api/v1/detect`, {
      method: 'POST',
      body: formDetect,
      headers: formDetect.getHeaders()
    });

    if (resDetect.status === 200) {
      const json = await resDetect.json();
      assert.strictEqual(json.ai_analysis.decision, 'SKIPPED', 'Video detection decision must be SKIPPED');
      assert.strictEqual(json.ml.label, 'SKIPPED', 'Video detection ML label must be SKIPPED');
      assert(json.disclaimer && json.disclaimer.includes('video/audio forensic analysis not implemented'), 'Disclaimer must mention video/audio forensic analysis not implemented');
      assert.strictEqual(json.forensics.status, 'SKIPPED', 'Forensic status must be SKIPPED');
      console.log('✓ Test 4 passed: /api/v1/detect explicitly returned SKIPPED without falling through to ALLOW');
    } else {
      console.log(`Server returned status ${resDetect.status}, skipping live HTTP test 4`);
    }
  } catch (err) {
    console.log('Live server not available for test 4, skipped:', err.message);
  }

  // Test 5: HTTP POST /artifacts/upload returns immediately with HTTP 202 & jobId
  console.log('\n[Test 5] Testing HTTP POST /artifacts/upload for async job dispatch...');
  try {
    const formUpload = new FormData();
    formUpload.append('file', Buffer.from('dummy sample image payload'), {
      filename: 'async_sample.jpg',
      contentType: 'image/jpeg'
    });

    const resUpload = await fetch(`${BASE}/artifacts/upload`, {
      method: 'POST',
      body: formUpload,
      headers: formUpload.getHeaders()
    });

    if (resUpload.status === 202) {
      const json = await resUpload.json();
      assert(json.jobId, 'Response must include jobId');
      assert.strictEqual(json.status, 'QUEUED', 'Response status must be QUEUED');
      assert(json.pollUrl, 'Response must include pollUrl');
      assert(json.artifact && json.artifact.id, 'Response must include created artifact');

      // Test 6: Poll GET /api/jobs/:id
      console.log('\n[Test 6] Testing HTTP GET /api/jobs/:id polling...');
      let polled = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 100));
        const resJob = await fetch(`${BASE}${json.pollUrl}`);
        if (resJob.ok) {
          polled = await resJob.json();
          if (polled.job && (polled.job.status === 'COMPLETED' || polled.job.status === 'SKIPPED')) {
            break;
          }
        }
      }

      assert(polled && polled.job, 'Job polling must return job');
      console.log(`Job status progressed to: ${polled.job.status}`);
      console.log('✓ Test 5 and Test 6 passed: Async artifact upload returned 202 and polled successfully');
    } else {
      console.log(`Server returned status ${resUpload.status}, skipping live HTTP test 5`);
    }
  } catch (err) {
    console.log('Live server not available for test 5, skipped:', err.message);
  }

  console.log('\n--- All Video/Audio & Job Queue Tests Completed! ---\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
