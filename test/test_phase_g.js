// test/test_phase_g.js
// VeriMedia AI — Phase G Test Suite: Context & Claim Verification

import assert from 'assert';
import { 
  ProvenanceStore, 
  ClaimTypes, 
  ClaimStatus, 
  FindingStatus, 
  EvidencePolarity, 
  SourceTypes 
} from '../src/provenance/core.js';
import { 
  assessClaim, 
  decomposeClaim, 
  validateSourceUrl, 
  countIndependentEvidenceGroups 
} from '../src/provenance/claims.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase G Tests: Context & Claim Verification ──');
let passedCount = 0;
const totalTests = 15;

function runTest(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`✔ [PASS] Test ${passedCount}: ${name}`);
  } catch (err) {
    console.error(`✘ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Create a claim
// ---------------------------------------------------------------------------
runTest('Create a claim', () => {
  const store = new ProvenanceStore();
  const claim = store.createClaim({
    statement: 'This video was recorded in Tokyo yesterday.',
    claimType: ClaimTypes.LOCATION,
    sourceId: 'SRC-USER-01',
    sourceText: 'Submitted user caption'
  });

  assert(claim && claim.id.startsWith('CLM-'), 'Claim ID must start with CLM-');
  assert.strictEqual(claim.statement, 'This video was recorded in Tokyo yesterday.');
  assert.strictEqual(claim.claimType, ClaimTypes.LOCATION);
  assert.strictEqual(claim.status, ClaimStatus.UNASSESSED);
  assert.strictEqual(claim.sourceId, 'SRC-USER-01');
});

// ---------------------------------------------------------------------------
// TEST 2: Attach a claim to a real investigation
// ---------------------------------------------------------------------------
runTest('Attach a claim to a real investigation', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({
    id: 'INV-REAL-100',
    title: 'News Segment Verification',
    metadata: { isDemo: false }
  });

  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'broadcast.mp4',
    mimeType: 'video/mp4',
    byteSize: 1000000,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Official broadcast of prime minister press conference.',
    claimType: ClaimTypes.EVENT
  });

  assert.strictEqual(claim.investigationId, inv.id);
  assert.strictEqual(claim.artifactId, art.id);
  assert(inv.claimIds.includes(claim.id), 'Investigation must track attached claim ID');
  assert.strictEqual(claim.isDemo, false);
});

// ---------------------------------------------------------------------------
// TEST 3: Attach supporting evidence
// ---------------------------------------------------------------------------
runTest('Attach supporting evidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Supporting Evidence Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'test.mp4' });

  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'METADATA_EXTRACTOR' });
  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'OFFICIAL_REGISTRY',
    value: 'MATCH_FOUND'
  });
  const ev = store.createEvidence({
    observationIds: [obs.id],
    independenceGroupId: 'IG-REGISTRY-A',
    evidenceType: 'AUTHENTICATED_RECORD',
    description: 'Government press office public ledger confirms matching broadcast slot.',
    confidence: 0.95,
    polarity: EvidencePolarity.SUPPORTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'This is an official government press broadcast.',
    claimType: ClaimTypes.EVENT,
    evidenceIds: [ev.id]
  });

  const result = assessClaim(store, claim.id);
  assert.strictEqual(result.claim.status, ClaimStatus.SUPPORTED);
  assert(result.claim.confidence >= 0.85);
  assert.strictEqual(result.supportingEvidence.length, 1);
  assert.strictEqual(result.supportingEvidence[0].id, ev.id);
});

// ---------------------------------------------------------------------------
// TEST 4: Attach contradicting evidence
// ---------------------------------------------------------------------------
runTest('Attach contradicting evidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Contradicting Evidence Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'repost.mp4' });

  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'WEATHER_ARCHIVE_VERIFIER' });
  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'METEOROLOGICAL_RECORD',
    value: 'CLEAR_SKIES_OBSERVED'
  });
  const evCon = store.createEvidence({
    observationIds: [obs.id],
    independenceGroupId: 'IG-WEATHER-01',
    evidenceType: 'METEOROLOGICAL_CONTRADICTION',
    description: 'Official meteorological station registered clear skies; video portrays severe torrential storm.',
    confidence: 0.92,
    polarity: EvidencePolarity.REFUTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'This storm happened in Dallas on July 14, 2026.',
    claimType: ClaimTypes.EVENT,
    contradictionIds: [evCon.id]
  });

  const result = assessClaim(store, claim.id);
  assert.strictEqual(result.claim.status, ClaimStatus.CONTRADICTED);
  assert.strictEqual(result.contradictingEvidence.length, 1);
  assert.strictEqual(result.contradictingEvidence[0].id, evCon.id);
});

// ---------------------------------------------------------------------------
// TEST 5: Verify INCONCLUSIVE assessment when evidence conflicts
// ---------------------------------------------------------------------------
runTest('Verify INCONCLUSIVE assessment when evidence conflicts', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Conflict Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'disputed.mp4' });

  // Supporting evidence
  const run1 = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'OCR_BANNER' });
  const obs1 = store.createObservation({ runId: run1.id, artifactId: art.id, observationType: 'BANNER_TEXT', value: 'Convention Center 2026' });
  const evSup = store.createEvidence({
    observationIds: [obs1.id],
    independenceGroupId: 'IG-BANNER',
    description: 'Visible stage banner reads "Convention Center 2026".',
    confidence: 0.85,
    polarity: EvidencePolarity.SUPPORTING
  });

  // Contradicting evidence
  const run2 = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'GEOLOCATION_SATELLITE' });
  const obs2 = store.createObservation({ runId: run2.id, artifactId: art.id, observationType: 'ARCHITECTURAL_FACADE', value: 'NO_MATCH' });
  const evCon = store.createEvidence({
    observationIds: [obs2.id],
    independenceGroupId: 'IG-SAT',
    description: 'Satellite imagery proves architectural facade was demolished in 2024.',
    confidence: 0.91,
    polarity: EvidencePolarity.REFUTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'This rally occurred at the Convention Center in 2026.',
    claimType: ClaimTypes.LOCATION,
    evidenceIds: [evSup.id],
    contradictionIds: [evCon.id]
  });

  const result = assessClaim(store, claim.id);
  assert.strictEqual(result.claim.status, ClaimStatus.INCONCLUSIVE, 'Status must be INCONCLUSIVE when evidence conflicts');
  assert.strictEqual(result.whatSupportsIt.length, 1, 'Must preserve supporting evidence');
  assert.strictEqual(result.whatConflictsWithIt.length, 1, 'Must preserve contradicting evidence');
  assert(result.whatRemainsUnknown.length > 0, 'Must document what remains unknown');
});

// ---------------------------------------------------------------------------
// TEST 6: Verify UNKNOWN when relevant evidence is unavailable
// ---------------------------------------------------------------------------
runTest('Verify UNKNOWN when relevant evidence is unavailable', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Empty Evidence Test' });

  const claim = store.createClaim({
    investigationId: inv.id,
    statement: 'The person in this photo is a famous diplomat visiting secretly.',
    claimType: ClaimTypes.IDENTITY,
    sourceId: 'UNKNOWN'
  });

  const result = assessClaim(store, claim.id);
  assert.strictEqual(result.claim.status, ClaimStatus.UNKNOWN, 'Status must be UNKNOWN when no evidence is available');
  assert.strictEqual(result.claim.confidence, null, 'Confidence must be null or zero without evidence');
  assert(result.whatRemainsUnknown.length > 0);
  assert(result.limitations.length > 0);
});

// ---------------------------------------------------------------------------
// TEST 7: Verify PARTIALLY_SUPPORTED for multi-part claims
// ---------------------------------------------------------------------------
runTest('Verify PARTIALLY_SUPPORTED for multi-part claims', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Multi-Part Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'multipart.mp4' });

  const evLoc = store.createEvidence({
    independenceGroupId: 'IG-GEO',
    description: 'Landmark matching confirms location is Mumbai Gateway.',
    confidence: 0.92,
    polarity: EvidencePolarity.SUPPORTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Recorded in Mumbai yesterday by eyewitness reporter.',
    claimType: ClaimTypes.CONTEXT,
    isMultiPart: true,
    subClaims: [
      {
        id: 'SUB-1',
        statement: 'Location is Mumbai',
        claimType: ClaimTypes.LOCATION,
        evidenceIds: [evLoc.id],
        contradictionIds: []
      },
      {
        id: 'SUB-2',
        statement: 'Date was yesterday',
        claimType: ClaimTypes.DATE,
        evidenceIds: [], // Unknown/unverified
        contradictionIds: []
      }
    ]
  });

  const result = assessClaim(store, claim.id);
  assert.strictEqual(result.claim.status, ClaimStatus.PARTIALLY_SUPPORTED, 'Multi-part with 1 supported and 1 unknown must be PARTIALLY_SUPPORTED');
  assert(result.claim.confidence > 0 && result.claim.confidence < 0.90);
  assert.strictEqual(result.subClaims[0].status, ClaimStatus.SUPPORTED);
  assert.strictEqual(result.subClaims[1].status, ClaimStatus.UNKNOWN);
});

// ---------------------------------------------------------------------------
// TEST 8: Verify publication timestamp is not treated as creation timestamp
// ---------------------------------------------------------------------------
runTest('Verify publication timestamp is not treated as creation timestamp', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Date Separation Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'social.mp4' });

  const evPub = store.createEvidence({
    evidenceType: 'PUBLICATION_TIMESTAMP_OBSERVED',
    description: 'Post was uploaded on platform at 2026-08-14T08:50:00Z.',
    confidence: 0.95,
    polarity: EvidencePolarity.SUPPORTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'This video was recorded on August 14, 2026.',
    claimType: ClaimTypes.DATE,
    evidenceIds: [evPub.id]
  });

  const result = assessClaim(store, claim.id);
  // Must NOT be unconditionally SUPPORTED as recording date without sensor/capture logs!
  assert.strictEqual(result.claim.status, ClaimStatus.PARTIALLY_SUPPORTED);
  const mentionsTimestampLimitation = result.limitations.some(l => l.includes('publication') || l.includes('container') || l.includes('recording'));
  assert(mentionsTimestampLimitation, 'Must explicitly document that publication timestamp does not equal recording timestamp');
});

// ---------------------------------------------------------------------------
// TEST 9: Verify earliest observed appearance is not treated as ownership/origin
// ---------------------------------------------------------------------------
runTest('Verify earliest observed appearance is not treated as ownership/origin', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Ownership Boundary Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  const evAppearance = store.createEvidence({
    evidenceType: 'EARLIEST_OBSERVED_APPEARANCE',
    description: 'Earliest cataloged appearance of clip on social channel on August 14.',
    confidence: 0.92,
    polarity: EvidencePolarity.SUPPORTING
  });

  // Ownership claim
  const claimOwnership = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'The first uploader owns legal copyright to this media.',
    claimType: ClaimTypes.OWNERSHIP,
    evidenceIds: [evAppearance.id]
  });

  const result = assessClaim(store, claimOwnership.id);
  assert.strictEqual(result.claim.status, ClaimStatus.UNKNOWN, 'Ownership claims must remain UNKNOWN based merely on earliest observed appearance');
  const mentionsOwnershipLimitation = result.limitations.some(l => l.toLowerCase().includes('ownership') || l.toLowerCase().includes('copyright'));
  assert(mentionsOwnershipLimitation, 'Must explicitly state that appearance does not establish copyright/ownership');
});

// ---------------------------------------------------------------------------
// TEST 10: Verify multiple copied sources do not automatically count as independent confirmations
// ---------------------------------------------------------------------------
runTest('Verify multiple copied sources do not automatically count as independent confirmations', () => {
  const store = new ProvenanceStore();

  const ev1 = store.createEvidence({
    independenceGroupId: 'IG-SYNDICATED-NETWORK-X',
    description: 'Mirror A reposted identical video file.',
    confidence: 0.90
  });

  const ev2 = store.createEvidence({
    independenceGroupId: 'IG-SYNDICATED-NETWORK-X', // Same independence group
    description: 'Mirror B reposted identical video file.',
    confidence: 0.90
  });

  const ev3 = store.createEvidence({
    independenceGroupId: 'IG-SYNDICATED-NETWORK-X', // Same independence group
    description: 'Aggregator site C syndicated the same text and video.',
    confidence: 0.90
  });

  const independenceResult = countIndependentEvidenceGroups(store, [ev1.id, ev2.id, ev3.id]);
  assert.strictEqual(independenceResult.groupCount, 1, '3 syndicated copies in same group must count as only 1 independent group');
  assert.strictEqual(independenceResult.groups[0].count, 3);
});

// ---------------------------------------------------------------------------
// TEST 11: Verify claim assessment links to actual evidence IDs
// ---------------------------------------------------------------------------
runTest('Verify claim assessment links to actual evidence IDs', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Trace Link Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'sample.mp4' });

  const ev = store.createEvidence({
    description: 'Authenticated satellite weather telemetry.',
    confidence: 0.95
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Verified test statement',
    evidenceIds: [ev.id]
  });

  const assessment = assessClaim(store, claim.id);
  assert(assessment.finding, 'Assessment must produce a linked Finding');
  assert(assessment.finding.evidenceIds.includes(ev.id), 'Finding must explicitly link to the evidence ID');
  assert.strictEqual(assessment.claim.assessmentFindingId, assessment.finding.id);
});

// ---------------------------------------------------------------------------
// TEST 12: Verify claim findings preserve the Artifact -> Observation -> Evidence chain
// ---------------------------------------------------------------------------
runTest('Verify claim findings preserve the Artifact -> Observation -> Evidence chain', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Traceability Chain Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'source_video.mp4',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
  });

  const run = store.createAnalysisRun({
    investigationId: inv.id,
    artifactId: art.id,
    method: 'EXIF_METADATA_EXTRACTOR'
  });

  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'CAMERA_SERIAL',
    value: 'SN-90214-CANON'
  });

  const ev = store.createEvidence({
    observationIds: [obs.id],
    evidenceType: 'HARDWARE_EXIF_RECORD',
    description: 'Direct camera sensor hardware serial number extracted from raw stream header.',
    confidence: 0.96
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Captured with registered studio camera SN-90214-CANON.',
    evidenceIds: [ev.id]
  });

  const assessment = assessClaim(store, claim.id);
  const findingId = assessment.finding.id;

  // Use provenanceService to trace finding back to underlying observation and artifact
  provenanceService.store = store;
  const trace = provenanceService.traceFinding(findingId);

  assert(trace.verified, 'Trace chain must be verified');
  assert.strictEqual(trace.traceChain.length, 1);
  assert.strictEqual(trace.traceChain[0].evidence.id, ev.id);
  assert.strictEqual(trace.traceChain[0].observations[0].observation.id, obs.id);
  assert.strictEqual(trace.traceChain[0].observations[0].artifact.id, art.id);
  assert.strictEqual(trace.traceChain[0].observations[0].analysisRun.id, run.id);
});

// ---------------------------------------------------------------------------
// TEST 13: Verify demo claim data remains isolated
// ---------------------------------------------------------------------------
runTest('Verify demo claim data remains isolated', () => {
  const store = new ProvenanceStore();
  const invReal = store.createInvestigation({
    id: 'INV-REAL-200',
    title: 'Real World Case',
    metadata: { isDemo: false }
  });

  const invDemo = store.createInvestigation({
    id: 'INV-DEMO-SIM-01',
    title: 'Demo Simulated Scenario',
    metadata: { isDemo: true, demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE' }
  });

  const claimDemo = store.createClaim({
    investigationId: invDemo.id,
    statement: 'Simulated leak on synthetic server.',
    isDemo: true,
    metadata: { demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE' }
  });

  const claimReal = store.createClaim({
    investigationId: invReal.id,
    statement: 'Actual broadcast on network television.',
    isDemo: false
  });

  // Verify separation
  assert.strictEqual(claimDemo.isDemo, true);
  assert.strictEqual(claimReal.isDemo, false);
  assert(invDemo.claimIds.includes(claimDemo.id));
  assert(!invReal.claimIds.includes(claimDemo.id), 'Demo claim must never leak into real investigation');
  assert(invReal.claimIds.includes(claimReal.id));
  assert(!invDemo.claimIds.includes(claimReal.id), 'Real claim must not enter demo investigation');
});

// ---------------------------------------------------------------------------
// TEST 14: Verify malformed/unsafe source URLs are rejected
// ---------------------------------------------------------------------------
runTest('Verify malformed/unsafe source URLs are rejected', () => {
  // Test unsafe protocols
  assert.throws(() => validateSourceUrl('javascript:alert(1)'), /Unsafe URL scheme/);
  assert.throws(() => validateSourceUrl('file:///etc/passwd'), /Unsafe URL scheme/);
  assert.throws(() => validateSourceUrl('ftp://example.com/file'), /Unsafe URL scheme/);

  // Test loopback / localhost
  assert.throws(() => validateSourceUrl('http://localhost:3000/api'), /Restricted hostname/);
  assert.throws(() => validateSourceUrl('http://127.0.0.1:8080/data'), /Forbidden loopback IP/);
  assert.throws(() => validateSourceUrl('http://[::1]/secret'), /Restricted hostname/);

  // Test private IP addresses (RFC 1918)
  assert.throws(() => validateSourceUrl('http://10.0.0.1/admin'), /Forbidden private network IP/);
  assert.throws(() => validateSourceUrl('http://192.168.1.1/router'), /Forbidden private network IP/);
  assert.throws(() => validateSourceUrl('http://172.20.0.1/cluster'), /Forbidden private network IP/);
  assert.throws(() => validateSourceUrl('http://169.254.169.254/latest/meta-data'), /Forbidden link-local/);

  // Test valid public URL
  const valid = validateSourceUrl('https://championship-sports.tv/video/highlights-final');
  assert(valid.valid, 'Valid public HTTPS URL must be accepted');
  assert.strictEqual(valid.hostname, 'championship-sports.tv');
});

// ---------------------------------------------------------------------------
// TEST 15: Verify no evidence results in UNKNOWN/UNASSESSED rather than fabricated certainty
// ---------------------------------------------------------------------------
runTest('Verify no evidence results in UNKNOWN/UNASSESSED rather than fabricated certainty', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Epistemic Restraint Verification' });

  const claim = store.createClaim({
    investigationId: inv.id,
    statement: 'A mysterious event happened at 3 AM with unverified witnesses.',
    claimType: ClaimTypes.EVENT
  });

  assert.strictEqual(claim.status, ClaimStatus.UNASSESSED);
  assert.strictEqual(claim.confidence, null);

  const assessment = assessClaim(store, claim.id);
  assert.strictEqual(assessment.claim.status, ClaimStatus.UNKNOWN);
  assert.strictEqual(assessment.claim.confidence, null, 'Must NOT fabricate confidence without evidence');
  assert(assessment.whatRemainsUnknown.length > 0);
  assert(assessment.whatSupportsIt.length === 0);
  assert(assessment.whatConflictsWithIt.length === 0);
});

console.log(`\n🎉 All ${passedCount}/${totalTests} Phase G tests passed successfully!\n`);
