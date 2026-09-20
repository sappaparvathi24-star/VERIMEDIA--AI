// test/test_google_vision_quota.js
// VeriMedia AI — Google Cloud Vision Web Detection & Free-Tier Quota Guard Tests

import assert from 'assert';
import { 
  GoogleVisionWebDetectionProvider 
} from '../src/matching/providers/googleVisionWebDetection.js';
import { 
  canUseVisionApi, 
  getMonthlyVisionCallCount, 
  incrementVisionCallCount, 
  setMonthlyVisionCallCount, 
  resetVisionQuota, 
  getCurrentMonthKey, 
  DEFAULT_MONTHLY_LIMIT 
} from '../src/matching/visionQuotaGuard.js';
import { MultiSourceDiscoveryManager } from '../src/matching/providers/index.js';

console.log('── Running VeriMedia AI: Google Cloud Vision & Quota Guard Tests ──');

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] Test ${++passedTests}: ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] Test: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✔ [PASS] Test ${++passedTests}: ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] Test: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAll() {
  // Test 1: Unconfigured provider status
  test('status() returns UNAVAILABLE with clear reason when apiKey is unset', () => {
    const savedKey = process.env.GOOGLE_VISION_API_KEY;
    delete process.env.GOOGLE_VISION_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const provider = new GoogleVisionWebDetectionProvider({ apiKey: null });
    assert.strictEqual(provider.isConfigured(), false);
    const s = provider.status();
    assert.strictEqual(s.status, 'UNAVAILABLE');
    assert.strictEqual(s.reason, 'GOOGLE_VISION_API_KEY not configured on this deployment');

    if (savedKey) process.env.GOOGLE_VISION_API_KEY = savedKey;
  });

  // Test 2: Configured provider status
  test('status() returns AVAILABLE when apiKey is supplied', () => {
    const provider = new GoogleVisionWebDetectionProvider({ apiKey: 'AIzaMockKeyForTesting123' });
    assert.strictEqual(provider.isConfigured(), true);
    const s = provider.status();
    assert.strictEqual(s.status, 'AVAILABLE');
    assert.strictEqual(s.reason, null);
  });

  // Test 3: Quota guard counting and ceiling validation
  test('canUseVisionApi() returns false when count >= DEFAULT_MONTHLY_LIMIT', () => {
    const monthKey = getCurrentMonthKey();
    resetVisionQuota(monthKey);

    assert.strictEqual(getMonthlyVisionCallCount(monthKey), 0);
    assert.strictEqual(canUseVisionApi(), true);

    // Simulate 900 calls (the DEFAULT_MONTHLY_LIMIT)
    setMonthlyVisionCallCount(DEFAULT_MONTHLY_LIMIT, monthKey);
    assert.strictEqual(getMonthlyVisionCallCount(monthKey), DEFAULT_MONTHLY_LIMIT);
    assert.strictEqual(canUseVisionApi(), false, 'canUseVisionApi() must return false once monthly limit is reached');

    // Reset back to 0
    resetVisionQuota(monthKey);
    assert.strictEqual(canUseVisionApi(), true);
  });

  // Test 4: Provider returns QUOTA_EXCEEDED without calling network when quota reached
  await runAsyncTest('Provider returns QUOTA_EXCEEDED state when monthly quota is reached without calling API', async () => {
    const monthKey = getCurrentMonthKey();
    setMonthlyVisionCallCount(DEFAULT_MONTHLY_LIMIT, monthKey);

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Real fetch must not be invoked when quota is exceeded!');
    };

    try {
      const provider = new GoogleVisionWebDetectionProvider({ apiKey: 'AIzaMockKeyForTesting123' });
      const result = await provider.search({ imageBase64: 'dGVzdGltYWdlZGF0YQ==' });

      assert.strictEqual(fetchCalled, false, 'Fetch was erroneously called despite quota exhaustion');
      assert.strictEqual(result.status, 'QUOTA_EXCEEDED');
      assert.ok(result.reason.includes('Monthly free-tier limit'));
      assert.ok(result.reason.includes('900'));
      assert.deepStrictEqual(result.candidates, []);
    } finally {
      globalThis.fetch = originalFetch;
      resetVisionQuota(monthKey);
    }
  });

  // Test 5: Mocked successful API response mapping into epistemic candidate relationships
  await runAsyncTest('Parses webDetection into standard candidate shapes with epistemic relationship tags', async () => {
    const monthKey = getCurrentMonthKey();
    resetVisionQuota(monthKey);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('vision.googleapis.com'));
      const parsedBody = JSON.parse(options.body);
      assert.strictEqual(parsedBody.requests[0].features[0].type, 'WEB_DETECTION');
      assert.strictEqual(parsedBody.requests[0].image.content, 'sampleBase64ImageData');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          responses: [
            {
              webDetection: {
                bestGuessLabels: [{ label: 'Saturn Rocket Launch' }],
                fullMatchingImages: [
                  { url: 'https://nasa.gov/saturn_launch_full.jpg' }
                ],
                partialMatchingImages: [
                  { url: 'https://news-archive.com/saturn_cropped.jpg' }
                ],
                pagesWithMatchingImages: [
                  {
                    url: 'https://spacehistory.org/saturn-apollo',
                    pageTitle: 'Apollo Saturn V History',
                    fullMatchingImages: [{ url: 'https://spacehistory.org/thumb.jpg' }]
                  }
                ],
                visuallySimilarImages: [
                  { url: 'https://aviation.net/rocket_similarity.jpg' }
                ]
              }
            }
          ]
        })
      };
    };

    try {
      const provider = new GoogleVisionWebDetectionProvider({ apiKey: 'AIzaMockKeyForTesting123' });
      const res = await provider.search({ imageBase64: 'sampleBase64ImageData' });

      assert.strictEqual(res.status, 'AVAILABLE');
      assert.ok(res.candidates.length >= 3, 'Must produce candidates for full, partial, and page matches');

      // Check relationships
      const fullMatch = res.candidates.find(c => c.url === 'https://nasa.gov/saturn_launch_full.jpg');
      assert.ok(fullMatch, 'Full match candidate found');
      assert.strictEqual(fullMatch.relationship, 'EXACT_OR_NEAR_MATCH');
      assert.strictEqual(fullMatch.similarityStatus, 'PIXEL_MATCH');

      const partialMatch = res.candidates.find(c => c.url === 'https://news-archive.com/saturn_cropped.jpg');
      assert.ok(partialMatch, 'Partial match candidate found');
      assert.strictEqual(partialMatch.relationship, 'TRANSFORMED_VERSION');
      assert.strictEqual(partialMatch.similarityStatus, 'PIXEL_MATCH');

      const pageMatch = res.candidates.find(c => c.url === 'https://spacehistory.org/saturn-apollo');
      assert.ok(pageMatch, 'Page match candidate found');
      assert.strictEqual(pageMatch.title, 'Apollo Saturn V History');

      // Check that quota was incremented
      assert.strictEqual(getMonthlyVisionCallCount(monthKey), 1, 'Vision call count must be 1 after successful call');
    } finally {
      globalThis.fetch = originalFetch;
      resetVisionQuota(monthKey);
    }
  });

  // Test 6: Network / Auth error throws so caller's provider error handler catches it
  await runAsyncTest('Throws on HTTP error (e.g. 403 / 500) so multi-source orchestrator captures provider failure', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: { message: 'The provided API key is expired or restricted' } })
    });

    try {
      const provider = new GoogleVisionWebDetectionProvider({ apiKey: 'AIzaInvalidKey' });
      let caughtError = null;
      try {
        await provider.search({ imageBase64: 'sampleBase64ImageData' });
      } catch (err) {
        caughtError = err;
      }
      assert.ok(caughtError, 'Must throw on 403 error');
      assert.ok(caughtError.message.includes('expired or restricted') || caughtError.message.includes('403'));

      // Also verify MultiSourceDiscoveryManager captures this without crashing
      const manager = new MultiSourceDiscoveryManager({
        googleVision: { apiKey: 'AIzaInvalidKey' }
      });
      const multiRes = await manager.searchAll({}, { platforms: ['googleVisionWebDetection'], imageBase64: 'sampleBase64ImageData' });
      assert.strictEqual(multiRes.providerStatuses.googleVisionWebDetection.status, 'ERROR');
      assert.ok(multiRes.providerStatuses.googleVisionWebDetection.reason.includes('403') || multiRes.providerStatuses.googleVisionWebDetection.reason.includes('restricted'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  console.log(`\n🎉 All ${passedTests} Google Cloud Vision & Quota Guard tests passed successfully!`);
}

runAll().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
