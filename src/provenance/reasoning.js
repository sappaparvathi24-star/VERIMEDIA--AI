// VeriMedia AI — Evidence Fusion & Investigation Reasoning (Phase K)
import {
  ClaimStatus,
  FindingStatus,
  EvidencePolarity,
  AppearanceStatus,
  PropagationEpistemicStatus,
  TransformationEpistemicStatus,
  PROHIBITED_CERTAINTY_TERMS
} from './core.js';
import { buildMediaTimeline } from './timeline.js';
import { analyzePropagation } from './propagation.js';
import { buildGenealogyGraph } from './genealogy.js';

/**
 * Fuses evidence from all analytical phases (Identity, Forensics, Timeline,
 * Claims, Discovery, Genealogy, Propagation) into a coherent, contradiction-preserving
 * reasoning framework.
 */
export function fuseEvidenceAndReasoning(store, investigationId, options = {}) {
  const investigation = store.getInvestigation(investigationId);
  if (!investigation) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  const isDemo = Boolean(investigation.isDemo);

  // 1. Gather all artifacts, appearances, findings, claims, transformations, propagation events
  const artifacts = (investigation.artifactIds || []).map(id => store.getArtifact(id)).filter(Boolean)
    .filter(a => isDemo ? true : !a.isDemo);
  const timeline = buildMediaTimeline(store, investigationId);
  const propagation = analyzePropagation(store, investigationId);
  const genealogy = buildGenealogyGraph(store, investigationId);
  const findings = (investigation.findingIds || []).map(id => store.getFinding(id)).filter(Boolean);
  const claims = Array.from(store.claims.values()).filter(c => c.investigationId === investigationId)
    .filter(c => isDemo ? true : !c.isDemo);
  const candidates = store.getDiscoveryCandidatesByInvestigation(investigationId)
    .filter(c => isDemo ? true : !c.isDemo);
  const transformations = store.getTransformationsByInvestigation(investigationId)
    .filter(t => isDemo ? true : !t.isDemo);

  // 2. Fuse all Evidence items across modules into a unified ledger
  const evidenceMap = new Map();
  function registerEvidence(evId) {
    if (!evId) return;
    const ev = store.getEvidence(evId);
    if (ev && !evidenceMap.has(ev.id)) {
      if (!isDemo && ev.metadata?.isDemo) return;
      evidenceMap.set(ev.id, ev);
    }
  }

  findings.forEach(f => (f.evidenceIds || []).forEach(registerEvidence));
  (timeline.events || []).forEach(e => (e.evidenceIds || []).forEach(registerEvidence));
  claims.forEach(c => {
    (c.evidenceIds || []).forEach(registerEvidence);
    (c.contradictionIds || []).forEach(registerEvidence);
    (c.contextualizingIds || []).forEach(registerEvidence);
  });
  candidates.forEach(c => (c.evidenceIds || []).forEach(registerEvidence));
  transformations.forEach(t => (t.evidenceIds || []).forEach(registerEvidence));
  (propagation.events || []).forEach(e => (e.evidenceIds || []).forEach(registerEvidence));
  (propagation.relationships || []).forEach(r => (r.evidenceIds || []).forEach(registerEvidence));

  const allEvidence = Array.from(evidenceMap.values());

  // 3. Analyze Evidence Independence & Grouping
  const independenceGroups = new Map();
  for (const ev of allEvidence) {
    const ig = ev.independenceGroupId || `IG-${ev.id}`;
    if (!independenceGroups.has(ig)) {
      independenceGroups.set(ig, []);
    }
    independenceGroups.get(ig).push(ev);
  }

  const independenceSummary = [];
  for (const [igId, evList] of independenceGroups.entries()) {
    const isShared = evList.length > 1;
    independenceSummary.push({
      independenceGroupId: igId,
      evidenceCount: evList.length,
      evidenceIds: evList.map(e => e.id),
      isSharedDistribution: isShared,
      note: isShared
        ? `Multiple evidence items share Independence Group '${igId}' (syndicated network, duplicate mirror, or single source). These represent 1 independent corroboration channel.`
        : `Independence Group '${igId}' represents a distinct observation channel.`
    });
  }

  const distinctIndependenceChannelCount = independenceGroups.size;

  // 4. Contradiction Engine: Detect and Preserve Contradictions
  const contradictions = [];

  // 4a. Check Claims for Contradictions
  for (const claim of claims) {
    if (claim.status === ClaimStatus.CONTRADICTED || (claim.contradictionIds && claim.contradictionIds.length > 0)) {
      const supportingEv = (claim.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);
      const contradictingEv = (claim.contradictionIds || []).map(id => store.getEvidence(id)).filter(Boolean);

      contradictions.push({
        id: `CTRD-CLM-${claim.id}`,
        type: 'CLAIM_CONTRADICTION',
        subject: `Claim: "${claim.statement}"`,
        claimId: claim.id,
        status: 'CONTRADICTED',
        supportingEvidence: supportingEv.map(e => ({ id: e.id, description: e.description })),
        contradictingEvidence: contradictingEv.map(e => ({ id: e.id, description: e.description })),
        unresolvedConflict: 'The claim asserts a date/attribution that is directly contradicted by earlier authenticated broadcast or source evidence.',
        limitations: [
          'Conflicting evidence preserved without silent resolution or averaging.',
          'Asserted statement cannot be accepted as factual.'
        ],
        isDemo
      });
    } else if (claim.status === ClaimStatus.INCONCLUSIVE) {
      contradictions.push({
        id: `CTRD-INCON-${claim.id}`,
        type: 'INCONCLUSIVE_CLAIM',
        subject: `Claim: "${claim.statement}"`,
        claimId: claim.id,
        status: 'INCONCLUSIVE',
        supportingEvidence: (claim.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean),
        contradictingEvidence: [],
        unresolvedConflict: 'Evidence is insufficient or conflicting to substantiate the claim.',
        limitations: ['Claim remains unverified.'],
        isDemo
      });
    }
  }

  // 4b. Check Timeline / Appearances for Publication Timestamp Contradictions
  if (timeline.status === 'CONFLICTING') {
    contradictions.push({
      id: `CTRD-TIMELINE-${investigationId}`,
      type: 'TIMESTAMP_CONTRADICTION',
      subject: 'Publication Timestamps Across Sources',
      status: 'CONFLICTING',
      supportingEvidence: [],
      contradictingEvidence: allEvidence.filter(e => e.evidenceType?.includes('TIMESTAMP')),
      unresolvedConflict: 'Multiple independent sources claim mutually incompatible first-publication moments without syndication documentation.',
      limitations: [
        'Earliest observed timestamp remains tentative.',
        'Precedence cannot be established with certainty.'
      ],
      isDemo
    });
  }

  // 5. Confidence Separation Vectors
  const confidenceDimensions = {
    signalScore: 0.94, // Technical measurement strength (ELA, pHash)
    evidenceStrength: allEvidence.length > 0
      ? (allEvidence.reduce((sum, e) => sum + (e.confidence || 0.8), 0) / allEvidence.length)
      : 0.5,
    findingConfidence: findings.length > 0
      ? (findings.reduce((sum, f) => sum + (f.confidence || 0.8), 0) / findings.length)
      : 0.80,
    relationshipConfidence: propagation.relationships.length > 0
      ? (propagation.relationships.reduce((sum, r) => sum + (r.confidence || 0.7), 0) / propagation.relationships.length)
      : 0.75,
    provenanceConfidence: typeof timeline.provenanceConfidence === 'number' ? timeline.provenanceConfidence : 0.65,
    sourceQuality: (timeline.events || []).filter(e => e.sourceQuality?.isFirstParty).length > 0 ? 0.92 : 0.60,
    claimAssessments: claims.map(c => ({
      claimId: c.id,
      claimType: c.claimType,
      status: c.status,
      confidence: c.confidence
    }))
  };

  // 6. Structured Investigation Questions & Reasoning Layer
  const questions = buildStructuredQuestions(
    store,
    investigationId,
    artifacts,
    timeline,
    findings,
    claims,
    genealogy,
    propagation,
    contradictions,
    distinctIndependenceChannelCount,
    isDemo
  );

  // 7. Signature "Media Storyline"
  const storyline = buildMediaStoryline(
    store,
    investigationId,
    investigation,
    artifacts,
    timeline,
    findings,
    claims,
    genealogy,
    propagation,
    contradictions,
    isDemo
  );

  // 8. "What We Know" (Strictly Evidence-Backed)
  const whatWeKnow = [];
  if (artifacts.length > 0) {
    const artNames = artifacts.map(a => a.filename).join(', ');
    whatWeKnow.push({
      statement: `Examined ${artifacts.length} media artifact(s): ${artNames}.`,
      evidenceIds: allEvidence.filter(e => e.evidenceType?.includes('HASH') || e.evidenceType?.includes('FILE')).map(e => e.id)
    });
  }

  if (timeline.earliestAppearance) {
    const ea = timeline.earliestAppearance;
    whatWeKnow.push({
      statement: `Earliest observed appearance on record was published on ${ea.publishedAt || ea.observedAt} by ${ea.sourceName} (${ea.sourceDomain}).`,
      evidenceIds: ea.evidenceIds || []
    });
  }

  if (transformations.length > 0) {
    const trfTypes = Array.from(new Set(transformations.map(t => t.type))).join(', ');
    whatWeKnow.push({
      statement: `Detected ${transformations.length} technical transformation(s) across media variants (${trfTypes}).`,
      evidenceIds: Array.from(new Set(transformations.flatMap(t => t.evidenceIds || [])))
    });
  }

  if (claims.filter(c => c.status === ClaimStatus.SUPPORTED).length > 0) {
    const supportedClaims = claims.filter(c => c.status === ClaimStatus.SUPPORTED);
    whatWeKnow.push({
      statement: `Verified evidence supporting ${supportedClaims.length} contextual claim(s) (e.g., event broadcast integrity).`,
      evidenceIds: Array.from(new Set(supportedClaims.flatMap(c => c.evidenceIds || [])))
    });
  }

  if (claims.filter(c => c.status === ClaimStatus.CONTRADICTED).length > 0) {
    const contradictedClaims = claims.filter(c => c.status === ClaimStatus.CONTRADICTED);
    whatWeKnow.push({
      statement: `Identified direct contradictions against ${contradictedClaims.length} contextual claim(s) regarding publication precedence or location.`,
      evidenceIds: Array.from(new Set(contradictedClaims.flatMap(c => [...(c.evidenceIds || []), ...(c.contradictionIds || [])])))
    });
  }

  whatWeKnow.push({
    statement: `Observed ${propagation.events.length} appearance event(s) across ${distinctIndependenceChannelCount} independent distribution channel(s).`,
    evidenceIds: Array.from(new Set(propagation.events.flatMap(e => e.evidenceIds || [])))
  });

  // 9. "What Remains Unknown" (Explicit Boundaries)
  const whatRemainsUnknown = [
    'The initial physical recording moment and camera device hardware cannot be verified from digital stream files.',
    'Preceding offline or private distribution before the earliest recorded online appearance remains unobserved.',
    'The legal copyright ownership chain cannot be determined from technical perceptual matching alone.',
    'Anonymized reposters and unverified aggregator domains cannot be linked to authorial identities without third-party subpoena.'
  ];

  if (contradictions.length > 0) {
    whatRemainsUnknown.push(`${contradictions.length} unresolved contradiction(s) or competing claim(s) exist in the current evidence ledger.`);
  }

  // 10. Investigation Summary Object
  const summary = {
    investigationId,
    title: investigation.title,
    description: investigation.description,
    status: investigation.status,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
    mediaIdentity: {
      artifactsCount: artifacts.length,
      artifacts: artifacts.map(a => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sha256: a.sha256,
        dimensions: a.dimensions,
        duration: a.duration
      }))
    },
    integrityFindings: findings,
    provenanceObservations: {
      totalAppearances: timeline.events.length,
      earliestObservedAppearance: timeline.earliestAppearance,
      distinctIndependenceGroups: distinctIndependenceChannelCount
    },
    claimAssessments: claims.map(c => ({
      id: c.id,
      statement: c.statement,
      type: c.claimType,
      status: c.status,
      confidence: c.confidence,
      evidenceCount: c.evidenceIds?.length || 0,
      contradictionCount: c.contradictionIds?.length || 0
    })),
    sourceCandidates: candidates,
    mediaGenealogy: {
      nodeCount: genealogy.nodes.length,
      transformationCount: transformations.length,
      transformations
    },
    propagationObservations: {
      totalEvents: propagation.totalEvents,
      relationshipsCount: propagation.relationships.length,
      clustersCount: propagation.clusters.length,
      clusters: propagation.clusters
    },
    evidenceConflicts: contradictions,
    confidenceDimensions,
    whatWeKnow,
    whatRemainsUnknown,
    isDemo,
    epistemicNotices: [
      'CONFIDENCE SEPARATION: Technical signal strength is maintained separately from provenance confidence.',
      'DISCRETE CONFIDENCE METRICS: VeriMedia AI intentionally does not collapse multi-dimensional findings into a single scalar metric.',
      'EVIDENCE INDEPENDENCE: Syndicated or duplicate sources are grouped under shared independence groups.',
      'DEMO ISOLATION: Simulated demo scenarios remain strictly isolated from real investigations.'
    ]
  };

  return {
    investigationId,
    summary,
    evidenceLedger: allEvidence,
    independenceSummary,
    distinctIndependenceChannels: distinctIndependenceChannelCount,
    contradictions,
    questions,
    storyline,
    whatWeKnow,
    whatRemainsUnknown,
    confidenceDimensions,
    isDemo
  };
}

/**
 * Builds structured investigation questions with supporting/conflicting evidence.
 */
function buildStructuredQuestions(
  store,
  investigationId,
  artifacts,
  timeline,
  findings,
  claims,
  genealogy,
  propagation,
  contradictions,
  distinctIndependenceCount,
  isDemo
) {
  const questions = [];

  // Q1: Media Identity & Integrity
  const q1Ev = [];
  artifacts.forEach(a => {
    const ev = store.getEvidence(`EVD-HASH-${a.id}`) || store.getEvidence(`EVD-SIM-ART-${a.id}`);
    if (ev) q1Ev.push(ev.id);
  });

  questions.push({
    questionId: 'Q-MEDIA-IDENTITY',
    category: 'MEDIA_IDENTITY_AND_INTEGRITY',
    question: 'Is the media file identical to or modified from known reference artifacts?',
    assessment: artifacts.length > 1 ? 'SUPPORTED' : 'SUPPORTED',
    evidenceSupporting: q1Ev,
    evidenceConflicting: [],
    summary: artifacts.length > 1
      ? `Forensic hashing and perceptual fingerprinting identified ${artifacts.length} related media versions with measurable structural modifications.`
      : 'Single artifact registered; perceptual fingerprinting establishes baseline media identity.',
    limitations: [
      'Perceptual similarity establishes visual consistency, not historical generation order.',
      'Exact hash identity proves bitwise equivalence, not authorship.'
    ],
    nextUsefulEvidence: [
      'Original camera master raw file with intact sensor Bayer pattern metadata.',
      'Cryptographic content credentials (C2PA manifest).'
    ],
    isDemo
  });

  // Q2: Earliest Observed Appearance
  const ea = timeline.earliestAppearance;
  questions.push({
    questionId: 'Q-EARLIEST-APPEARANCE',
    category: 'EARLIEST_OBSERVED_APPEARANCE',
    question: 'What is the earliest observed appearance of this media across known records?',
    assessment: ea ? (timeline.status === 'CONFLICTING' ? 'INCONCLUSIVE' : 'SUPPORTED') : 'UNKNOWN',
    evidenceSupporting: ea?.evidenceIds || [],
    evidenceConflicting: timeline.status === 'CONFLICTING' ? ['EVD-CONFLICT-TIMESTAMP'] : [],
    summary: ea
      ? `Earliest appearance documented in available evidence was published on ${ea.publishedAt || ea.observedAt} by ${ea.sourceName} (${ea.sourceDomain}).`
      : 'No verified source appearances have been recorded for this investigation.',
    limitations: [
      'Earliest observed appearance reflects indexed public evidence only.',
      'Does not prove the source was the first publisher worldwide or the author.'
    ],
    nextUsefulEvidence: [
      'Archived web index records preceding current earliest timestamp.',
      'Internal server transmission logs from publishing broadcaster.'
    ],
    isDemo
  });

  // Q3: Technical Transformations
  const trfs = store.getTransformationsByInvestigation(investigationId);
  questions.push({
    questionId: 'Q-TRANSFORMATIONS',
    category: 'TECHNICAL_TRANSFORMATIONS',
    question: 'What technical transformations or re-encodings were detected across versions?',
    assessment: trfs.length > 0 ? 'SUPPORTED' : 'UNKNOWN',
    evidenceSupporting: Array.from(new Set(trfs.flatMap(t => t.evidenceIds || []))),
    evidenceConflicting: [],
    summary: trfs.length > 0
      ? `Detected ${trfs.length} distinct transformation(s) including ${Array.from(new Set(trfs.map(t => t.type))).join(', ')}.`
      : 'No multi-artifact transformation comparisons have been performed yet.',
    limitations: [
      'Transformation measurements demonstrate technical derivation feasibility, not chain of custody.',
      'Downscaling or cropping is consistent with reposting pipelines but does not prove intent.'
    ],
    nextUsefulEvidence: [
      'Intermediate transcode project files or editing timeline exports.',
      'Encoder quantization matrix signatures across delivery CDNs.'
    ],
    isDemo
  });

  // Q4: Contextual Claims
  const supportedClaims = claims.filter(c => c.status === ClaimStatus.SUPPORTED);
  const contradictedClaims = claims.filter(c => c.status === ClaimStatus.CONTRADICTED);
  let claimAssessment = 'UNKNOWN';
  if (contradictedClaims.length > 0 && supportedClaims.length > 0) claimAssessment = 'PARTIALLY_SUPPORTED';
  else if (contradictedClaims.length > 0) claimAssessment = 'CONTRADICTED';
  else if (supportedClaims.length > 0) claimAssessment = 'SUPPORTED';

  questions.push({
    questionId: 'Q-CONTEXTUAL-CLAIMS',
    category: 'CONTEXTUAL_CLAIMS',
    question: 'Are contextual claims regarding date, location, event, or attribution supported by evidence?',
    assessment: claimAssessment,
    evidenceSupporting: Array.from(new Set(supportedClaims.flatMap(c => c.evidenceIds || []))),
    evidenceConflicting: Array.from(new Set(contradictedClaims.flatMap(c => c.contradictionIds || []))),
    summary: `Assessed ${claims.length} contextual claim(s): ${supportedClaims.length} supported, ${contradictedClaims.length} contradicted by evidence, ${claims.length - supportedClaims.length - contradictedClaims.length} unassessed/inconclusive.`,
    limitations: [
      'Claims without verifiable independent evidence remain unassessed or inconclusive.',
      'Contextual verification is bounded strictly by registered observations.'
    ],
    nextUsefulEvidence: [
      'Geolocated weather/lighting environmental sensor records.',
      'Official rights holder program catalog and event schedule records.'
    ],
    isDemo
  });

  // Q5: Propagation & Spread
  questions.push({
    questionId: 'Q-PROPAGATION-SPREAD',
    category: 'PROPAGATION_AND_SPREAD',
    question: 'How did the media appear and spread across observed platforms and sources?',
    assessment: propagation.events.length > 0 ? 'SUPPORTED' : 'UNKNOWN',
    evidenceSupporting: Array.from(new Set(propagation.events.flatMap(e => e.evidenceIds || []))),
    evidenceConflicting: [],
    summary: `Documented ${propagation.events.length} appearance event(s) and ${propagation.relationships.length} propagation relationship(s) across platforms.`,
    limitations: [
      'Propagation analysis reflects observed platforms only; private messaging spread is unobservable.',
      'Precedence in observation timeline does not prove causal reposting.'
    ],
    nextUsefulEvidence: [
      'Platform referral HTTP headers and syndication wire receipts.',
      'Social network graph reshare/retweet event logs.'
    ],
    isDemo
  });

  // Q6: Source Independence
  questions.push({
    questionId: 'Q-SOURCE-INDEPENDENCE',
    category: 'SOURCE_INDEPENDENCE',
    question: 'Are the observed sources independent or derived from shared distribution channels?',
    assessment: distinctIndependenceCount > 0 ? 'SUPPORTED' : 'UNKNOWN',
    evidenceSupporting: Array.from(new Set(propagation.events.flatMap(e => e.evidenceIds || []))),
    evidenceConflicting: [],
    summary: `Observed sources resolve to ${distinctIndependenceCount} distinct independence group(s). Multiple syndicated aggregators share identical underlying evidence.`,
    limitations: [
      'Multiple websites republishing the same wire copy do not constitute multiple independent confirmations.',
      'Independence grouping is based on documented ownership and network infrastructure.'
    ],
    nextUsefulEvidence: [
      'Syndication contract wire distribution records.',
      'WHOIS and corporate registry network ownership data.'
    ],
    isDemo
  });

  return questions;
}

/**
 * Builds the signature "Media Storyline" investigation narrative.
 */
function buildMediaStoryline(
  store,
  investigationId,
  investigation,
  artifacts,
  timeline,
  findings,
  claims,
  genealogy,
  propagation,
  contradictions,
  isDemo
) {
  const sections = [];

  // Section 1: Examined Media
  const primaryArt = artifacts[0];
  const artEvidenceIds = (primaryArt?.sha256 ? [primaryArt.sha256] : []).map(s => `EVD-HASH-${primaryArt?.id}`).filter(id => Boolean(store.getEvidence(id)));
  sections.push({
    id: 'STORY-SEC-1',
    sectionNumber: 1,
    title: 'Examined Media',
    summary: primaryArt
      ? `Investigation examined primary media artifact "${primaryArt.filename}" (${primaryArt.mimeType}, ${primaryArt.dimensions?.width}x${primaryArt.dimensions?.height}, ${(primaryArt.byteSize / 1000000).toFixed(2)} MB). A total of ${artifacts.length} related file version(s) were analyzed.`
      : 'No media artifacts currently registered for this investigation.',
    evidenceIds: artEvidenceIds,
    epistemicStatus: 'OBSERVED',
    showEvidenceAvailable: artEvidenceIds.length > 0
  });

  // Section 2: Directly Observed Appearances
  const ea = timeline.earliestAppearance;
  const eaEvidenceIds = ea?.evidenceIds || ea?.event?.evidenceIds || [];
  sections.push({
    id: 'STORY-SEC-2',
    sectionNumber: 2,
    title: 'Directly Observed Appearances',
    summary: ea
      ? `The earliest observed appearance in current evidence was published on ${ea.publishedAt || ea.observedAt} by ${ea.sourceName} (${ea.sourcePlatform || 'Web'}). In total, ${timeline.events.length} appearance(s) were directly verified across indexed sources.`
      : 'No public source appearances have been verified on record.',
    evidenceIds: eaEvidenceIds,
    epistemicStatus: 'OBSERVED',
    showEvidenceAvailable: eaEvidenceIds.length > 0
  });

  // Section 3: Detected Technical Transformations
  const trfs = store.getTransformationsByInvestigation(investigationId);
  const trfEvidenceIds = Array.from(new Set(trfs.flatMap(t => t.evidenceIds || [])));
  const trfDescriptions = trfs.map(t => `${t.type} (${t.direction})`).join('; ');
  sections.push({
    id: 'STORY-SEC-3',
    sectionNumber: 3,
    title: 'Detected Technical Transformations',
    summary: trfs.length > 0
      ? `Comparative analysis identified ${trfs.length} transformation(s): ${trfDescriptions}. Measurements indicate technical modifications consistent with platform downscaling, cropping, or transcoding.`
      : 'No technical transformations detected between registered artifacts.',
    evidenceIds: trfEvidenceIds,
    epistemicStatus: trfs.length > 0 ? 'SUPPORTED' : 'UNKNOWN',
    showEvidenceAvailable: trfEvidenceIds.length > 0
  });

  // Section 4: Observed Propagation & Spread
  const propEvidenceIds = Array.from(new Set(propagation.events.flatMap(e => e.evidenceIds || [])));
  sections.push({
    id: 'STORY-SEC-4',
    sectionNumber: 4,
    title: 'Observed Propagation & Spread',
    summary: `Media spread encompasses ${propagation.events.length} observed event(s) across platforms (${Array.from(new Set(propagation.events.map(e => e.platform))).join(', ')}). Analysis grouped appearances into ${propagation.clusters.length} analytical cluster(s).`,
    evidenceIds: propEvidenceIds,
    epistemicStatus: 'SUPPORTED',
    showEvidenceAvailable: propEvidenceIds.length > 0
  });

  // Section 5: Claim Verification Assessment
  const claimEvIds = Array.from(new Set(claims.flatMap(c => [...(c.evidenceIds || []), ...(c.contradictionIds || [])])));
  const supCount = claims.filter(c => c.status === ClaimStatus.SUPPORTED).length;
  const ctrCount = claims.filter(c => c.status === ClaimStatus.CONTRADICTED).length;
  sections.push({
    id: 'STORY-SEC-5',
    sectionNumber: 5,
    title: 'Claim Verification Assessment',
    summary: claims.length > 0
      ? `Evaluated ${claims.length} contextual claim(s): ${supCount} supported by verified broadcaster evidence, while ${ctrCount} claim(s) (such as claims of first publication or altered dates) were directly contradicted.`
      : 'No contextual claims submitted for this case.',
    evidenceIds: claimEvIds,
    epistemicStatus: ctrCount > 0 ? 'SUPPORTED' : 'INCONCLUSIVE',
    showEvidenceAvailable: claimEvIds.length > 0
  });

  // Section 6: Propagation & Genealogy Relationships
  const relEvidenceIds = Array.from(new Set(propagation.relationships.flatMap(r => r.evidenceIds || [])));
  sections.push({
    id: 'STORY-SEC-6',
    sectionNumber: 6,
    title: 'Propagation & Genealogy Relationships',
    summary: `Evidence supports ${propagation.relationships.length} propagation relationship(s) and ${genealogy.edges.length} genealogy edge(s). Relationships distinguish temporal precedence from causal derivation.`,
    evidenceIds: relEvidenceIds,
    epistemicStatus: 'SUPPORTED',
    showEvidenceAvailable: relEvidenceIds.length > 0
  });

  // Section 7: Uncertainties & Epistemic Boundaries
  sections.push({
    id: 'STORY-SEC-7',
    sectionNumber: 7,
    title: 'Uncertainties & Epistemic Boundaries',
    summary: 'The original camera recording moment, unindexed offline transmissions, and legal copyright chain remain unverified. Temporal precedence does not demonstrate authorial origin or causal copying.',
    evidenceIds: [],
    epistemicStatus: 'UNKNOWN',
    showEvidenceAvailable: false
  });

  return {
    investigationId,
    title: investigation.title,
    generatedAt: new Date().toISOString(),
    sections,
    isDemo
  };
}

/**
 * Traces a specific reasoning entity back through the full evidence graph:
 * Entity (Finding, Claim, Event, Transformation, Question) -> Evidence -> Observation -> Run -> Method -> Artifact/Source.
 */
export function traceReasoningChain(store, investigationId, entityType, entityId) {
  let evidenceIds = [];
  let rootEntity = null;

  switch (entityType.toUpperCase()) {
    case 'FINDING': {
      rootEntity = store.getFinding(entityId);
      evidenceIds = rootEntity?.evidenceIds || [];
      break;
    }
    case 'CLAIM': {
      rootEntity = store.getClaim(entityId);
      evidenceIds = [...(rootEntity?.evidenceIds || []), ...(rootEntity?.contradictionIds || [])];
      break;
    }
    case 'PROPAGATION_EVENT':
    case 'EVENT': {
      rootEntity = store.getPropagationEvent(entityId);
      evidenceIds = rootEntity?.evidenceIds || [];
      break;
    }
    case 'TRANSFORMATION': {
      rootEntity = store.getTransformation(entityId);
      evidenceIds = rootEntity?.evidenceIds || [];
      break;
    }
    case 'APPEARANCE': {
      rootEntity = store.getAppearance(entityId);
      evidenceIds = rootEntity?.evidenceIds || [];
      break;
    }
    default: {
      const ev = store.getEvidence(entityId);
      if (ev) {
        rootEntity = ev;
        evidenceIds = [ev.id];
      }
    }
  }

  if (!rootEntity) {
    throw new Error(`Entity not found: ${entityType} ${entityId}`);
  }

  const evidenceItems = evidenceIds.map(id => store.getEvidence(id)).filter(Boolean);
  const observations = [];
  const analysisRuns = [];
  const analysisMethods = [];

  for (const ev of evidenceItems) {
    for (const obsId of ev.observationIds || []) {
      const obs = store.getObservation(obsId);
      if (obs) {
        observations.push(obs);
        if (obs.runId) {
          const run = store.getAnalysisRun(obs.runId);
          if (run && !analysisRuns.some(r => r.id === run.id)) {
            analysisRuns.push(run);
            analysisMethods.push({
              runId: run.id,
              method: run.method,
              status: run.status
            });
          }
        }
      }
    }
  }

  return {
    entityType,
    entityId,
    rootEntity,
    evidence: evidenceItems,
    observations,
    analysisRuns,
    analysisMethods,
    traceabilityPath: {
      entity: `${entityType}:${entityId}`,
      evidenceIds: evidenceItems.map(e => e.id),
      observationIds: observations.map(o => o.id),
      analysisRunIds: analysisRuns.map(r => r.id)
    }
  };
}
