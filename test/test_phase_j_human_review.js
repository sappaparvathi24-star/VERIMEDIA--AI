// VeriMedia AI — Phase J Test Suite: Human Review & Finding Decisions
import assert from 'node:assert';
import request from 'supertest';
import { 
  ProvenanceStore, 
  FindingStatus, 
  ReviewDecision, 
  InvestigationStatus 
} from '../src/provenance/core.js';
import { provenanceService } from '../src/provenance/service.js';
import { persistence } from '../src/db/persistence.js';
import { app } from '../server.js';
import { generateToken } from '../src/security/auth.js';

console.log('── Running VeriMedia AI Phase J Tests: Human Review & Finding Decisions ──');

let passedTests = 0;
function pass(name) {
  passedTests++;
  console.log(`✔ [PASS] Test ${passedTests}: ${name}`);
}

async function runTests() {
  const store = provenanceService.store;

  // Setup test tokens
  const analystToken = generateToken({
    id: 'usr_analyst_01',
    email: 'analyst@verimedia.ai',
    role: 'ANALYST',
    organizationId: 'org_verimedia_default'
  });

  const otherOrgToken = generateToken({
    id: 'usr_external_01',
    email: 'viewer@external-agency.org',
    role: 'ANALYST',
    organizationId: 'org_external'
  });

  // 1. Setup test investigation
  const inv = provenanceService.createInvestigation({
    id: 'INV-TEST-J01',
    title: 'Phase J Human Review Case',
    status: InvestigationStatus.OPEN,
    isDemo: false,
    metadata: {
      organizationId: 'org_verimedia_default',
      createdBy: 'analyst@verimedia.ai'
    }
  });
  inv.organizationId = 'org_verimedia_default';
  pass('Create test investigation');

  // 2. Create finding
  const finding = provenanceService.createFinding({
    id: 'FND-TEST-001',
    investigationId: inv.id,
    title: 'C2PA Cryptographic Signature Missing',
    statement: 'Artifact payload contains no valid provenance manifest.',
    category: 'FORENSIC_INTEGRITY',
    status: FindingStatus.SUPPORTED,
    confidence: 0.92,
    evidenceIds: ['EVD-01', 'EVD-02'],
    limitations: ['Camera make and model stripped in EXIF']
  });

  assert.strictEqual(finding.id, 'FND-TEST-001');
  assert.strictEqual(finding.status, FindingStatus.SUPPORTED);
  assert.deepStrictEqual(finding.reviews, []);
  pass('Create finding with initial state and empty reviews array');

  // 3. Finding cannot reach RESOLVED without a review
  assert.throws(() => {
    store.updateFinding(finding.id, { status: FindingStatus.RESOLVED });
  }, /Cannot mark finding as RESOLVED without at least one human review/);
  pass('Assert finding cannot reach RESOLVED without a review');

  // 4. Test review validation: REJECT requires rationale
  assert.throws(() => {
    store.recordFindingReview(finding.id, {
      decision: ReviewDecision.REJECT,
      rationale: ''
    });
  }, /Rationale is required/);
  pass('Assert REJECT decision requires non-empty rationale');

  // 5. Record first review: REJECT with rationale
  const review1Result = store.recordFindingReview(finding.id, {
    decision: ReviewDecision.REJECT,
    rationale: 'Signature was found in alternate XMP sidecar file.',
    reviewer: 'Lead Investigator Alice',
    reviewerId: 'usr_analyst_01',
    reviewerRole: 'ANALYST'
  });

  assert.strictEqual(review1Result.finding.status, FindingStatus.CONTRADICTED);
  assert.strictEqual(review1Result.finding.reviews.length, 1);
  assert.strictEqual(review1Result.review.decision, ReviewDecision.REJECT);
  assert.strictEqual(review1Result.review.statusBefore, FindingStatus.SUPPORTED);
  assert.strictEqual(review1Result.review.statusAfter, FindingStatus.CONTRADICTED);
  pass('Record first review (REJECT) -> updates status to CONTRADICTED');

  // 6. Record second review (sequential reviews): ACCEPT after secondary check
  const review2Result = store.recordFindingReview(finding.id, {
    decision: ReviewDecision.ACCEPT,
    rationale: 'XMP sidecar was validated as authentic and intact.',
    reviewer: 'Senior Auditor Bob',
    reviewerId: 'usr_analyst_02',
    reviewerRole: 'SUPERVISOR'
  });

  // Verify two sequential reviews on one finding both persist; neither is lost
  assert.strictEqual(review2Result.finding.reviews.length, 2);
  assert.strictEqual(review2Result.finding.reviews[0].decision, ReviewDecision.REJECT);
  assert.strictEqual(review2Result.finding.reviews[1].decision, ReviewDecision.ACCEPT);
  assert.strictEqual(review2Result.finding.status, FindingStatus.SUPPORTED);
  pass('Two sequential reviews on one finding both persist; neither is lost');

  // 7. Finding can now reach RESOLVED because it has reviews
  const resolvedFinding = store.updateFinding(finding.id, { status: FindingStatus.RESOLVED });
  assert.strictEqual(resolvedFinding.status, FindingStatus.RESOLVED);
  pass('Finding with reviews can now transition to RESOLVED');

  // 8. Investigation Status Legal Transitions
  // OPEN -> IN_REVIEW
  store.updateInvestigationStatus(inv.id, InvestigationStatus.IN_REVIEW);
  assert.strictEqual(inv.status, InvestigationStatus.IN_REVIEW);

  // IN_REVIEW -> RESOLVED
  store.updateInvestigationStatus(inv.id, InvestigationStatus.RESOLVED);
  assert.strictEqual(inv.status, InvestigationStatus.RESOLVED);

  // RESOLVED -> ARCHIVED
  store.updateInvestigationStatus(inv.id, InvestigationStatus.ARCHIVED);
  assert.strictEqual(inv.status, InvestigationStatus.ARCHIVED);

  // ARCHIVED -> OPEN
  store.updateInvestigationStatus(inv.id, InvestigationStatus.OPEN);
  assert.strictEqual(inv.status, InvestigationStatus.OPEN);

  // Invalid transition rejection
  assert.throws(() => {
    store.updateInvestigationStatus(inv.id, 'NON_EXISTENT_STATUS');
  }, /Invalid investigation status/);
  pass('Investigation status legal transitions enforced');

  // 9. Persistence durability: Reviews survive SQLite save and load
  persistence.saveFinding(finding);
  const loadedFindings = persistence.loadFindings({ investigationId: inv.id });
  const reloadedFinding = loadedFindings.find(f => f.id === finding.id);
  assert(reloadedFinding, 'Finding must exist in SQLite loaded findings');
  assert.strictEqual(reloadedFinding.reviews.length, 2);
  assert.strictEqual(reloadedFinding.reviews[0].decision, ReviewDecision.REJECT);
  assert.strictEqual(reloadedFinding.reviews[1].decision, ReviewDecision.ACCEPT);
  pass('Reviews survive SQLite persistence and reload');

  // 10. HTTP Integration: GET /api/investigations/:id/findings
  const getFindingsRes = await request(app)
    .get(`/api/investigations/${inv.id}/findings`)
    .set('Authorization', `Bearer ${analystToken}`);
  assert.strictEqual(getFindingsRes.status, 200);
  assert(Array.isArray(getFindingsRes.body));
  pass('HTTP GET /api/investigations/:id/findings returns 200');

  // 11. HTTP Integration: POST /api/investigations/:id/findings
  const createFindingRes = await request(app)
    .post(`/api/investigations/${inv.id}/findings`)
    .set('Authorization', `Bearer ${analystToken}`)
    .send({
      title: 'ELA Compression Artifact Discrepancy',
      statement: 'ELA heatmap indicates high-frequency residual anomalies in the subject face area.',
      category: 'FORENSIC_INTEGRITY',
      status: 'SUPPORTED',
      confidence: 0.88,
      evidenceIds: ['EVD-01']
    });
  assert.strictEqual(createFindingRes.status, 201);
  assert.strictEqual(createFindingRes.body.title, 'ELA Compression Artifact Discrepancy');
  const createdFindingId = createFindingRes.body.id;
  pass('HTTP POST /api/investigations/:id/findings creates finding');

  // 12. HTTP Integration: PATCH /api/findings/:id without review -> 400 when setting RESOLVED
  const patchResolvedRes = await request(app)
    .patch(`/api/findings/${createdFindingId}`)
    .set('Authorization', `Bearer ${analystToken}`)
    .send({ status: 'RESOLVED' });
  assert.strictEqual(patchResolvedRes.status, 400);
  assert(patchResolvedRes.body.error.includes('Cannot mark finding as RESOLVED without at least one human review'));
  pass('HTTP PATCH /api/findings/:id rejects RESOLVED status when unreviewed (400)');

  // 13. HTTP Integration: POST /api/findings/:id/review with ACCEPT
  const postReviewRes = await request(app)
    .post(`/api/findings/${createdFindingId}/review`)
    .set('Authorization', `Bearer ${analystToken}`)
    .send({
      decision: 'ACCEPT',
      rationale: 'Confirmed high ELA delta against baseline JPEG tables.'
    });
  assert.strictEqual(postReviewRes.status, 200);
  assert.strictEqual(postReviewRes.body.review.decision, 'ACCEPT');
  assert.strictEqual(postReviewRes.body.finding.status, 'SUPPORTED');
  pass('HTTP POST /api/findings/:id/review accepts review and returns 200');

  // 14. HTTP Integration: PATCH /api/investigations/:id/status
  const patchStatusRes = await request(app)
    .patch(`/api/investigations/${inv.id}/status`)
    .set('Authorization', `Bearer ${analystToken}`)
    .send({ status: 'IN_REVIEW' });
  assert.strictEqual(patchStatusRes.status, 200);
  assert.strictEqual(patchStatusRes.body.status, 'IN_REVIEW');
  pass('HTTP PATCH /api/investigations/:id/status updates investigation status');

  // 15. Security Isolation: A user from another organization cannot review a finding in another org investigation (403)
  const crossOrgReviewRes = await request(app)
    .post(`/api/findings/${createdFindingId}/review`)
    .set('Authorization', `Bearer ${otherOrgToken}`)
    .send({
      decision: 'REJECT',
      rationale: 'Unauthorized attempt to modify foreign finding.'
    });
  assert.strictEqual(crossOrgReviewRes.status, 403);
  pass('Security check: User cannot review a finding in another organization investigation (403)');

  console.log(`\n🎉 All ${passedTests} Phase J Human Review & Finding Decision tests PASSED!\n`);
}

runTests().catch(err => {
  console.error('❌ Phase J Test Failure:', err);
  process.exit(1);
});
