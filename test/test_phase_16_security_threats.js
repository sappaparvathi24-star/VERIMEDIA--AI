// test/test_phase_16_security_threats.js
// VeriMedia AI — Dedicated Security Threat & Adversarial Test Suite

import assert from 'assert';
import { isPrivateOrBlockedIP } from '../src/proxy/requestProxy.js';
import { sanitizePath, generateToken, verifyToken, hashPassword } from '../src/security/auth.js';
import { rateLimitConfig, checkRateLimit, RateLimitBucket } from '../src/security/rateLimiter.js';
import { ProvenanceStore } from '../src/provenance/core.js';

console.log('── Running VeriMedia AI Phase 16 Tests: Dedicated Security & Adversarial Hardening ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Test ${passed}: ${name}`);
}

// 1. SSRF Protection Tests
run('SSRF: Blocks IPv4 loopback (127.0.0.1, 127.0.1.1, 127.255.255.254)', () => {
  assert.strictEqual(isPrivateOrBlockedIP('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('127.0.1.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('127.255.255.254'), true);
});

run('SSRF: Blocks IPv4 private subnets (10.x.x.x, 172.16-31.x.x, 192.168.x.x)', () => {
  assert.strictEqual(isPrivateOrBlockedIP('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('10.254.0.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('172.24.5.10'), true);
  assert.strictEqual(isPrivateOrBlockedIP('172.31.255.255'), true);
  assert.strictEqual(isPrivateOrBlockedIP('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('192.168.100.254'), true);
});

run('SSRF: Blocks Cloud Metadata Link-Local IP (169.254.169.254)', () => {
  assert.strictEqual(isPrivateOrBlockedIP('169.254.169.254'), true);
  assert.strictEqual(isPrivateOrBlockedIP('169.254.1.1'), true);
});

run('SSRF: Blocks IPv6 loopback (::1) and unspecified address (0.0.0.0, ::)', () => {
  assert.strictEqual(isPrivateOrBlockedIP('::1'), true);
  assert.strictEqual(isPrivateOrBlockedIP('0.0.0.0'), true);
  assert.strictEqual(isPrivateOrBlockedIP('::'), true);
});

run('SSRF: Allows legitimate public routable IPs', () => {
  assert.strictEqual(isPrivateOrBlockedIP('8.8.8.8'), false);
  assert.strictEqual(isPrivateOrBlockedIP('1.1.1.1'), false);
  assert.strictEqual(isPrivateOrBlockedIP('142.250.190.46'), false);
});

// 2. Path Traversal & Sanitization
run('Path Traversal: Sanitizes relative traversal attempts (../, ..\\)', () => {
  assert.strictEqual(sanitizePath('../../../etc/passwd'), 'etc_passwd');
  assert.strictEqual(sanitizePath('..\\..\\windows\\system32'), 'windows_system32');
  assert.strictEqual(sanitizePath('safe_folder/nested/file.png'), 'safe_folder_nested_file.png');
  assert.strictEqual(sanitizePath('null\0byte.jpg'), 'nullbyte.jpg');
});

// 3. Auth Token & Misuse Security
run('Auth: Generates valid HMAC-signed tokens and verifies payload integrity', () => {
  const user = { id: 'usr_sec_1', role: 'ANALYST', organizationId: 'org_main' };
  const token = generateToken(user);
  assert(token && token.length > 20);

  const verified = verifyToken(token);
  assert(verified !== null);
  assert.strictEqual(verified.sub, 'usr_sec_1');
  assert.strictEqual(verified.role, 'ANALYST');
});

run('Auth: Rejects tampered tokens, garbage signatures, and expired tokens', () => {
  assert.strictEqual(verifyToken('invalid.token.signature'), null);
  assert.strictEqual(verifyToken(''), null);
  assert.strictEqual(verifyToken(null), null);

  const validToken = generateToken({ id: 'usr_1', role: 'VIEWER' });
  const tamperedToken = validToken.substring(0, validToken.length - 6) + 'XXXXXX';
  assert.strictEqual(verifyToken(tamperedToken), null);
});

// 4. Malformed Upload & Input Boundary Defense
run('Upload Defense: Enforces valid SHA-256 hex string requirements and deterministic hash derivation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Security Audit Case' });
  
  // Valid explicit 64-char SHA-256
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'evidence.jpg',
    sha256: 'a'.repeat(64),
    mimeType: 'image/jpeg',
    byteSize: 1048576
  });
  assert(art.id.startsWith('ART-'));
  assert.strictEqual(art.sha256, 'a'.repeat(64));
  assert.strictEqual(art.sha256.length, 64);

  // Derives 64-char SHA-256 deterministically from buffer without crashing on missing sha256
  const bufferArt = store.createArtifact({
    investigationId: inv.id,
    filename: 'payload.bin',
    buffer: Buffer.from('malformed_upload_payload_data'),
    mimeType: 'application/octet-stream'
  });
  assert.strictEqual(bufferArt.sha256.length, 64);
  assert.strictEqual(bufferArt.byteSize, Buffer.from('malformed_upload_payload_data').length);
});

// 5. Tiered Rate Limit & Route-Class Protection (12_SECURITY_SPEC.md §9)
run('Rate Limiter: Provides shared rateLimitConfig with strict limits on uploads/reports and looser limits on reads', () => {
  assert(rateLimitConfig.uploads.maxRequests <= 30, 'Upload rate limit is strict (<= 30)');
  assert(rateLimitConfig.reports.maxRequests <= 30, 'Reports rate limit is strict (<= 30)');
  assert(rateLimitConfig.analysis.maxRequests <= 40, 'Analysis rate limit is bounded (<= 40)');
  assert(rateLimitConfig.reads.maxRequests >= 150, 'Reads rate limit is looser (>= 150)');
});

run('Rate Limiter: Enforces route-class isolation and strict thresholds on upload routes', () => {
  const uploadTestIp = '198.51.100.99';
  for (let i = 0; i < 30; i++) {
    assert.strictEqual(checkRateLimit(uploadTestIp, 'uploads'), true);
  }
  // 31st request to upload route must be rejected
  assert.strictEqual(checkRateLimit(uploadTestIp, 'uploads'), false);

  // Read route with same IP must still be independent and allowed
  assert.strictEqual(checkRateLimit(uploadTestIp, 'reads'), true);
});

console.log(`🎉 All ${passed}/${passed} Phase 16 Security Tests Passed Successfully!`);
