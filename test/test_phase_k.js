// test/test_phase_k.js
// VeriMedia AI — Phase K Test Suite: Evidence Fusion & Investigation Reasoning
import assert from 'assert';
import {
  ProvenanceStore,
  ClaimTypes,
  ClaimStatus,
  AppearanceStatus,
  EvidencePolarity,
  TransformationTypes,
  PropagationEventType,
  PROHIBITED_CERTAINTY_TERMS
} from '../src/provenance/core.js';
import {
  fuseEvidenceAndReasoning,
  traceReasoningChain
} from '../src/provenance/reasoning.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase K Tests: Evidence Fusion & Investigation Reasoning ──\n');

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Full Evidence Fusion across Analytical Dimensions
// ---------------------------------------------------------------------------
runTest('Test 1: fuseEvidenceAndReasoning unifies evidence across all phases into a single ledger', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Fusion Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'master.mp4' });

  const run = store.createAnalysisRun({ investigationId: inv.id, artifactId: art.id, method: 'HASH_CHECK' });
  const obs = store.createObservation({ runId: run.id, artifactId: art.id, observationType: 'SHA256', value: 'hash123' });
  const ev = store.createEvidence({ observationIds: [obs.id], independenceGroupId: 'IG-1', evidenceType: 'HASH_EVIDENCE' });
  store.createFinding({ investigationId: inv.id, artifactId: art.id, evidenceIds: [ev.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert(fusion.evidenceLedger.length >= 1, 'Evidence ledger must contain fused evidence');
  assert(fusion.evidenceLedger.some(e => e.id === ev.id));
});

// ---------------------------------------------------------------------------
// TEST 2: Evidence Independence Grouping & Counting
// ---------------------------------------------------------------------------
runTest('Test 2: Multiple appearances sharing the same independenceGroupId are counted as 1 distinct channel', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Independence Grouping Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  // 3 evidence items sharing IG-WIRE-AP, 1 item from IG-BROADCAST-NBC
  const ev1 = store.createEvidence({ independenceGroupId: 'IG-WIRE-AP', description: 'Wire outlet 1' });
  const ev2 = store.createEvidence({ independenceGroupId: 'IG-WIRE-AP', description: 'Wire outlet 2' });
  const ev3 = store.createEvidence({ independenceGroupId: 'IG-WIRE-AP', description: 'Wire outlet 3' });
  const ev4 = store.createEvidence({ independenceGroupId: 'IG-BROADCAST-NBC', description: 'Broadcast primary' });

  store.createFinding({ investigationId: inv.id, artifactId: art.id, evidenceIds: [ev1.id, ev2.id, ev3.id, ev4.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert.strictEqual(fusion.distinctIndependenceChannels, 2, 'Must calculate 2 distinct channels (not 4)');
  assert.strictEqual(fusion.independenceSummary.length, 2);
});

// ---------------------------------------------------------------------------
// TEST 3: Shared Independence Group Explanatory Note
// ---------------------------------------------------------------------------
runTest('Test 3: Explanatory note declares when shared independence sources do not constitute independent confirmations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Shared Group Note Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'video.mp4' });

  const ev1 = store.createEvidence({ independenceGroupId: 'IG-SYND-01', description: 'Republisher A' });
  const ev2 = store.createEvidence({ independenceGroupId: 'IG-SYND-01', description: 'Republisher B' });
  store.createFinding({ investigationId: inv.id, artifactId: art.id, evidenceIds: [ev1.id, ev2.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const sharedGroup = fusion.independenceSummary.find(g => g.independenceGroupId === 'IG-SYND-01');
  assert(sharedGroup.isSharedDistribution, 'Must flag as shared distribution');
  assert(sharedGroup.note.includes('represent 1 independent corroboration channel'));
});

// ---------------------------------------------------------------------------
// TEST 4: Contradiction Engine Identifies Contradicted Claims
// ---------------------------------------------------------------------------
runTest('Test 4: Contradiction engine identifies contradicted claims with supporting and contradicting evidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Contradiction Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'viral.mp4' });

  const evSupport = store.createEvidence({ description: 'TikTok caption claiming exclusive leak' });
  const evRefute = store.createEvidence({ description: 'Official broadcast program log from 3 days earlier' });

  const clm = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Published first on TikTok on August 14',
    claimType: ClaimTypes.PUBLICATION,
    status: ClaimStatus.CONTRADICTED,
    evidenceIds: [evSupport.id],
    contradictionIds: [evRefute.id]
  });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert(fusion.contradictions.length >= 1, 'Must detect claim contradiction');
  const ctr = fusion.contradictions.find(c => c.claimId === clm.id);
  assert.strictEqual(ctr.status, 'CONTRADICTED');
  assert.strictEqual(ctr.supportingEvidence.length, 1);
  assert.strictEqual(ctr.contradictingEvidence.length, 1);
});

// ---------------------------------------------------------------------------
// TEST 5: Contradictions are Preserved without Silent Resolution
// ---------------------------------------------------------------------------
runTest('Test 5: Inconclusive and conflicting claims are preserved with explicit limitation disclaimers', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Preserve Conflict Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'leak.mp4' });

  store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    statement: 'Recorded in Location X',
    claimType: ClaimTypes.LOCATION,
    status: ClaimStatus.INCONCLUSIVE
  });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const inconv = fusion.contradictions.find(c => c.status === 'INCONCLUSIVE');
  assert(inconv, 'Must record inconclusive claim in contradiction ledger');
  assert(inconv.limitations.some(l => l.includes('remains unverified')));
});

// ---------------------------------------------------------------------------
// TEST 6: Confidence Separation Vectors (No Collapsed Single Score)
// ---------------------------------------------------------------------------
runTest('Test 6: Confidence dimensions are strictly separated (signal, evidence, finding, relationship, provenance, source)', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Confidence Vector Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'test.mp4' });

  const ev = store.createEvidence({ confidence: 0.92 });
  store.createFinding({ investigationId: inv.id, artifactId: art.id, confidence: 0.88, evidenceIds: [ev.id] });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const dims = fusion.confidenceDimensions;

  assert(typeof dims.signalScore === 'number', 'signalScore must exist');
  assert(typeof dims.evidenceStrength === 'number', 'evidenceStrength must exist');
  assert(typeof dims.findingConfidence === 'number', 'findingConfidence must exist');
  assert(typeof dims.relationshipConfidence === 'number', 'relationshipConfidence must exist');
  assert(typeof dims.provenanceConfidence === 'number', 'provenanceConfidence must exist');
  assert(typeof dims.sourceQuality === 'number', 'sourceQuality must exist');
  assert(Array.isArray(dims.claimAssessments), 'claimAssessments must be array');
});

// ---------------------------------------------------------------------------
// TEST 7: Prohibited Certainty Terms Audit for Reasoning Layer
// ---------------------------------------------------------------------------
runTest('Test 7: Reasoning layer strictly avoids all prohibited certainty terms', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Prohibited Words Reasoning Audit' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'audit.mp4' });

  store.createFinding({ investigationId: inv.id, artifactId: art.id });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const fullText = JSON.stringify(fusion).toUpperCase();

  for (const prohibited of PROHIBITED_CERTAINTY_TERMS) {
    assert(
      !fullText.includes(prohibited.toUpperCase()),
      `Found prohibited certainty term "${prohibited}" in reasoning output`
    );
  }
});

// ---------------------------------------------------------------------------
// TEST 8: Structured Investigation Questions Generated
// ---------------------------------------------------------------------------
runTest('Test 8: buildStructuredQuestions produces standard investigation questions covering all core provenance inquiries', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Questions Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'media.mp4' });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const qIds = fusion.questions.map(q => q.questionId);

  assert(qIds.includes('Q-MEDIA-IDENTITY'));
  assert(qIds.includes('Q-EARLIEST-APPEARANCE'));
  assert(qIds.includes('Q-TRANSFORMATIONS'));
  assert(qIds.includes('Q-CONTEXTUAL-CLAIMS'));
  assert(qIds.includes('Q-PROPAGATION-SPREAD'));
  assert(qIds.includes('Q-SOURCE-INDEPENDENCE'));
});

// ---------------------------------------------------------------------------
// TEST 9: Structured Question Details (Assessment, Evidence, Next Steps)
// ---------------------------------------------------------------------------
runTest('Test 9: Each question includes assessment, evidence lists, limitations, and nextUsefulEvidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Question Details Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'doc.mp4' });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  for (const q of fusion.questions) {
    assert(q.assessment, `Question ${q.questionId} must have an assessment`);
    assert(Array.isArray(q.evidenceSupporting), `Question ${q.questionId} must have evidenceSupporting array`);
    assert(Array.isArray(q.evidenceConflicting), `Question ${q.questionId} must have evidenceConflicting array`);
    assert(Array.isArray(q.limitations) && q.limitations.length > 0, `Question ${q.questionId} must have limitations`);
    assert(Array.isArray(q.nextUsefulEvidence) && q.nextUsefulEvidence.length > 0, `Question ${q.questionId} must declare nextUsefulEvidence`);
  }
});

// ---------------------------------------------------------------------------
// TEST 10: Signature Media Storyline with All 7 Structured Sections
// ---------------------------------------------------------------------------
runTest('Test 10: Media Storyline contains all 7 narrative sections with epistemic status', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Storyline Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'story.mp4', byteSize: 25000000 });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const s = fusion.storyline;
  assert.strictEqual(s.sections.length, 7);

  const titles = s.sections.map(sec => sec.title);
  assert(titles.includes('Examined Media'));
  assert(titles.includes('Directly Observed Appearances'));
  assert(titles.includes('Detected Technical Transformations'));
  assert(titles.includes('Observed Propagation & Spread'));
  assert(titles.includes('Claim Verification Assessment'));
  assert(titles.includes('Propagation & Genealogy Relationships'));
  assert(titles.includes('Uncertainties & Epistemic Boundaries'));
});

// ---------------------------------------------------------------------------
// TEST 11: Storyline Paragraphs Include evidenceIds for "Show Evidence"
// ---------------------------------------------------------------------------
runTest('Test 11: Substantive Storyline sections include evidenceIds enabling "Show Evidence"', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Show Evidence Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'broadcast.mp4', byteSize: 50000000 });
  const src = store.createSource({ name: 'Broadcaster TV', platform: 'Broadcast Network' });

  const ev = store.createEvidence({
    description: 'Official broadcast recording timestamp',
    evidenceType: 'TIMESTAMP_EVIDENCE'
  });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    publishedAt: '2026-08-11T18:00:00Z',
    evidenceIds: [ev.id]
  });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const sec2 = fusion.storyline.sections.find(sec => sec.title === 'Directly Observed Appearances');
  assert(sec2.evidenceIds.includes(ev.id), 'Section 2 must reference observation evidence ID');
  assert.strictEqual(sec2.showEvidenceAvailable, true);
});

// ---------------------------------------------------------------------------
// TEST 12: "What We Know" is Strictly Evidence-Backed
// ---------------------------------------------------------------------------
runTest('Test 12: What We Know returns verified findings with referenced evidence IDs', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'What We Know Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'known.mp4' });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  assert(Array.isArray(fusion.whatWeKnow), 'whatWeKnow must be an array');
  assert(fusion.whatWeKnow.length > 0, 'whatWeKnow must not be empty');
  for (const item of fusion.whatWeKnow) {
    assert(item.statement, 'Item must contain statement');
    assert(Array.isArray(item.evidenceIds), 'Item must contain evidenceIds array');
  }
});

// ---------------------------------------------------------------------------
// TEST 13: "What Remains Unknown" Explicitly Declares Epistemic Boundaries
// ---------------------------------------------------------------------------
runTest('Test 13: What Remains Unknown declares physical capture, offline distribution, and ownership boundaries', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Unknowns Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'mystery.mp4' });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const unknowns = fusion.whatRemainsUnknown;
  assert(unknowns.some(u => u.includes('physical recording moment')));
  assert(unknowns.some(u => u.includes('offline or private distribution')));
  assert(unknowns.some(u => u.includes('copyright ownership chain')));
});

// ---------------------------------------------------------------------------
// TEST 14: Unified Investigation Summary Aggregates Multi-Dimensional Data
// ---------------------------------------------------------------------------
runTest('Test 14: Unified summary contains media identity, integrity findings, provenance observations, claims, genealogy, propagation, and conflicts', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Unified Summary Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'summary_media.mp4' });

  const fusion = fuseEvidenceAndReasoning(store, inv.id);
  const s = fusion.summary;

  assert(s.mediaIdentity, 'Must have mediaIdentity');
  assert(s.integrityFindings, 'Must have integrityFindings');
  assert(s.provenanceObservations, 'Must have provenanceObservations');
  assert(s.claimAssessments, 'Must have claimAssessments');
  assert(s.mediaGenealogy, 'Must have mediaGenealogy');
  assert(s.propagationObservations, 'Must have propagationObservations');
  assert(s.evidenceConflicts, 'Must have evidenceConflicts');
  assert(s.confidenceDimensions, 'Must have confidenceDimensions');
});

// ---------------------------------------------------------------------------
// TEST 15: Traceability Explorer Traces Finding / Claim / Event / Transformation
// ---------------------------------------------------------------------------
runTest('Test 15: traceReasoningChain traces entities back to Evidence, Observation, Run, and Method', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Trace Chain Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'target.mp4' });

  const run = store.createAnalysisRun({
    investigationId: inv.id,
    artifactId: art.id,
    method: 'SPECTRAL_FREQUENCY_ANALYZER'
  });

  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'SPECTRAL_CUTOFF',
    value: '16kHz'
  });

  const ev = store.createEvidence({
    observationIds: [obs.id],
    evidenceType: 'AUDIO_COMPRESSION_EVIDENCE'
  });

  const fnd = store.createFinding({
    investigationId: inv.id,
    artifactId: art.id,
    evidenceIds: [ev.id]
  });

  const trace = traceReasoningChain(store, inv.id, 'FINDING', fnd.id);
  assert.strictEqual(trace.entityId, fnd.id);
  assert.strictEqual(trace.evidence[0].id, ev.id);
  assert.strictEqual(trace.observations[0].id, obs.id);
  assert.strictEqual(trace.analysisRuns[0].id, run.id);
  assert.strictEqual(trace.analysisMethods[0].method, 'SPECTRAL_FREQUENCY_ANALYZER');
});

// ---------------------------------------------------------------------------
// TEST 16: Demo Scenario Isolation in Reasoning Layer
// ---------------------------------------------------------------------------
runTest('Test 16: Real investigations exclude demo entities in reasoning fusion; demo investigations retain simulated flags', () => {
  const store = new ProvenanceStore();
  const realInv = store.createInvestigation({ title: 'Real Inv', isDemo: false });
  const demoInv = store.createInvestigation({ title: 'Demo Inv', isDemo: true });

  const realArt = store.createArtifact({ investigationId: realInv.id, filename: 'real.mp4', isDemo: false });
  const demoArt = store.createArtifact({ investigationId: demoInv.id, filename: 'demo.mp4', isDemo: true });

  const realEv = store.createEvidence({ description: 'Real verified proof', metadata: { isDemo: false } });
  const demoEv = store.createEvidence({ description: 'Demo synthetic mock', metadata: { isDemo: true } });

  store.createFinding({ investigationId: realInv.id, artifactId: realArt.id, evidenceIds: [realEv.id] });
  store.createFinding({ investigationId: demoInv.id, artifactId: demoArt.id, evidenceIds: [demoEv.id] });

  const realFusion = fuseEvidenceAndReasoning(store, realInv.id);
  assert.strictEqual(realFusion.isDemo, false);
  assert(realFusion.evidenceLedger.every(e => !e.metadata?.isDemo));

  const demoFusion = fuseEvidenceAndReasoning(store, demoInv.id);
  assert.strictEqual(demoFusion.isDemo, true);
});

// ---------------------------------------------------------------------------
// TEST 17: ProvenanceService Exposes Reasoning Facades
// ---------------------------------------------------------------------------
runTest('Test 17: ProvenanceService methods (getInvestigationReasoning, getMediaStoryline, getWhatWeKnow, getWhatRemainsUnknown, getInvestigationSummary) return expected structures', () => {
  const invId = 'INV-VM-2026-CHAMP';

  const reasoning = provenanceService.getInvestigationReasoning(invId);
  assert(reasoning.summary, 'Must return summary');
  assert(reasoning.questions.length >= 6, 'Must return 6 questions');

  const storyline = provenanceService.getMediaStoryline(invId);
  assert.strictEqual(storyline.sections.length, 7);

  const whatWeKnow = provenanceService.getWhatWeKnow(invId);
  assert(whatWeKnow.whatWeKnow.length > 0);

  const whatUnknown = provenanceService.getWhatRemainsUnknown(invId);
  assert(whatUnknown.whatRemainsUnknown.length > 0);

  const summary = provenanceService.getInvestigationSummary(invId);
  assert(summary.mediaIdentity.artifactsCount >= 2);
});

// ---------------------------------------------------------------------------
// TEST 18: Seeded Real Case CHAMP Produces Complete Contradiction-Aware Reasoning
// ---------------------------------------------------------------------------
runTest('Test 18: Seeded INV-VM-2026-CHAMP demonstrates contradiction detection between first-party broadcast and TikTok claim', () => {
  const invId = 'INV-VM-2026-CHAMP';
  const fusion = provenanceService.getInvestigationReasoning(invId);

  // Claim 2 on TikTok asserted it was published first on Aug 14, contradicted by Aug 11 broadcast
  const ctr = fusion.contradictions.find(c => c.claimId === 'CLM-CHAMP-02');
  assert(ctr, 'Must find contradiction for CLM-CHAMP-02');
  assert.strictEqual(ctr.status, 'CONTRADICTED');
  assert(ctr.contradictingEvidence.length >= 1, 'Must have contradicting broadcast evidence');

  // Storyline Section 5 reflects the contradiction
  const sec5 = fusion.storyline.sections.find(s => s.sectionNumber === 5);
  assert(sec5.summary.includes('contradicted'), 'Section 5 must mention contradicted claim');
});

console.log(`\n🎉 All ${passed}/18 Phase K Tests Passed Successfully!\n`);
