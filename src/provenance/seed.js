// VeriMedia AI — Seed Provenance Datasets (Demo & Benchmark Real Cases)
import { FindingStatus, EvidencePolarity, RelationshipTypes, AppearanceStatus, CandidateRelationshipType, CandidateStatus } from './core.js';

export function seedProvenanceData(store) {
  // ── REAL CASE: Global Championship Final Highlights ───────────────────────
  const realInv = store.createInvestigation({
    id: 'INV-VM-2026-CHAMP',
    title: 'Global Championship Final Highlights (Rights Enforcement)',
    description: 'Investigation into multi-platform unauthorized syndication and deepfake audio manipulation of broadcast championship footage.',
    status: 'ACTIVE',
    isDemo: true,
    metadata: {
      isDemo: true,
      demoNotice: 'DEMO SCENARIO — SIMULATED BENCHMARK CASE',
      forensicConfidence: 0.94,
      priority: 'HIGH',
      tags: ['sports', 'broadcast', 'copyright', 'demo']
    }
  });

  const masterArt = store.createArtifact({
    id: 'ART-VM-CHAMP-MASTER',
    investigationId: realInv.id,
    filename: 'official_broadcast_master_1080p.mp4',
    mimeType: 'video/mp4',
    byteSize: 104857600,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    perceptualHash: '1122334455667788',
    dimensions: { width: 1920, height: 1080 },
    duration: 180.0,
    isReference: true,
    isDemo: true
  });

  const infringingArt = store.createArtifact({
    id: 'ART-VM-CHAMP-TIKTOK',
    investigationId: realInv.id,
    filename: 'tiktok_crop_soundmod.mp4',
    mimeType: 'video/mp4',
    byteSize: 20971520,
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    perceptualHash: '1122334455667789',
    dimensions: { width: 1080, height: 1080 },
    duration: 58.0,
    isReference: false,
    isDemo: true
  });

  const broadcastSource = store.createSource({
    id: 'SRC-VM-CHAMP-PRIMARY',
    name: 'Official Rights Holder CDN',
    url: 'https://cdn.rights-holder.org/broadcast/final2026.mp4',
    domain: 'rights-holder.org',
    platform: 'WEB'
  });

  const tiktokSource = store.createSource({
    id: 'SRC-VM-CHAMP-TIKTOK',
    name: 'TikTok Video Re-uploader',
    url: 'https://tiktok.com/@sportsclip/video/7238192',
    domain: 'tiktok.com',
    platform: 'TikTok'
  });

  store.createAppearance({
    investigationId: realInv.id,
    artifactId: masterArt.id,
    sourceId: broadcastSource.id,
    publishedAt: '2026-06-01T18:00:00Z',
    observedAt: '2026-06-01T18:05:00Z',
    status: AppearanceStatus.OBSERVED
  });

  store.createAppearance({
    investigationId: realInv.id,
    artifactId: infringingArt.id,
    sourceId: tiktokSource.id,
    publishedAt: '2026-06-01T20:30:00Z',
    observedAt: '2026-06-01T21:15:00Z',
    status: AppearanceStatus.OBSERVED
  });

  // Analysis run & full traceability chain
  const run1 = store.createAnalysisRun({
    id: 'RUN-VM-CHAMP-FORENSIC-01',
    investigationId: realInv.id,
    artifactId: infringingArt.id,
    method: 'PERCEPTUAL_VECTOR_AND_ELA_ANALYSIS'
  });

  const obs1 = store.createObservation({
    id: 'OBS-VM-CHAMP-HASH-01',
    runId: run1.id,
    artifactId: infringingArt.id,
    observationType: 'PERCEPTUAL_VECTOR_SIMILARITY',
    target: infringingArt.filename,
    value: { similarity: 0.96, hash: infringingArt.perceptualHash },
    confidence: 0.96
  });

  const obs2 = store.createObservation({
    id: 'OBS-VM-CHAMP-CROP-02',
    runId: run1.id,
    artifactId: infringingArt.id,
    observationType: 'SPATIAL_CROPPING_DETECTION',
    target: infringingArt.filename,
    value: { aspect: '1:1', originalAspect: '16:9', croppedRatio: 0.45 },
    confidence: 0.92
  });

  const ev1 = store.createEvidence({
    id: 'EVD-VM-CHAMP-MATCH-01',
    observationIds: [obs1.id, obs2.id],
    independenceGroupId: 'IG-CHAMP-PRIMARY-PERCEPTUAL',
    evidenceType: 'PERCEPTUAL_HASH_CORRELATION',
    description: 'Frame vector correlation exceeds 96% match threshold with 1:1 aspect cropping detected.',
    confidence: 0.96,
    polarity: EvidencePolarity.SUPPORTING
  });

  const finding1 = store.createFinding({
    id: 'FND-VM-CHAMP-PRIMARY-01',
    investigationId: realInv.id,
    title: 'Forensic Detection: Derivative Broadcast Clipping',
    summary: 'Infringing artifact exhibits 96% perceptual match with official broadcast master, with horizontal cropping and watermark exclusion.',
    status: FindingStatus.SUPPORTED,
    confidence: 0.95,
    evidenceIds: [ev1.id],
    limitations: [
      'Visual similarity confirms derivative transformation from broadcast feed.',
      'Does not verify user account identity without social platform API subpoena.'
    ]
  });

  store.createRelationship({
    investigationId: realInv.id,
    fromArtifactId: masterArt.id,
    toArtifactId: infringingArt.id,
    relationshipType: RelationshipTypes.TRANSFORMED_VERSION,
    confidence: 0.96,
    evidenceIds: [ev1.id],
    status: 'SUPPORTED'
  });

  // Seed discovery candidates for CHAMP investigation
  store.createDiscoveryCandidate({
    id: 'CAND-VM-CHAMP-TIKTOK',
    discoveryJobId: 'JOB-VM-CHAMP-01',
    investigationId: realInv.id,
    artifactId: masterArt.id,
    matchedArtifactId: infringingArt.id,
    sourceId: tiktokSource.id,
    url: tiktokSource.url,
    title: 'TikTok Viral Clip Repost',
    platform: 'TikTok',
    discoveredAt: '2026-06-01T21:15:00Z',
    publishedAt: '2026-06-01T20:30:00Z',
    retrievedAt: '2026-06-01T21:20:00Z',
    contentHash: infringingArt.sha256,
    perceptualFingerprint: infringingArt.perceptualHash,
    similarityMeasurements: {
      exactMatch: false,
      visualSimilarity: 0.96,
      hammingDistance: 3
    },
    relationshipType: CandidateRelationshipType.TRANSFORMED_VERSION,
    evidenceIds: [ev1.id],
    independenceGroup: 'IG-CHAMP-TIKTOK-SCRAPER',
    status: CandidateStatus.OBSERVED,
    sourceCharacteristics: {
      isFirstParty: false,
      isAggregator: true
    },
    limitations: [
      'Transformation indicators reflect spatial cropping and audio track alteration.',
      'Appearance timestamp reflects scraper observation, not verified account upload timestamp.'
    ],
    transformationIndicators: [
      'ASPECT_RATIO_MODIFICATION',
      'AUDIO_TRACK_REPLACEMENT',
      'SPATIAL_CROPPING'
    ],
    isDemo: true
  });

  store.createDiscoveryCandidate({
    id: 'CAND-VM-CHAMP-YOUTUBE',
    discoveryJobId: 'JOB-VM-CHAMP-01',
    investigationId: realInv.id,
    artifactId: masterArt.id,
    matchedArtifactId: masterArt.id,
    sourceId: broadcastSource.id,
    url: broadcastSource.url,
    title: 'Official Championship Stream CDN Mirror',
    platform: 'YouTube',
    discoveredAt: '2026-06-01T18:05:00Z',
    publishedAt: '2026-06-01T18:00:00Z',
    retrievedAt: '2026-06-01T18:10:00Z',
    contentHash: masterArt.sha256,
    perceptualFingerprint: masterArt.perceptualHash,
    similarityMeasurements: {
      exactMatch: true,
      visualSimilarity: 1.0,
      hammingDistance: 0
    },
    relationshipType: CandidateRelationshipType.EXACT_MATCH,
    evidenceIds: [ev1.id],
    independenceGroup: 'IG-CHAMP-BROADCAST-CDN',
    status: CandidateStatus.SUPPORTED,
    sourceCharacteristics: {
      isFirstParty: true,
      isAggregator: false
    },
    limitations: [
      'Cryptographic match proves bitstream identity with broadcast feed.',
      'Does not prevent secondary offline redistribution.'
    ],
    transformationIndicators: [],
    isDemo: true
  });

  // ── DEMO CASE: Synthetic Benchmark Demonstration ─────────────────────────
  const demoInv = store.createInvestigation({
    id: 'INV-VM-DEMO-SCENARIO-01',
    title: 'Synthetic Deepfake Audio & Face-Swap Scenario (Demonstration)',
    description: 'Simulated educational benchmark case demonstrating facial boundary artifacts, audio spectral discontinuity, and simulated platform propagation.',
    status: 'ACTIVE',
    isDemo: true,
    metadata: {
      isDemo: true,
      demoNotice: 'DEMO SCENARIO — SIMULATED EVIDENCE',
      forensicConfidence: 0.88,
      priority: 'NORMAL'
    }
  });

  const demoArt1 = store.createArtifact({
    id: 'ART-VM-DEMO-ORIGIN',
    investigationId: demoInv.id,
    filename: 'simulated_interview_base.mp4',
    mimeType: 'video/mp4',
    byteSize: 31457280,
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    perceptualHash: 'aaaabbbbccccdddd',
    isReference: true,
    isDemo: true
  });

  const demoArt2 = store.createArtifact({
    id: 'ART-VM-DEMO-DEEPFAKE',
    investigationId: demoInv.id,
    filename: 'simulated_faceswap_synthetic.mp4',
    mimeType: 'video/mp4',
    byteSize: 28457280,
    sha256: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    perceptualHash: 'aaaabbbbccccddde',
    isReference: false,
    isDemo: true
  });

  store.createAppearance({
    investigationId: demoInv.id,
    artifactId: demoArt1.id,
    publishedAt: '2026-05-10T12:00:00Z',
    status: AppearanceStatus.OBSERVED,
    isDemo: true
  });
}
