// Test Suite: Bulk Reference Comparison Pipeline & Archive Security
import assert from 'assert';
import FormData from 'form-data';
import fetch from 'node-fetch';
import sharp from 'sharp';
import AdmZip from 'adm-zip';

const PORT = 3000;
const BASE = `http://127.0.0.1:${PORT}`;

async function generateSvgImage(svgContent) {
  return await sharp(Buffer.from(svgContent)).jpeg({ quality: 90 }).toBuffer();
}

async function runTests() {
  console.log('=== Starting Bulk Reference Comparison Pipeline Tests ===\n');

  // Generate Reference Image with visual structure (blue circle on white background)
  const refSvg = '<svg width="150" height="150"><rect width="150" height="150" fill="#ffffff"/><circle cx="75" cy="75" r="50" fill="#0000ff"/></svg>';
  const referenceBuffer = await generateSvgImage(refSvg);

  // 1. Normal Comparison: 3 Candidates (Identical, Derivative, Unrelated)
  console.log('[Test 1] Testing normal batch comparison with 3 candidates...');
  {
    // Candidate 1: Identical copy (exact byte buffer)
    const candIdentical = referenceBuffer;

    // Candidate 2: Derivative (reference with red badge/overlay -> similarity ~89%)
    const derivSvg = '<svg width="150" height="150"><rect width="150" height="150" fill="#ffffff"/><circle cx="75" cy="75" r="45" fill="#0000ee"/><rect x="10" y="10" width="20" height="20" fill="#ff0000"/></svg>';
    const candDerivative = await generateSvgImage(derivSvg);

    // Candidate 3: Unrelated (horizontal stripes -> similarity ~43%)
    const unrelSvg = '<svg width="150" height="150"><rect width="150" height="150" fill="#ffffff"/><rect y="0" width="150" height="20" fill="#000000"/><rect y="40" width="150" height="20" fill="#000000"/><rect y="80" width="150" height="20" fill="#000000"/><rect y="120" width="150" height="20" fill="#000000"/></svg>';
    const candUnrelated = await generateSvgImage(unrelSvg);

    const zip = new AdmZip();
    zip.addFile('identical_copy.jpg', candIdentical);
    zip.addFile('derivative_work.jpg', candDerivative);
    zip.addFile('unrelated_image.jpg', candUnrelated);
    const bundleBuffer = zip.toBuffer();

    const form = new FormData();
    form.append('reference', referenceBuffer, { filename: 'master_reference.jpg', contentType: 'image/jpeg' });
    form.append('bundle', bundleBuffer, { filename: 'candidates_bundle.zip', contentType: 'application/zip' });

    const res = await fetch(`${BASE}/api/artifacts/batch-compare`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    assert.strictEqual(res.status, 202, `Expected status 202 Accepted, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.jobId, 'Expected jobId in response');
    assert.strictEqual(data.candidateCount, 3);
    assert.ok(data.pollUrl, 'Expected pollUrl');

    console.log(`  Job queued with ID: ${data.jobId}. Polling for completion...`);

    // Poll until completed
    let completedJob = null;
    const start = Date.now();
    while (Date.now() - start < 150000) {
      await new Promise(r => setTimeout(r, 600));
      const pollRes = await fetch(`${BASE}${data.pollUrl}`);
      assert.strictEqual(pollRes.status, 200);
      const resJson = await pollRes.json();
      const job = resJson.job || resJson;
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        completedJob = job;
        break;
      }
    }

    assert.ok(completedJob, 'Job did not finish within timeout');
    assert.strictEqual(completedJob.status, 'COMPLETED', `Job failed with error: ${completedJob.error}`);
    assert.ok(completedJob.result, 'Expected result payload in completed job');

    const result = completedJob.result;
    assert.strictEqual(result.summary.totalCandidates, 3);
    assert.strictEqual(result.summary.identicalCount, 1, 'Expected 1 identical copy');
    assert.ok(result.summary.nearIdenticalCount >= 0);
    assert.ok(result.summary.derivativeCount >= 0);
    assert.ok(result.summary.unrelatedCount >= 1, 'Expected at least 1 unrelated');

    // Check individual candidate relations
    const identResult = result.candidates.find(c => c.filename === 'identical_copy.jpg');
    assert.ok(identResult, 'Candidate identical_copy.jpg must be present');
    assert.strictEqual(identResult.relation, 'IDENTICAL_COPY');
    assert.strictEqual(identResult.similarity, 1.0);

    const unrelResult = result.candidates.find(c => c.filename === 'unrelated_image.jpg');
    assert.ok(unrelResult, 'Candidate unrelated_image.jpg must be present');
    assert.strictEqual(unrelResult.relation, 'UNRELATED');
    assert.ok(unrelResult.similarity < 0.80);

    console.log('  ✓ Test 1 passed: Normal comparison classified 3 candidates successfully.');
  }

  // 2. Security Limit: Zip with > 200 entries -> assert HTTP 400
  console.log('\n[Test 2] Testing security limit: Zip with > 200 entries...');
  {
    const dummyImg = Buffer.from('fake image content for limit test');
    const bigZip = new AdmZip();
    for (let i = 0; i < 205; i++) {
      bigZip.addFile(`entry_${i}.jpg`, dummyImg);
    }
    const bigZipBuffer = bigZip.toBuffer();

    const form = new FormData();
    form.append('reference', referenceBuffer, { filename: 'master.jpg', contentType: 'image/jpeg' });
    form.append('bundle', bigZipBuffer, { filename: 'too_many_entries.zip', contentType: 'application/zip' });

    const res = await fetch(`${BASE}/api/artifacts/batch-compare`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    assert.strictEqual(res.status, 400, `Expected 400 for > 200 entries, got ${res.status}`);
    const errData = await res.json();
    assert.ok(errData.error && errData.error.includes('200 entries'), `Error must mention entry limit (got: ${errData.error})`);
    console.log('  ✓ Test 2 passed: Zip exceeding 200 entries rejected with 400.');
  }

  // 3. Security Limit: Path traversal entry name (../evil.jpg) -> assert HTTP 400
  console.log('\n[Test 3] Testing security limit: Path traversal entry rejection...');
  {
    const dummyImg = Buffer.from('fake image content for traversal test');
    const traversalZip = new AdmZip();
    traversalZip.addFile('evil_overwrite.jpg', dummyImg);
    const entries = traversalZip.getEntries();
    if (entries.length > 0) entries[0].entryName = '../evil_overwrite.jpg';
    const traversalZipBuffer = traversalZip.toBuffer();

    const form = new FormData();
    form.append('reference', referenceBuffer, { filename: 'master.jpg', contentType: 'image/jpeg' });
    form.append('bundle', traversalZipBuffer, { filename: 'traversal.zip', contentType: 'application/zip' });

    const res = await fetch(`${BASE}/api/artifacts/batch-compare`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    assert.strictEqual(res.status, 400, `Expected 400 for path traversal, got ${res.status}`);
    const errData = await res.json();
    assert.ok(
      errData.error && (errData.error.toLowerCase().includes('traversal') || errData.error.includes('..')),
      `Error must describe traversal violation (got: ${errData.error})`
    );
    console.log('  ✓ Test 3 passed: Path traversal attempt rejected with 400.');
  }

  // 4. Security Limit: Nested archive (.zip inside bundle) -> assert HTTP 400
  console.log('\n[Test 4] Testing security limit: Nested archive rejection...');
  {
    const innerZip = new AdmZip();
    innerZip.addFile('innermost.jpg', Buffer.from('dummy image data'));
    const innerBuffer = innerZip.toBuffer();

    const outerZip = new AdmZip();
    outerZip.addFile('legit.jpg', Buffer.from('dummy legitimate image'));
    outerZip.addFile('hidden_nested.zip', innerBuffer);
    const outerBuffer = outerZip.toBuffer();

    const form = new FormData();
    form.append('reference', referenceBuffer, { filename: 'master.jpg', contentType: 'image/jpeg' });
    form.append('bundle', outerBuffer, { filename: 'nested_archive.zip', contentType: 'application/zip' });

    const res = await fetch(`${BASE}/api/artifacts/batch-compare`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    assert.strictEqual(res.status, 400, `Expected 400 for nested archive, got ${res.status}`);
    const errData = await res.json();
    assert.ok(
      errData.error && errData.error.toLowerCase().includes('nested archive'),
      `Error must explain nested archive rejection (got: ${errData.error})`
    );
    console.log('  ✓ Test 4 passed: Nested archive entry rejected with 400.');
  }

  // 5. Security Limit: Declared uncompressed size exceeding 500MB -> assert HTTP 400
  console.log('\n[Test 5] Testing security limit: Uncompressed size exceeding 500MB...');
  {
    const zip500 = new AdmZip();
    // Create an entry that declares a size > 500MB in header
    zip500.addFile('big_image.jpg', Buffer.from('small bytes'));
    const entries = zip500.getEntries();
    if (entries[0] && entries[0].header) {
      entries[0].header.size = 550 * 1024 * 1024;
    }
    const buf500 = zip500.toBuffer();

    const form = new FormData();
    form.append('reference', referenceBuffer, { filename: 'master.jpg', contentType: 'image/jpeg' });
    form.append('bundle', buf500, { filename: 'huge_declared_size.zip', contentType: 'application/zip' });

    const res = await fetch(`${BASE}/api/artifacts/batch-compare`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    assert.strictEqual(res.status, 400, `Expected 400 for declared size > 500MB, got ${res.status}`);
    const errData = await res.json();
    assert.ok(
      errData.error && (errData.error.includes('500MB') || errData.error.includes('uncompressed size')),
      `Error must mention 500MB limit (got: ${errData.error})`
    );
    console.log('  ✓ Test 5 passed: Declared size > 500MB rejected with 400.');
  }

  console.log('\n=== All Bulk Reference Comparison Pipeline Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
