/**
 * Dedicated Security Route Audit Test Suite
 * Verifies that all endpoints requiring authentication reject unauthenticated requests (401),
 * accept valid authentication, and enforce epistemic certainty safeguards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { generateToken, requireAuth, authenticateUser, authorizeChain } from '../src/security/auth.js';
import { scanForProhibitedCertaintyTerms, sanitizeProhibitedCertaintyTerms } from '../src/provenance/core.js';

test('Security Route Audit & Safeguards Test Suite', async (t) => {
  await t.test('1. Auth Token Generation & Verification rejects unauthorized actor', async () => {
    const validToken = generateToken({ id: 'analyst-1', email: 'analyst@verimedia.ai', role: 'ANALYST', organizationId: 'org-test' });
    assert.ok(validToken, 'Valid token generated');

    const app = express();
    app.use(express.json());
    app.use(authenticateUser);
    app.get('/test/protected', requireAuth, (req, res) => {
      res.json({ status: 'ok', user: req.user });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Tampered token should fail with 401
      const unauthRes = await fetch(`http://127.0.0.1:${port}/test/protected`, {
        headers: { Authorization: 'Bearer invalid.tampered.token' }
      });
      assert.strictEqual(unauthRes.status, 401, 'Tampered token request must be rejected with 401');

      // Authenticated request should succeed with 200
      const authRes = await fetch(`http://127.0.0.1:${port}/test/protected`, {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      assert.strictEqual(authRes.status, 200, 'Authenticated request should succeed with 200');
      const body = await authRes.json();
      assert.strictEqual(body.user.email, 'analyst@verimedia.ai');
    } finally {
      server.close();
    }
  });

  await t.test('2. Epistemic Guard detects and sanitizes prohibited certainty terms', () => {
    const dirtyText = 'This is an ORIGINAL SOURCE and DEFINITIVE ORIGIN of deepfake manipulation with TRUTH SCORE 100% TRUE.';
    const audit = scanForProhibitedCertaintyTerms(dirtyText);
    assert.strictEqual(audit.hasViolations, true, 'Must flag prohibited certainty terms');
    assert.ok(audit.violations.length >= 3, 'Should detect multiple certainty terms');

    const sanitized = sanitizeProhibitedCertaintyTerms(dirtyText);
    assert.ok(!sanitized.includes('ORIGINAL SOURCE'), 'Must sanitize ORIGINAL SOURCE');
    assert.ok(!sanitized.includes('DEFINITIVE ORIGIN'), 'Must sanitize DEFINITIVE ORIGIN');
    assert.ok(!sanitized.includes('TRUTH SCORE'), 'Must sanitize TRUTH SCORE');
    assert.ok(!sanitized.includes('100% TRUE'), 'Must sanitize 100% TRUE');
  });

  await t.test('3. Clean probabilistic forensic outputs pass epistemic audit without violation', () => {
    const cleanText = 'Forensic ELA and perceptual hash indicators suggest potential modification with calibrated confidence 0.82.';
    const audit = scanForProhibitedCertaintyTerms(cleanText);
    assert.strictEqual(audit.hasViolations, false, 'Honest probabilistic output must not trigger violations');
    assert.strictEqual(audit.violations.length, 0);
  });

  await t.test('4. [Regression] No credentials on a protected route → 401 in production mode', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const app = express();
      app.use(express.json());
      app.use(authenticateUser);
      app.get('/test/protected', requireAuth, (req, res) => {
        res.json({ status: 'ok', user: req.user });
      });

      const server = app.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test/protected`);
        assert.strictEqual(res.status, 401, 'Request with no credentials must return 401 in production');
      } finally {
        server.close();
      }
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  await t.test('5. [Regression] Bogus X-API-Key on a protected route → 401', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const originalKeys = process.env.ALLOWED_API_KEYS;
    delete process.env.ALLOWED_API_KEYS;
    try {
      const app = express();
      app.use(express.json());
      app.use(authenticateUser);
      app.get('/test/protected', requireAuth, (req, res) => {
        res.json({ status: 'ok', user: req.user });
      });

      const server = app.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test/protected`, {
          headers: { 'X-API-Key': 'garbage-key-that-should-never-match' }
        });
        assert.strictEqual(res.status, 401, 'Request with bogus X-API-Key must return 401');
      } finally {
        server.close();
      }
    } finally {
      process.env.NODE_ENV = original;
      if (originalKeys !== undefined) process.env.ALLOWED_API_KEYS = originalKeys;
    }
  });
});
