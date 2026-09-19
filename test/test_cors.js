// test/test_cors.js
// Verification of CORS origin resolution and preflight response rules

import assert from 'assert';
import { isOriginAllowed } from '../server.js';

console.log('── Running VeriMedia AI CORS Origin Tests ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Test ${passed}: ${name}`);
}

run('CORS: Allows explicit production frontend https://verimedia-ai-jade.vercel.app', () => {
  assert.strictEqual(isOriginAllowed('https://verimedia-ai-jade.vercel.app'), true);
  assert.strictEqual(isOriginAllowed('https://verimedia-ai-jade.vercel.app/'), true);
});

run('CORS: Allows any Vercel preview/alias origin (*.vercel.app)', () => {
  assert.strictEqual(isOriginAllowed('https://verimedia-ai-preview-123.vercel.app'), true);
  assert.strictEqual(isOriginAllowed('https://verimedia-ai-git-main-user.vercel.app'), true);
});

run('CORS: Allows localhost on any port (HTTP & HTTPS)', () => {
  assert.strictEqual(isOriginAllowed('http://localhost:3000'), true);
  assert.strictEqual(isOriginAllowed('http://localhost:5173'), true);
  assert.strictEqual(isOriginAllowed('http://127.0.0.1:3000'), true);
  assert.strictEqual(isOriginAllowed('http://127.0.0.1:8080'), true);
});

run('CORS: Allows Cloud Run & Render backend origins', () => {
  assert.strictEqual(isOriginAllowed('https://verimedia-ai-1.onrender.com'), true);
  assert.strictEqual(isOriginAllowed('https://verimedia-service-xyz.a.run.app'), true);
});

run('CORS: Allows empty/undefined origins (server-to-server, cURL, health checks)', () => {
  assert.strictEqual(isOriginAllowed(null), true);
  assert.strictEqual(isOriginAllowed(undefined), true);
  assert.strictEqual(isOriginAllowed(''), true);
});

run('CORS: Rejects untrusted external third-party origins', () => {
  assert.strictEqual(isOriginAllowed('https://malicious-site.com'), false);
  assert.strictEqual(isOriginAllowed('https://evil-phishing.org'), false);
  assert.strictEqual(isOriginAllowed('http://unauthorized-domain.net'), false);
});

console.log(`\n🎉 All ${passed}/${passed} CORS Verification Tests Passed!`);
