// Regression Test: Detection Endpoint Returns Valid Investigation and Artifact IDs
// Verifies that /api/v1/detect always returns a non-empty investigationId and artifactId,
// and that the investigation exists in the provenance system so Discovery and Propagation can load.

import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../server.js';
import { provenanceService } from '../src/provenance/service.js';
import { generateToken } from '../src/security/auth.js';

// Sample 1x1 transparent PNG buffer
const samplePngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function runRegressionSuite() {
  console.log('── Running VeriMedia AI: Regression Test Suite for Detection Response IDs ──');
  const token = generateToken({ id: 'analyst-1', email: 'analyst@verimedia.ai', role: 'ANALYST', organizationId: 'org-1' });

  // Test 1: Direct file upload to /api/v1/detect generates and returns valid investigationId and artifactId
  console.log('[Test 1] Testing direct file upload to /api/v1/detect...');
  const res1 = await request(app)
    .post('/api/v1/detect')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', samplePngBuffer, 'evidence_image.png')
    .field('caption', 'Breaking news social sighting')
    .field('platform', 'YouTube');

  assert.strictEqual(res1.status, 200, `Expected 200, got ${res1.status}: ${JSON.stringify(res1.body)}`);
  assert.ok(res1.body, 'Response body must exist');
  assert.strictEqual(typeof res1.body.investigationId, 'string', 'investigationId must be a string');
  assert.ok(res1.body.investigationId.length > 0, 'investigationId must not be empty');
  assert.strictEqual(res1.body.case_id, res1.body.investigationId, 'case_id must match investigationId');
  assert.strictEqual(typeof res1.body.artifactId, 'string', 'artifactId must be a string');
  assert.ok(res1.body.artifactId.length > 0, 'artifactId must not be empty');
  assert.strictEqual(res1.body.artifact?.id, res1.body.artifactId, 'artifact.id must match artifactId');

  // Assert investigation exists in provenanceService
  const storedInv = provenanceService.getInvestigation(res1.body.investigationId);
  assert.ok(storedInv, `Investigation ${res1.body.investigationId} must exist in provenanceService`);
  assert.strictEqual(storedInv.id, res1.body.investigationId);

  // Verify candidates and propagation can be queried with this investigationId
  const candidatesRes = await request(app)
    .get(`/api/investigations/${res1.body.investigationId}/discovery/candidates`)
    .set('Authorization', `Bearer ${token}`);
  assert.strictEqual(candidatesRes.status, 200, 'Discovery candidates endpoint must succeed for this investigation');

  const propagationRes = await request(app)
    .get(`/api/investigations/${res1.body.investigationId}/propagation`)
    .set('Authorization', `Bearer ${token}`);
  assert.strictEqual(propagationRes.status, 200, 'Propagation endpoint must succeed for this investigation');
  console.log('✔ [PASS] Test 1: Direct file upload generates and returns valid investigationId and artifactId matching live investigation');

  // Test 2: Upload with explicitly provided investigationId preserves that investigationId
  console.log('[Test 2] Testing upload with explicitly provided investigationId...');
  const customInv = provenanceService.createInvestigation({
    title: 'Pre-existing Case for Test',
    description: 'Verifying custom investigationId propagation',
    createdBy: 'analyst@verimedia.ai',
    isDemo: false
  });

  const res2 = await request(app)
    .post('/api/v1/detect')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', samplePngBuffer, 'custom_case_media.png')
    .field('investigationId', customInv.id)
    .field('caption', 'Specific investigation file upload');

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.investigationId, customInv.id, 'Response must return the provided investigationId');
  assert.strictEqual(res2.body.case_id, customInv.id, 'case_id must match customInv.id');
  assert.ok(typeof res2.body.artifactId === 'string' && res2.body.artifactId.length > 0, 'artifactId must be non-empty');
  console.log('✔ [PASS] Test 2: Provided investigationId is correctly preserved in detection result');

  // Test 3: Calling /api/v1/detect with pre-registered artifact returns investigationId and artifactId
  console.log('[Test 3] Testing /api/v1/detect with pre-registered artifact...');
  const inv3 = provenanceService.createInvestigation({
    title: 'Pre-registered Artifact Case',
    description: 'Testing artifact-based detect flow',
    createdBy: 'analyst@verimedia.ai',
    isDemo: false
  });

  const artifact3 = provenanceService.createArtifact({
    investigationId: inv3.id,
    filename: 'sample_registered.png',
    mimeType: 'image/png',
    byteSize: samplePngBuffer.length,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
  });

  const res3 = await request(app)
    .post('/api/v1/detect')
    .set('Authorization', `Bearer ${token}`)
    .send({
      artifactId: artifact3.id,
      investigationId: inv3.id,
      platform: 'Reddit',
      caption: 'Scan of pre-registered artifact'
    });

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.investigationId, inv3.id, 'investigationId must match the artifact investigation');
  assert.strictEqual(res3.body.artifactId, artifact3.id, 'artifactId must match the registered artifact');
  assert.strictEqual(res3.body.case_id, inv3.id, 'case_id must match inv3.id');
  console.log('✔ [PASS] Test 3: Pre-registered artifact detect returns valid investigationId and artifactId');

  console.log('\n✅ All regression tests passed successfully!');
  process.exit(0);
}

runRegressionSuite().catch(err => {
  console.error('❌ Regression test failed:', err);
  process.exit(1);
});
