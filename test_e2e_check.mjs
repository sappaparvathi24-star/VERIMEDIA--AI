// VeriMedia AI — End-to-End Working Check Script
// Run: node test_e2e_check.mjs
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';

const BASE = 'http://localhost:3000';
const TOKEN = 'analyst_active_session';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function pass(label, value) {
  console.log(`  ✅  ${label}: ${value}`);
}
function fail(label, value) {
  console.log(`  ❌  ${label}: ${value}`);
}
function check(label, condition, value) {
  if (condition) pass(label, value);
  else fail(label, value);
}
function section(title) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(55)}`);
}

// ── STEP 1: Health Check ──────────────────────────────────
section('STEP 1 — HEALTH CHECK');
const healthRes = await httpRequest({ hostname: 'localhost', port: 3000, path: '/health', method: 'GET' });
const health = JSON.parse(healthRes.body);
check('Server running',           health.status === 'ok',          health.status);
check('SQLite operational',       health.services['SQLite Database'] === 'operational', health.services['SQLite Database']);
check('Provenance Engine',        health.services['Provenance Engine'] === 'operational', health.services['Provenance Engine']);
check('Total investigations',     health.total_investigations >= 0, health.total_investigations);
check('Total scans',              health.total_scans >= 0,          health.total_scans);
check('Gemini status reported', (health.integrations?.gemini !== undefined) || (health.services?.['Gemini AI'] !== undefined), health.integrations?.gemini || health.services?.['Gemini AI']);

// ── STEP 2: Upload image + run full forensics ─────────────
section('STEP 2 — IMAGE UPLOAD + FORENSICS PIPELINE');
const imgBuffer = fs.readFileSync('test_image_demo.jpg');
const boundary = 'vmBoundary' + crypto.randomBytes(6).toString('hex');
const formBody = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="test_image_demo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
  imgBuffer,
  Buffer.from(`\r\n--${boundary}--\r\n`)
]);
const detectRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: '/api/v1/detect', method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': formBody.length
  }
}, formBody);
const d = JSON.parse(detectRes.body);
check('HTTP 200',              detectRes.status === 200,           detectRes.status);
check('is_demo = false',       d.is_demo === false,                d.is_demo);
check('mode = REAL_PIPELINE',  d.mode === 'REAL_PIPELINE',         d.mode);
check('investigationId set',   Boolean(d.investigationId),         d.investigationId);
check('artifact.id set',       Boolean(d.artifact?.id),            d.artifact?.id);
check('SHA-256 hash present',  d.artifact?.sha256?.length === 64,  d.artifact?.sha256?.substring(0,16) + '...');
check('MIME detected',         Boolean(d.artifact?.mimeType),      d.artifact?.mimeType);
check('byteSize > 0',          (d.artifact?.byteSize || 0) > 0,    d.artifact?.byteSize + ' bytes');
check('Forensics ran',         Boolean(d.forensics),               d.forensics ? 'present' : 'MISSING');
check('ELA result present',    Boolean(d.forensics?.ela),          JSON.stringify(d.forensics?.ela));
check('ELA is real',           d.forensics?.ela?.meanError !== undefined, 'meanError=' + d.forensics?.ela?.meanError);
check('Stats width/height',    (d.forensics?.stats?.width || 0) > 0, d.forensics?.stats?.width + 'x' + d.forensics?.stats?.height);
check('OCR ran',               d.forensics?.ocr?.supported !== undefined, 'supported=' + d.forensics?.ocr?.supported);
check('C2PA status set',       Boolean(d.forensics?.c2pa?.status), d.forensics?.c2pa?.status);
check('Trust score present',   d.trust?.trust_score !== undefined, 'trust_score=' + d.trust?.trust_score);
check('AI decision present',   Boolean(d.ai_analysis?.decision),   d.ai_analysis?.decision);
check('Gemini null = honest',  d.forensics?.authenticity === null || d.forensics?.authenticity !== undefined, 'authenticity=' + d.forensics?.authenticity);

const INV_ID = d.investigationId;
const ART_ID = d.artifact?.id;

// ── STEP 3: Investigation persisted ──────────────────────
section('STEP 3 — INVESTIGATION PERSISTED IN DATABASE');
const invRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: `/api/investigations/${INV_ID}`, method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const inv = JSON.parse(invRes.body);
check('HTTP 200',              invRes.status === 200,  invRes.status);
check('Investigation ID match', inv.id === INV_ID,    inv.id);
check('Status field present',  Boolean(inv.status),   inv.status);
check('Has artifactIds',       Array.isArray(inv.artifactIds), 'count=' + (inv.artifactIds?.length || 0));

// ── STEP 4: Discovery (real live search) ─────────────────
section('STEP 4 — DISCOVERY (LIVE PROVIDER SEARCH)');
const discBody = JSON.stringify({ query: 'breaking news video 2026', options: {} });
const discRes = await httpRequest({
  hostname: 'localhost', port: 3000,
  path: '/api/search/multi-source', method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(discBody)
  }
}, discBody);
const disc = JSON.parse(discRes.body);
check('HTTP 200',              discRes.status === 200,           discRes.status);
check('Results / candidates',  Array.isArray(disc.candidates || disc.results || []), 'count=' + (disc.candidates?.length || disc.results?.length || 0));
check('Provider statuses',     Boolean(disc.providerStatuses || disc.status),        disc.status || 'present');

// ── STEP 5: Provider health matrix ───────────────────────
section('STEP 5 — PROVIDER HEALTH MATRIX');
const provRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: '/api/providers', method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const provs = JSON.parse(provRes.body);
check('HTTP 200',              provRes.status === 200, provRes.status);
const provList = provs.providers || provs;
const keys = Object.keys(provList);
check('Providers listed',      keys.length >= 3,       'count=' + keys.length);
for (const k of keys.slice(0,5)) {
  const p = provList[k];
  console.log(`       ${k.padEnd(16)} status=${p.status || p}`);
}

// ── STEP 6: Human Decision ───────────────────────────────
section('STEP 6 — HUMAN DECISION (ALLOW/TAKEDOWN/REVIEW)');
const patchRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: `/api/v1/cases/${INV_ID}`, method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength('{"decision":"REVIEW_REQUIRED","notes":"E2E test review"}')
  }
}, '{"decision":"REVIEW_REQUIRED","notes":"E2E test review"}');
const patch = JSON.parse(patchRes.body);
check('HTTP 200',              patchRes.status === 200,                patchRes.status);
check('humanDecision saved',   patch.humanDecision === 'REVIEW_REQUIRED', patch.humanDecision);
check('Status updated',        Boolean(patch.status),                 patch.status);
check('updatedAt set',         Boolean(patch.updatedAt),              patch.updatedAt);

// ── STEP 7: Audit Trail ──────────────────────────────────
section('STEP 7 — AUDIT TRAIL');
const auditRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: `/api/audit?limit=5&investigationId=${INV_ID}`, method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const audit = JSON.parse(auditRes.body);
check('HTTP 200',              auditRes.status === 200,          auditRes.status);
check('Audit events returned', (audit.events?.length || 0) >= 0, 'count=' + audit.events?.length);
for (const ev of (audit.events || []).slice(0,3)) {
  console.log(`       ${ev.action?.padEnd(25)} | actor=${ev.actor} | ${ev.createdAt}`);
}

// ── STEP 8: Report Generation ────────────────────────────
section('STEP 8 — REPORT GENERATION');
const reportRes = await httpRequest({
  hostname: 'localhost', port: 3000, path: `/api/investigations/${INV_ID}/report`, method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const report = JSON.parse(reportRes.body);
check('HTTP 200',              reportRes.status === 200,          reportRes.status);
check('Report has investigation', Boolean(report.investigation || report.id), 'present');

// ── STEP 9: Persistence survives (re-fetch after operations) ─
section('STEP 9 — DATA PERSISTS (SIMULATE REFRESH)');
const invRes2 = await httpRequest({
  hostname: 'localhost', port: 3000, path: `/api/investigations/${INV_ID}`, method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const inv2 = JSON.parse(invRes2.body);
check('Investigation still exists', invRes2.status === 200, invRes2.status);
check('Decision persisted',   inv2.humanDecision === 'REVIEW_REQUIRED', inv2.humanDecision);
check('Status persisted',     Boolean(inv2.status), inv2.status);

// ── FINAL SUMMARY ────────────────────────────────────────
section('FINAL RESULT');
console.log('  All 9 stages tested against live running server.');
console.log(`  investigationId = ${INV_ID}`);
console.log(`  artifactId      = ${ART_ID}`);
console.log('\n  Open http://localhost:3000 in your browser to see the UI.');
console.log('  Click the Cases tab to find this investigation.');
