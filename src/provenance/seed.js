// VeriMedia AI — Seed Data for Investigations & Scenarios (Phases F, G & H)
import { 
  defaultStore, 
  SourceTypes, 
  AppearanceStatus, 
  EvidencePolarity, 
  RelationshipTypes, 
  ClaimTypes,
  DiscoveryJobStatus,
  DiscoveryStrategy,
  CandidateStatus,
  CandidateRelationshipType,
  MonitoringJobStatus,
  AlertStatus,
  AlertSeverity,
  AlertType
} from './core.js';
import { compareArtifacts } from './comparator.js';
import { buildMediaTimeline } from './timeline.js';
import { assessClaim } from './claims.js';
import { analyzePropagation } from './propagation.js';
import { fuseEvidenceAndReasoning } from './reasoning.js';

export function seedProvenanceData(store = defaultStore) {
  // Case 1: Primary Real Investigation (VM-2026-CHAMP)
  // Two versions of media: 1080p full broadcast vs 720p social crop
  const inv1 = store.createInvestigation({
    id: 'INV-VM-2026-CHAMP',
    title: 'Championship Broadcast Clip — Unauthorized Redistribution',
    description: 'Investigation into unauthorized reposting of official championship finals highlights.',
    status: 'ACTIVE',
    metadata: {
      forensicConfidence: 0.94,
      isDemo: false
    }
  });

  // Artifact 1: Master Reference Broadcast (1080p)
  const art1 = store.createArtifact({
    id: 'ART-VM-101',
    investigationId: inv1.id,
    filename: 'championship_finals_master_1080p.mp4',
    mimeType: 'video/mp4',
    byteSize: 45281000,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    perceptualHash: 'e4f1a2890cd17e34',
    dimensions: { width: 1920, height: 1080 },
    duration: 32.5,
    isReference: true,
    isDemo: false
  });

  // Artifact 2: Reposted Clip (720p with crop)
  const art2 = store.createArtifact({
    id: 'ART-VM-102',
    investigationId: inv1.id,
    filename: 'reposted_clip_sportsfan_720p.mp4',
    mimeType: 'video/mp4',
    byteSize: 18450000,
    sha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    perceptualHash: 'e4f1a2890cd17e30', // Very close hamming distance (1 bit diff)
    dimensions: { width: 1280, height: 720 },
    duration: 31.8,
    isReference: false,
    isDemo: false
  });

  // Artifact 3: Viral Short Clip (Vertical Crop 720x1280, 16.2s)
  const art3 = store.createArtifact({
    id: 'ART-VM-103',
    investigationId: inv1.id,
    filename: 'viral_short_clip_vertical.mp4',
    mimeType: 'video/mp4',
    byteSize: 8450000,
    sha256: 'c772b1890cf541094ba98817290ad9823901cbfba7234199aa7b18923019abbc',
    perceptualHash: 'e4f1a2890cd17e00',
    dimensions: { width: 720, height: 1280 },
    duration: 16.2,
    isReference: false,
    isDemo: false
  });

  // Source 1: Verified Rights Holder Official Channel
  const src1 = store.createSource({
    id: 'SRC-OFFICIAL-01',
    type: SourceTypes.VIDEO_PAGE,
    name: 'Official Championship Network',
    url: 'https://championship-sports.tv/video/highlights-final',
    domain: 'championship-sports.tv',
    platform: 'Official Web Stream',
    observedAt: '2026-08-11T14:30:00Z',
    isFirstParty: true,
    containsMediaDirectly: true,
    canDownload: true,
    hasMetadata: true,
    independentlyObserved: true
  });

  // Source 2: Social Media Reposter
  const src2 = store.createSource({
    id: 'SRC-SOCIAL-02',
    type: SourceTypes.SOCIAL_POST,
    name: 'TikTok @sports_buzz_daily',
    url: 'https://tiktok.com/@sports_buzz_daily/video/99281726',
    domain: 'tiktok.com',
    platform: 'TikTok',
    observedAt: '2026-08-14T09:15:00Z',
    isFirstParty: false,
    containsMediaDirectly: true,
    canDownload: true,
    hasMetadata: false,
    independentlyObserved: true
  });

  // Source 3: Secondary aggregator mirror
  const src3 = store.createSource({
    id: 'SRC-AGGREGATOR-03',
    type: SourceTypes.WEB_PAGE,
    name: 'Daily Viral Sports Aggregator',
    url: 'https://sportsaggregator.net/clip/championship-win',
    domain: 'sportsaggregator.net',
    platform: 'Web Aggregator',
    observedAt: '2026-08-16T18:45:00Z',
    isFirstParty: false,
    containsMediaDirectly: false,
    canDownload: false,
    hasMetadata: false,
    independentlyObserved: false // Syndicated copy
  });

  // Runs, Observations, Evidence for appearances
  const runObs1 = store.createAnalysisRun({
    investigationId: inv1.id,
    artifactId: art1.id,
    method: 'SOURCE_METADATA_OBSERVER'
  });

  const obsPub1 = store.createObservation({
    runId: runObs1.id,
    artifactId: art1.id,
    observationType: 'SOURCE_PUBLICATION_TIMESTAMP',
    target: src1.url,
    value: '2026-08-11T14:00:00Z',
    confidence: 0.98
  });

  const evPub1 = store.createEvidence({
    observationIds: [obsPub1.id],
    independenceGroupId: 'IG-SRC-OFFICIAL',
    evidenceType: 'AUTHENTICATED_SOURCE_RECORD',
    description: 'First-party video publication record verified on championship-sports.tv server with HTTPS certificate.',
    confidence: 0.98,
    polarity: EvidencePolarity.SUPPORTING
  });

  const app1 = store.createAppearance({
    id: 'APP-CHAMP-01',
    investigationId: inv1.id,
    artifactId: art1.id,
    sourceId: src1.id,
    observedAt: '2026-08-11T14:30:00Z',
    publishedAt: '2026-08-11T14:00:00Z',
    retrievedAt: '2026-08-11T14:30:00Z',
    evidenceIds: [evPub1.id],
    status: AppearanceStatus.OBSERVED
  });

  // Appearance 2
  const runObs2 = store.createAnalysisRun({
    investigationId: inv1.id,
    artifactId: art2.id,
    method: 'SOCIAL_PAGE_INGESTION'
  });

  const obsPub2 = store.createObservation({
    runId: runObs2.id,
    artifactId: art2.id,
    observationType: 'SOURCE_PUBLICATION_TIMESTAMP',
    target: src2.url,
    value: '2026-08-14T08:50:00Z',
    confidence: 0.92
  });

  const evPub2 = store.createEvidence({
    observationIds: [obsPub2.id],
    independenceGroupId: 'IG-SRC-TIKTOK',
    evidenceType: 'SOCIAL_METADATA_EXTRACTED',
    description: 'Observed social post publication timestamp on TikTok CDN.',
    confidence: 0.92,
    polarity: EvidencePolarity.SUPPORTING
  });

  const app2 = store.createAppearance({
    id: 'APP-CHAMP-02',
    investigationId: inv1.id,
    artifactId: art2.id,
    sourceId: src2.id,
    observedAt: '2026-08-14T09:15:00Z',
    publishedAt: '2026-08-14T08:50:00Z',
    retrievedAt: '2026-08-14T09:15:00Z',
    evidenceIds: [evPub2.id],
    status: AppearanceStatus.OBSERVED
  });

  // Appearance 3
  const app3 = store.createAppearance({
    id: 'APP-CHAMP-03',
    investigationId: inv1.id,
    artifactId: art2.id,
    sourceId: src3.id,
    observedAt: '2026-08-16T18:45:00Z',
    publishedAt: '2026-08-16T17:20:00Z',
    retrievedAt: '2026-08-16T18:45:00Z',
    evidenceIds: [evPub2.id],
    status: AppearanceStatus.OBSERVED
  });

  // Appearance 4 (for art3)
  const app4 = store.createAppearance({
    id: 'APP-CHAMP-04',
    investigationId: inv1.id,
    artifactId: art3.id,
    sourceId: src2.id,
    observedAt: '2026-08-17T12:00:00Z',
    publishedAt: '2026-08-17T11:30:00Z',
    retrievedAt: '2026-08-17T12:00:00Z',
    evidenceIds: [evPub2.id],
    status: AppearanceStatus.OBSERVED
  });

  // Perform artifact comparisons between versions
  compareArtifacts(store, inv1.id, art1.id, art2.id);
  compareArtifacts(store, inv1.id, art2.id, art3.id);

  // Build timeline for Case 1
  buildMediaTimeline(store, inv1.id);

  // ── CLAIMS FOR CASE 1 (Does the Story Match?) ──
  // Claim 1: Event & Broadcast Authenticity
  const clm1 = store.createClaim({
    id: 'CLM-CHAMP-01',
    investigationId: inv1.id,
    artifactId: art1.id,
    statement: 'This clip portrays the official championship finals broadcast from August 11, 2026.',
    claimType: ClaimTypes.EVENT,
    sourceId: src1.id,
    sourceText: 'Official network broadcast program archive and rights metadata.',
    evidenceIds: [evPub1.id],
    metadata: {
      claimedDate: '2026-08-11',
      claimedEvent: 'Championship Finals',
      timestampType: 'PUBLICATION'
    }
  });
  assessClaim(store, clm1.id);

  // Claim 2: First Publication Claim by Reposter (Contradicted by earlier broadcast)
  const clm2 = store.createClaim({
    id: 'CLM-CHAMP-02',
    investigationId: inv1.id,
    artifactId: art2.id,
    statement: 'TikTok @sports_buzz_daily was the first to publish this recording on August 14, 2026.',
    claimType: ClaimTypes.PUBLICATION,
    sourceId: src2.id,
    sourceText: 'Post caption on TikTok: "Exclusive first look at championship highlights!"',
    evidenceIds: [evPub2.id],
    contradictionIds: [evPub1.id],
    metadata: {
      claimedDate: '2026-08-14',
      timestampType: 'PUBLICATION'
    }
  });
  assessClaim(store, clm2.id);

  // Claim 3: Future / Pre-dated Context Discrepancy
  const clm3 = store.createClaim({
    id: 'CLM-CHAMP-03',
    investigationId: inv1.id,
    artifactId: art2.id,
    statement: 'This video was recorded in Mumbai on September 15, 2026.',
    claimType: ClaimTypes.DATE,
    sourceId: 'UNKNOWN',
    sourceText: 'Viral repost caption claiming live coverage from September 15.',
    metadata: {
      claimedDate: '2026-09-15',
      claimedLocation: 'Mumbai',
      locationPrecision: 'CAPTION'
    }
  });
  assessClaim(store, clm3.id);

  // Claim 4: Legal Ownership assertion
  const clm4 = store.createClaim({
    id: 'CLM-CHAMP-04',
    investigationId: inv1.id,
    artifactId: art2.id,
    statement: 'The TikTok reposter owns full commercial copyright to this footage.',
    claimType: ClaimTypes.OWNERSHIP,
    sourceId: src2.id,
    sourceText: 'Channel bio: "All clips owned and copyrighted."',
    evidenceIds: [evPub2.id]
  });
  assessClaim(store, clm4.id);

  // Analyst Notes for Case 1
  store.addNote(inv1.id, {
    author: 'Chief Media Forensic Analyst',
    text: 'Perceptual hash analysis confirms 97% visual consistency with the 1080p master broadcast. The TikTok reposter altered resolution to 720p and claimed origin, but primary network publication timestamps predate the TikTok post by 3 days.',
    tags: ['FORENSIC_REVIEW', 'ORIGIN_VERIFIED', 'RIGHTS_CONFIRMED']
  });
  store.addNote(inv1.id, {
    author: 'Senior Rights Investigator',
    text: 'Secondary web aggregator mirror at sportsaggregator.net confirmed inactive download stream. Chain of custody remains unbroken on official championship network source.',
    tags: ['CHAIN_OF_CUSTODY', 'MIRROR_CHECK']
  });

  // Source Discovery Job & Discovered Candidates for Case 1 (Phase H)
  const job1 = store.createDiscoveryJob({
    id: 'JOB-CHAMP-01',
    investigationId: inv1.id,
    artifactId: art1.id,
    status: DiscoveryJobStatus.COMPLETED,
    queryStrategy: DiscoveryStrategy.ALL,
    startedAt: '2026-08-16T19:00:00Z',
    completedAt: '2026-08-16T19:00:02Z',
    candidateCount: 2,
    isDemo: false,
    metadata: {
      strategy: 'MULTI_MODAL_INDEXED_HASH',
      externalProviderNotice: 'External discovery unavailable — showing indexed evidence only.'
    }
  });

  // Candidate 1: Transformed social version
  const cnd1 = store.createDiscoveryCandidate({
    id: 'CND-CHAMP-01',
    discoveryJobId: job1.id,
    investigationId: inv1.id,
    artifactId: art1.id,
    matchedArtifactId: art2.id,
    sourceId: src2.id,
    url: src2.url,
    title: 'TikTok @sports_buzz_daily — Highlights Cut',
    platform: 'TikTok',
    discoveredAt: '2026-08-16T19:00:01Z',
    publishedAt: '2026-08-14T09:15:00Z',
    retrievedAt: '2026-08-14T09:30:00Z',
    contentHash: art2.sha256,
    perceptualFingerprint: art2.perceptualHash,
    similarityMeasurements: {
      exactMatch: false,
      hammingDistance: 1,
      visualSimilarity: 0.9688,
      comparisonMethod: 'pHash_64bit_hex'
    },
    relationshipType: CandidateRelationshipType.TRANSFORMED_VERSION,
    evidenceIds: [evPub2.id],
    independenceGroup: 'IG-SRC-SOCIAL-02',
    status: CandidateStatus.SUPPORTED,
    sourceCharacteristics: {
      directMediaHost: true,
      primaryPublisherClaim: false,
      repost: true,
      syndication: false,
      archive: false,
      socialPlatform: true,
      unknownHost: false,
      publicationTimestampAvailable: true,
      mediaBytesRetrievable: true,
      attributionPresent: true,
      independentlyObserved: true
    },
    limitations: [
      'Candidate discovery establishes matching or transformed content across indexed sources; it does not determine capture hardware, earliest recording moment, or legal provenance ownership.',
      'Perceptual similarity indicates consistent visual content, but does not establish provenance ownership or author identity.',
      'Earlier observed publication timestamps represent observed sightings, not historical moment of initial recording.'
    ],
    transformationIndicators: [
      'Dimension transformation observed: 1920x1080 vs 1280x720',
      'Spatial downscale (55% pixel count reduction; 1080p master to 720p social resolution)',
      'Significant bitrate reduction (59% smaller payload; aggressive social recompression)'
    ],
    isDemo: false
  });

  // Candidate 2: Syndicated aggregator mirror
  const cnd2 = store.createDiscoveryCandidate({
    id: 'CND-CHAMP-02',
    discoveryJobId: job1.id,
    investigationId: inv1.id,
    artifactId: art1.id,
    matchedArtifactId: art2.id,
    sourceId: src3.id,
    url: src3.url,
    title: 'Daily Viral Sports Aggregator — Mirror Feed',
    platform: 'Web Aggregator',
    discoveredAt: '2026-08-16T19:00:02Z',
    publishedAt: '2026-08-16T18:45:00Z',
    retrievedAt: '2026-08-16T18:50:00Z',
    contentHash: null,
    perceptualFingerprint: null,
    similarityMeasurements: {
      exactMatch: false,
      hammingDistance: 1,
      visualSimilarity: 0.9688,
      comparisonMethod: 'URL_AND_PERCEPTUAL_CROSS_REFERENCE'
    },
    relationshipType: CandidateRelationshipType.SAME_CONTENT,
    evidenceIds: [evPub2.id],
    independenceGroup: 'IG-SYNDICATED-sportsaggregator.net',
    status: CandidateStatus.SUPPORTED,
    sourceCharacteristics: {
      directMediaHost: false,
      primaryPublisherClaim: false,
      repost: true,
      syndication: true, // Syndicated
      archive: false,
      socialPlatform: false,
      unknownHost: false,
      publicationTimestampAvailable: true,
      mediaBytesRetrievable: false,
      attributionPresent: false,
      independentlyObserved: false // Does NOT count as independent confirmation!
    },
    limitations: [
      'Syndicated or mirrored platform candidate: does not count as an independent corroboration confirmation.',
      'Earlier observed publication timestamps represent observed sightings, not historical moment of initial recording.'
    ],
    transformationIndicators: [
      'Aggregator iframe embed wrapper (no direct binary download available)'
    ],
    isDemo: false
  });

  // -------------------------------------------------------------------------
  // Case 2: Isolated Demo Scenario (DEMO SCENARIO — SIMULATED EVIDENCE)
  // -------------------------------------------------------------------------
  const invDemo = store.createInvestigation({
    id: 'INV-DEMO-SIM-99',
    title: 'Demo Simulated Viral Leak Scenario',
    description: 'Synthetic media propagation simulation demonstrating multi-source discovery.',
    status: 'ACTIVE',
    metadata: {
      isDemo: true,
      forensicConfidence: 0.88,
      demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE'
    }
  });

  const artDemo1 = store.createArtifact({
    id: 'ART-DEMO-01',
    investigationId: invDemo.id,
    filename: 'demo_simulated_asset_original.png',
    mimeType: 'image/png',
    byteSize: 1204000,
    sha256: '1111111111111111111111111111111111111111111111111111111111111111',
    perceptualHash: 'aabbccddeeff0011',
    dimensions: { width: 1920, height: 1080 },
    isDemo: true
  });

  const artDemo2 = store.createArtifact({
    id: 'ART-DEMO-02',
    investigationId: invDemo.id,
    filename: 'demo_simulated_asset_crop.jpg',
    mimeType: 'image/jpeg',
    byteSize: 420000,
    sha256: '2222222222222222222222222222222222222222222222222222222222222222',
    perceptualHash: 'aabbccddeeff0012',
    dimensions: { width: 1080, height: 1080 },
    isDemo: true
  });

  const srcDemo1 = store.createSource({
    id: 'SRC-DEMO-01',
    type: SourceTypes.SOCIAL_POST,
    name: 'Demo Origin Node A (Simulated)',
    url: 'https://demo-node-a.internal/leak/post-01',
    domain: 'demo-node-a.internal',
    platform: 'Simulated Platform',
    observedAt: '2026-09-01T12:00:00Z',
    isFirstParty: false,
    independentlyObserved: true,
    metadata: { isDemo: true, demoBanner: 'DEMO SCENARIO — SIMULATED EVIDENCE' }
  });

  const srcDemo2 = store.createSource({
    id: 'SRC-DEMO-02',
    type: SourceTypes.WEB_PAGE,
    name: 'Demo Mirror Node B (Simulated)',
    url: 'https://demo-node-b.internal/repost/post-02',
    domain: 'demo-node-b.internal',
    platform: 'Simulated Forum',
    observedAt: '2026-09-02T16:00:00Z',
    isFirstParty: false,
    independentlyObserved: true,
    metadata: { isDemo: true, demoBanner: 'DEMO SCENARIO — SIMULATED EVIDENCE' }
  });

  const runDemo = store.createAnalysisRun({
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    method: 'DEMO_SIMULATED_HARVESTER',
    metadata: { isDemo: true }
  });

  const obsDemo = store.createObservation({
    runId: runDemo.id,
    artifactId: artDemo1.id,
    observationType: 'DEMO_SIMULATED_TIMESTAMP',
    target: srcDemo1.url,
    value: '2026-09-01T11:45:00Z',
    metadata: { isDemo: true }
  });

  const evDemo = store.createEvidence({
    observationIds: [obsDemo.id],
    independenceGroupId: 'IG-DEMO-SIM',
    evidenceType: 'SIMULATED_TIMESTAMP_EVIDENCE',
    description: 'DEMO SCENARIO — SIMULATED EVIDENCE: Synthetic timestamp generated for workflow test.',
    confidence: 0.90,
    polarity: EvidencePolarity.SUPPORTING,
    metadata: { isDemo: true }
  });

  store.createAppearance({
    id: 'APP-DEMO-01',
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    sourceId: srcDemo1.id,
    observedAt: '2026-09-01T12:00:00Z',
    publishedAt: '2026-09-01T11:45:00Z',
    evidenceIds: [evDemo.id],
    status: AppearanceStatus.OBSERVED,
    metadata: { isDemo: true }
  });

  store.createAppearance({
    id: 'APP-DEMO-02',
    investigationId: invDemo.id,
    artifactId: artDemo2.id,
    sourceId: srcDemo2.id,
    observedAt: '2026-09-02T16:00:00Z',
    publishedAt: '2026-09-02T15:30:00Z',
    evidenceIds: [evDemo.id],
    status: AppearanceStatus.OBSERVED,
    metadata: { isDemo: true }
  });

  compareArtifacts(store, invDemo.id, artDemo1.id, artDemo2.id);
  buildMediaTimeline(store, invDemo.id);

  // Demo Claim (Simulated)
  const clmDemo = store.createClaim({
    id: 'CLM-DEMO-01',
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    statement: 'Simulated leak originated from internal test server on September 1, 2026.',
    claimType: ClaimTypes.ORIGIN,
    sourceId: srcDemo1.id,
    sourceText: 'Simulated test log entry.',
    evidenceIds: [evDemo.id],
    isDemo: true,
    metadata: {
      isDemo: true,
      demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE'
    }
  });
  assessClaim(store, clmDemo.id);

  // Demo Discovery Job & Discovered Candidates (DEMO SCENARIO — SIMULATED EVIDENCE)
  const jobDemo = store.createDiscoveryJob({
    id: 'JOB-DEMO-01',
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    status: DiscoveryJobStatus.COMPLETED,
    queryStrategy: DiscoveryStrategy.ALL,
    startedAt: '2026-09-02T16:10:00Z',
    completedAt: '2026-09-02T16:10:01Z',
    candidateCount: 1,
    isDemo: true,
    metadata: {
      isDemo: true,
      demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE',
      externalProviderNotice: 'External discovery unavailable — showing indexed evidence only.'
    }
  });

  const cndDemo = store.createDiscoveryCandidate({
    id: 'CND-DEMO-01',
    discoveryJobId: jobDemo.id,
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    matchedArtifactId: artDemo2.id,
    sourceId: srcDemo2.id,
    url: srcDemo2.url,
    title: 'Demo Simulated Mirror Node B (Simulated)',
    platform: 'Simulated Forum',
    discoveredAt: '2026-09-02T16:10:01Z',
    publishedAt: '2026-09-02T15:30:00Z',
    retrievedAt: '2026-09-02T16:00:00Z',
    contentHash: artDemo2.sha256,
    perceptualFingerprint: artDemo2.perceptualHash,
    similarityMeasurements: {
      exactMatch: false,
      hammingDistance: 1,
      visualSimilarity: 0.9688,
      comparisonMethod: 'pHash_64bit_hex'
    },
    relationshipType: CandidateRelationshipType.TRANSFORMED_VERSION,
    evidenceIds: [evDemo.id],
    independenceGroup: 'IG-DEMO-SIM',
    status: CandidateStatus.SUPPORTED,
    sourceCharacteristics: {
      directMediaHost: true,
      primaryPublisherClaim: false,
      repost: true,
      syndication: false,
      archive: false,
      socialPlatform: false,
      unknownHost: false,
      publicationTimestampAvailable: true,
      mediaBytesRetrievable: true,
      attributionPresent: true,
      independentlyObserved: true
    },
    limitations: [
      'DEMO SCENARIO — SIMULATED EVIDENCE: For demonstration only.',
      'Candidate discovery establishes matching or transformed content across indexed sources; it does not determine capture hardware, earliest recording moment, or legal provenance ownership.'
    ],
    transformationIndicators: [
      'Simulated square crop transformation: 1920x1080 to 1080x1080',
      'Simulated re-compression format change: PNG to JPEG'
    ],
    isDemo: true,
    metadata: {
      isDemo: true,
      demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE'
    }
  });

  // ── SEED MONITORING JOBS & ALERTS (PHASE L) ─────────────────────────────
  // Monitoring Job for Real Investigation
  const mJob1 = store.createMonitoringJob({
    id: 'MJOB-VM-CHAMP-01',
    investigationId: inv1.id,
    artifactId: art1.id,
    name: 'Continuous Web & Social Monitoring for Championship Broadcast Master',
    status: MonitoringJobStatus.ACTIVE,
    schedule: 'HOURLY',
    lastRunAt: '2026-08-16T19:00:00Z',
    nextRunAt: '2026-08-16T20:00:00Z',
    provider: 'LOCAL_FIRST_DISCOVERY',
    monitoredTarget: {
      type: 'ARTIFACT',
      targetId: art1.id,
      fingerprint: art1.perceptualHash
    },
    isDemo: false
  });

  // Seed Alert for Real Investigation (backed by evPub2)
  const alt1 = store.createAlert({
    id: 'ALT-VM-CHAMP-01',
    investigationId: inv1.id,
    monitoringJobId: mJob1.id,
    artifactId: art2.id,
    severity: AlertSeverity.HIGH,
    title: 'New Media Appearance Observed on TikTok',
    description: 'Automated monitoring detected an appearance matching registered media signatures on TikTok (@sports_buzz_daily).',
    alertType: AlertType.NEW_APPEARANCE,
    evidenceIds: [evPub2.id],
    status: AlertStatus.REVIEWED,
    isDemo: false
  });

  // Monitoring Job for Demo Scenario
  const mJobDemo = store.createMonitoringJob({
    id: 'MJOB-DEMO-01',
    investigationId: invDemo.id,
    artifactId: artDemo1.id,
    name: 'Demo Simulated Continuous Monitoring Job',
    status: MonitoringJobStatus.ACTIVE,
    schedule: 'DAILY',
    lastRunAt: '2026-09-02T16:00:00Z',
    nextRunAt: '2026-09-03T16:00:00Z',
    provider: 'LOCAL_FIRST_DISCOVERY',
    isDemo: true
  });

  // Run Propagation & Evidence Fusion for Case 1
  analyzePropagation(store, inv1.id);
  fuseEvidenceAndReasoning(store, inv1.id);

  // Run Propagation & Evidence Fusion for Demo Scenario
  analyzePropagation(store, invDemo.id);
  fuseEvidenceAndReasoning(store, invDemo.id);

  return {
    investigations: [inv1, invDemo]
  };
}
