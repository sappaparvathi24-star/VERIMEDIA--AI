// VeriMedia AI — 4-Feature Unified Workflow & Anti-Fabrication Automated Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { generateWorkflowReport, extractCreatorAttribution } from '../src/provenance/workflowReport.js';

console.log('── Running VeriMedia AI: 4-Feature Workflow & Anti-Fabrication Tests ──');

// Test 1: extractCreatorAttribution with zero candidates returns NOT_FOUND (no fake percentages)
const emptyAttribution = extractCreatorAttribution([], {});
assert.strictEqual(emptyAttribution.attributionConfidence, 'NOT_FOUND');
assert.strictEqual(emptyAttribution.statedCredit, null);
assert.strictEqual(emptyAttribution.creditLabel, 'Not found');
assert.strictEqual(typeof emptyAttribution.summary, 'string');
console.log('✔ [PASS] Test 1: Empty candidates return attributionConfidence: NOT_FOUND without numeric percentage or fake names');

// Test 2: extractCreatorAttribution with stated page author returns FOUND_ON_PAGE and exact credit
const candidateWithCredit = [{
  url: 'https://example.com/photo',
  domain: 'example.com',
  author: 'Jane Doe / Reuters',
  relationship: 'EXACT_OR_NEAR_MATCH'
}];
const creditedAttribution = extractCreatorAttribution(candidateWithCredit, {});
assert.strictEqual(creditedAttribution.attributionConfidence, 'FOUND_ON_PAGE');
assert.strictEqual(creditedAttribution.statedCredit, 'Jane Doe / Reuters');
assert.strictEqual(creditedAttribution.creditLabel, 'credit stated on source page');
assert.strictEqual(creditedAttribution.sourceDomain, 'example.com');
console.log('✔ [PASS] Test 2: Discovered page with credit returns attributionConfidence: FOUND_ON_PAGE with explicit stated credit label');

// Test 3: generateWorkflowReport with zero matches generates honest empty states (no demo/scenario fabrication)
const sampleBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjuAAAAAElFTkSuQmCC', 'base64');
const emptyReport = await generateWorkflowReport({
  artifact: {
    id: 'ART-TEST-ZERO',
    filename: 'zero_matches.png',
    mimeType: 'image/png'
  },
  buffer: sampleBuffer,
  candidates: [],
  forensicAnalysis: null,
  visionResults: {
    status: 'AVAILABLE',
    candidates: [],
    bestGuessLabels: []
  }
});

assert.strictEqual(emptyReport.workflow.originalWebsite.status, 'NO_MATCHES_FOUND');
assert.strictEqual(emptyReport.workflow.originalWebsite.candidateCount, 0);
assert.strictEqual(emptyReport.workflow.creatorInvestigation.attributionConfidence, 'NOT_FOUND');
assert.strictEqual(emptyReport.workflow.imageForensics.status, 'COMPLETED');
assert(emptyReport.workflow.imageForensics.sha256.length === 64);
assert.strictEqual(emptyReport.antiFabricationAudit.status, 'VERIFIED_NON_FABRICATED');
console.log('✔ [PASS] Test 3: Zero-match artifact generates completely un-fabricated empty workflow state');

// Test 4: generateWorkflowReport with real matches populates all 4 workflow features
const populatedReport = await generateWorkflowReport({
  artifact: {
    id: 'ART-TEST-POPULATED',
    filename: 'sample_news_photo.jpg',
    mimeType: 'image/jpeg',
    byteSize: 1024
  },
  buffer: sampleBuffer,
  candidates: [
    {
      url: 'https://news.example.com/story/123',
      domain: 'news.example.com',
      title: 'Breaking News Coverage',
      relationship: 'EXACT_OR_NEAR_MATCH',
      similarity: 0.98,
      author: 'Staff Photojournalist'
    }
  ],
  forensicAnalysis: {
    isSynthetic: false,
    confidence: 0.92,
    confidenceLabel: '92%',
    indicators: ['Consistent sensor noise', 'Authentic Bayer color filter array artifacts'],
    modelAssessment: 'Natural optical characteristics observed with no diffusion synthesis markers.'
  }
});

assert.strictEqual(populatedReport.workflow.originalWebsite.status, 'MATCHES_FOUND');
assert.strictEqual(populatedReport.workflow.originalWebsite.candidateCount, 1);
assert.strictEqual(populatedReport.workflow.aiDetection.verdict, 'LIKELY_AUTHENTIC');
assert.strictEqual(populatedReport.workflow.creatorInvestigation.attributionConfidence, 'FOUND_ON_PAGE');
assert.strictEqual(populatedReport.workflow.creatorInvestigation.statedCredit, 'Staff Photojournalist');
assert.strictEqual(populatedReport.workflow.imageForensics.status, 'COMPLETED');
console.log('✔ [PASS] Test 4: Populated artifact correctly aggregates 4 features (Original Website, AI Detection, Creator Investigation, Image Forensics)');

// Test 5: Grep audit of src/provenance/workflowReport.js for prohibited fallback patterns
const workflowReportCode = fs.readFileSync(path.resolve('src/provenance/workflowReport.js'), 'utf8');
const lines = workflowReportCode.split('\n');
const suspiciousLines = [];
lines.forEach((line, idx) => {
  // Check for ?? or || followed by hardcoded numbers (e.g. || 0.85, || 95, || 'John Doe')
  if (/((\?\?|\|\|)\s*(\d+(\.\d+)?|'[^']*'|"[^"]*"))/.test(line)) {
    // Exclude legitimate explicit fallback strings like 'Not available', 'Not computed', 'Not evaluated', 'Not found', 'Web Source', 'image/jpeg'
    const allowed = [
      'Not available',
      'Not computed',
      'Not evaluated',
      'Not found',
      'Not specified',
      'Web Source',
      'image/jpeg',
      'uploaded_image.jpg',
      'No EXIF metadata present',
      'No prior web publications discovered',
      'No matching online publications or reverse-image indexed appearances found.',
      'No forensic anomalies observed.',
      'Indexed Web Match',
      'LIKELY_RELATED',
      'INCONCLUSIVE',
      'AVAILABLE',
      'UNKNOWN_ARTIFACT',
      'Unknown',
      'Unknown domain'
    ];
    const isAllowed = allowed.some(a => line.includes(a));
    if (!isAllowed) {
      suspiciousLines.push({ lineNum: idx + 1, content: line.trim() });
    }
  }
});

assert.strictEqual(suspiciousLines.length, 0, `Prohibited hardcoded fallback found: ${JSON.stringify(suspiciousLines)}`);
console.log('✔ [PASS] Test 5: Anti-fabrication grep audit passed (0 prohibited fabricated constants found in workflowReport.js)');

console.log('🎉 All 5 4-Feature Workflow & Anti-Fabrication tests passed successfully!');
