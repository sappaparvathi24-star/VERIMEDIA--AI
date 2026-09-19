// VeriMedia AI — Provenance Core Data Model (Phase F)
import crypto from 'crypto';
import persistence from '../db/persistence.js';

export const PROHIBITED_CERTAINTY_TERMS = [
  'ORIGINAL SOURCE',
  'ORIGINAL FILE',
  'DEFINITIVE ORIGIN',
  'ABSOLUTE ORIGIN',
  'TRUE SOURCE',
  'FIRST EVER',
  '100% TRUE',
  '100% FALSE',
  'TRUTH SCORE',
  'FAKE SCORE',
  'AI TRUTH'
];

export const RelationshipTypes = {
  EXACT_MATCH: 'EXACT_MATCH',
  OBSERVED_SAME_CONTENT: 'OBSERVED_SAME_CONTENT',
  POSSIBLY_DERIVED: 'POSSIBLY_DERIVED',
  SUPPORTED_DERIVATION: 'SUPPORTED_DERIVATION',
  TRANSFORMED_VERSION: 'TRANSFORMED_VERSION',
  UNKNOWN_RELATIONSHIP: 'UNKNOWN_RELATIONSHIP'
};

export const SourceTypes = {
  WEB_PAGE: 'WEB_PAGE',
  SOCIAL_POST: 'SOCIAL_POST',
  VIDEO_PAGE: 'VIDEO_PAGE',
  IMAGE_PAGE: 'IMAGE_PAGE',
  USER_SUBMISSION: 'USER_SUBMISSION',
  ARCHIVE: 'ARCHIVE',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN'
};

export const AppearanceStatus = {
  OBSERVED: 'OBSERVED',
  UNKNOWN: 'UNKNOWN',
  CONFLICTING: 'CONFLICTING'
};

export const FindingStatus = {
  SUPPORTED: 'SUPPORTED',
  INFERRED: 'INFERRED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  CONFLICTING: 'CONFLICTING'
};

export const EvidencePolarity = {
  SUPPORTING: 'SUPPORTING',
  REFUTING: 'REFUTING',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

export const ClaimTypes = {
  ORIGIN: 'ORIGIN',
  DATE: 'DATE',
  LOCATION: 'LOCATION',
  EVENT: 'EVENT',
  IDENTITY: 'IDENTITY',
  CONTENT: 'CONTENT',
  EDITING: 'EDITING',
  OWNERSHIP: 'OWNERSHIP',
  PUBLICATION: 'PUBLICATION',
  CONTEXT: 'CONTEXT'
};

export const ClaimStatus = {
  UNASSESSED: 'UNASSESSED',
  SUPPORTED: 'SUPPORTED',
  PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED',
  CONTRADICTED: 'CONTRADICTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  UNKNOWN: 'UNKNOWN'
};

export const ClaimEvidenceRelationship = {
  SUPPORTS: 'SUPPORTS',
  CONTRADICTS: 'CONTRADICTS',
  CONTEXTUALIZES: 'CONTEXTUALIZES'
};

// ── DISCOVERY & CANDIDATE MATCHING (PHASE H) ───────────────────────────────
export const DiscoveryJobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

export const CandidateStatus = {
  OBSERVED: 'OBSERVED',
  SUPPORTED: 'SUPPORTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  UNKNOWN: 'UNKNOWN'
};

export const CandidateRelationshipType = {
  EXACT_MATCH: 'EXACT_MATCH',
  SAME_CONTENT: 'SAME_CONTENT',
  TRANSFORMED_VERSION: 'TRANSFORMED_VERSION',
  POSSIBLY_DERIVED: 'POSSIBLY_DERIVED',
  RELATED_MEDIA: 'RELATED_MEDIA',
  UNKNOWN: 'UNKNOWN'
};

export const DiscoveryStrategy = {
  ALL: 'ALL',
  EXACT_HASH: 'EXACT_HASH',
  PERCEPTUAL_SIMILARITY: 'PERCEPTUAL_SIMILARITY',
  DIMENSION_ASPECT: 'DIMENSION_ASPECT',
  TRANSFORMATION_INDICATORS: 'TRANSFORMATION_INDICATORS',
  LOCAL_INDEXED: 'LOCAL_INDEXED',
  EXTERNAL_ADAPTER: 'EXTERNAL_ADAPTER'
};

// ── MEDIA GENEALOGY & TRANSFORMATION (PHASE I) ─────────────────────────────
export const TransformationTypes = {
  RESIZE: 'RESIZE',
  CROP: 'CROP',
  LETTERBOX: 'LETTERBOX',
  PADDING: 'PADDING',
  RECOMPRESSION: 'RECOMPRESSION',
  FORMAT_CONVERSION: 'FORMAT_CONVERSION',
  METADATA_STRIPPING: 'METADATA_STRIPPING',
  METADATA_ADDITION: 'METADATA_ADDITION',
  FRAME_TRIMMING: 'FRAME_TRIMMING',
  VIDEO_TRIMMING: 'VIDEO_TRIMMING',
  FRAME_RATE_CHANGE: 'FRAME_RATE_CHANGE',
  FRAME_RATE_CONVERSION: 'FRAME_RATE_CONVERSION',
  CODEC_TRANSCODE: 'CODEC_TRANSCODE',
  AUDIO_RESAMPLE: 'AUDIO_RESAMPLE',
  AUDIO_EXTRACTION: 'AUDIO_EXTRACTION',
  AUDIO_REPLACEMENT: 'AUDIO_REPLACEMENT',
  AUDIO_TRACK_MODIFICATION: 'AUDIO_TRACK_MODIFICATION',
  AUDIO_REENCODING: 'AUDIO_REENCODING',
  AUDIO_SPECTRAL_MODIFICATION: 'AUDIO_SPECTRAL_MODIFICATION',
  AUDIO_VIDEO_TIMING_CHANGE: 'AUDIO_VIDEO_TIMING_CHANGE',
  UNKNOWN: 'UNKNOWN'
};

export const TransformationEpistemicStatus = {
  SUPPORTED: 'SUPPORTED',
  POSSIBLE: 'POSSIBLE',
  HYPOTHETICAL: 'HYPOTHETICAL',
  REFUTED: 'REFUTED',
  CONFLICTING: 'CONFLICTING',
  UNKNOWN: 'UNKNOWN',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

export const TransformationDirection = {
  FORWARD: 'FORWARD',
  REVERSE: 'REVERSE',
  BIDIRECTIONAL: 'BIDIRECTIONAL',
  UNDIRECTED: 'UNDIRECTED',
  HYPOTHETICAL: 'HYPOTHETICAL'
};

// ── PROPAGATION INTELLIGENCE (PHASE J) ──────────────────────────────────
export const PropagationEventType = {
  OBSERVED_APPEARANCE: 'OBSERVED_APPEARANCE',
  PUBLICATION: 'PUBLICATION',
  REPOST: 'REPOST',
  SYNDICATION: 'SYNDICATION',
  MIRROR: 'MIRROR',
  QUOTE_OR_EMBED: 'QUOTE_OR_EMBED',
  TRANSFORMED_APPEARANCE: 'TRANSFORMED_APPEARANCE',
  UNKNOWN: 'UNKNOWN'
};

export const PropagationRelationshipType = {
  OBSERVED_BEFORE: 'OBSERVED_BEFORE',
  POSSIBLE_REPOST: 'POSSIBLE_REPOST',
  POSSIBLE_SYNDICATION: 'POSSIBLE_SYNDICATION',
  POSSIBLE_MIRROR: 'POSSIBLE_MIRROR',
  POSSIBLE_DERIVATION: 'POSSIBLE_DERIVATION',
  RELATED_APPEARANCE: 'RELATED_APPEARANCE',
  UNKNOWN: 'UNKNOWN'
};

export const PropagationEpistemicStatus = {
  OBSERVED: 'OBSERVED',
  SUPPORTED: 'SUPPORTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  UNKNOWN: 'UNKNOWN'
};

// ── MONITORING, ALERTS & REPORTING (PHASE L & M) ───────────────────────────
export const MonitoringJobStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE'
};

export const MonitoredTargetType = {
  ARTIFACT: 'ARTIFACT',
  CANDIDATE_SOURCE: 'CANDIDATE_SOURCE',
  MEDIA_VERSION: 'MEDIA_VERSION',
  PROPAGATION_PATTERN: 'PROPAGATION_PATTERN'
};

export const AlertStatus = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  DISMISSED: 'DISMISSED',
  RESOLVED: 'RESOLVED'
};

export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  INFO: 'INFO',
  CRITICAL: 'CRITICAL'
};

export const AlertType = {
  NEW_APPEARANCE: 'NEW_APPEARANCE',
  NEW_CANDIDATE: 'NEW_CANDIDATE',
  PROPAGATION_CHANGE: 'PROPAGATION_CHANGE',
  EVIDENCE_CONFLICT: 'EVIDENCE_CONFLICT',
  SOURCE_AVAILABILITY_CHANGE: 'SOURCE_AVAILABILITY_CHANGE',
  MONITORING_UNAVAILABLE: 'MONITORING_UNAVAILABLE'
};

/**
 * In-memory unified store for Investigations, Artifacts, Runs, Observations,
 * Evidence, Findings, Sources, Appearances, Versions, Relationships, Claims,
 * Discovery Jobs / Candidates, Transformations (Phase I), Propagation (Phase J),
 * Monitoring Jobs, Alerts, and Report Audit Records (Phase L & M).
 */
export class ProvenanceStore {
  constructor() {
    this.investigations = new Map();
    this.artifacts = new Map();
    this.analysisRuns = new Map();
    this.observations = new Map();
    this.evidence = new Map();
    this.findings = new Map();
    this.sources = new Map();
    this.appearances = new Map();
    this.versions = new Map();
    this.relationships = new Map();
    this.claims = new Map();
    this.discoveryJobs = new Map();
    this.discoveryCandidates = new Map();
    this.transformations = new Map();
    this.propagationEvents = new Map();
    this.propagationRelationships = new Map();
    this.monitoringJobs = new Map();
    this.alerts = new Map();
    this.reportAuditRecords = new Map();

    // Hydrate existing records from SQLite if present
    try {
      const storedInvs = persistence.loadInvestigations();
      for (const inv of storedInvs) {
        this.investigations.set(inv.id, inv);
      }
      const storedArts = persistence.loadArtifacts();
      for (const art of storedArts) {
        this.artifacts.set(art.id, art);
      }
    } catch (_) {}
  }

  clear() {
    this.investigations.clear();
    this.artifacts.clear();
    this.analysisRuns.clear();
    this.observations.clear();
    this.evidence.clear();
    this.findings.clear();
    this.sources.clear();
    this.appearances.clear();
    this.versions.clear();
    this.relationships.clear();
    this.claims.clear();
    this.discoveryJobs.clear();
    this.discoveryCandidates.clear();
    this.transformations.clear();
    this.propagationEvents.clear();
    this.propagationRelationships.clear();
    this.monitoringJobs.clear();
    this.alerts.clear();
    this.reportAuditRecords.clear();
  }

  // ── INVESTIGATION ──────────────────────────────────────────────────────────
  createInvestigation({ id, title, description, status = 'ACTIVE', isDemo = false, metadata = {} }) {
    const invId = id || `INV-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      id: invId,
      title: title || `Investigation ${invId}`,
      description: description || '',
      status,
      artifactIds: [],
      sourceIds: [],
      appearanceIds: [],
      findingIds: [],
      relationshipIds: [],
      claimIds: [],
      notes: [],
      forensicConfidence: metadata.forensicConfidence || 0.85,
      isDemo: Boolean(isDemo || metadata.isDemo),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { ...metadata }
    };
    this.investigations.set(invId, record);
    persistence.saveInvestigation(record);
    return record;
  }

  getInvestigation(id) {
    return this.investigations.get(id) || null;
  }

  addNote(investigationId, { author = 'Lead Analyst', text, tags = [] } = {}) {
    const inv = this.getInvestigation(investigationId);
    if (!inv) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }
    if (!inv.notes) {
      inv.notes = [];
    }
    const note = {
      id: `NOTE-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      investigationId,
      author: author || 'Lead Analyst',
      text: text || '',
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString()
    };
    inv.notes.push(note);
    inv.updatedAt = note.createdAt;
    return note;
  }

  getNotes(investigationId) {
    const inv = this.getInvestigation(investigationId);
    if (!inv) return [];
    return inv.notes || [];
  }

  // ── MEDIA ARTIFACT ─────────────────────────────────────────────────────────
  createArtifact({
    id,
    investigationId,
    filename,
    mimeType = 'video/mp4',
    byteSize = 102400,
    sha256,
    perceptualHash,
    dimensions = { width: 1920, height: 1080 },
    duration = 15.0,
    isReference = false,
    isDemo = false,
    metadata = {},
    buffer,
    ...rest
  }) {
    const artId = id || `ART-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const computedSha = sha256 || (buffer ? crypto.createHash('sha256').update(buffer).digest('hex') : crypto.createHash('sha256').update(`${investigationId || 'INV'}:${filename || 'file'}:${artId}`).digest('hex'));
    const computedPHash = perceptualHash || crypto.createHash('md5').update(computedSha).digest('hex').slice(0, 16);

    const artifact = {
      id: artId,
      investigationId,
      filename: filename || `${artId}.mp4`,
      mimeType,
      byteSize,
      sha256: computedSha,
      perceptualHash: computedPHash,
      dimensions: dimensions ? {
        width: dimensions.width || 1920,
        height: dimensions.height || 1080
      } : { width: 1920, height: 1080 },
      duration,
      isReference: Boolean(isReference),
      isDemo: Boolean(isDemo),
      createdAt: new Date().toISOString(),
      metadata: { ...metadata },
      ...rest
    };

    this.artifacts.set(artId, artifact);
    persistence.saveArtifact(artifact);

    if (investigationId && this.investigations.has(investigationId)) {
      const inv = this.investigations.get(investigationId);
      if (!inv.artifactIds.includes(artId)) {
        inv.artifactIds.push(artId);
      }
    }

    return artifact;
  }

  getArtifact(id) {
    return this.artifacts.get(id) || null;
  }

  // ── ANALYSIS RUN ───────────────────────────────────────────────────────────
  createAnalysisRun({
    id,
    investigationId,
    artifactId,
    method = 'PROVENANCE_HASH_AND_PERCEPTUAL_ANALYSIS',
    status = 'COMPLETED',
    metadata = {}
  }) {
    const runId = id || `RUN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const run = {
      id: runId,
      investigationId,
      artifactId,
      method,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status,
      metadata: { ...metadata }
    };
    this.analysisRuns.set(runId, run);
    return run;
  }

  getAnalysisRun(id) {
    return this.analysisRuns.get(id) || null;
  }

  // ── OBSERVATION ────────────────────────────────────────────────────────────
  createObservation({
    id,
    runId,
    artifactId,
    observationType,
    target,
    value,
    confidence = 1.0,
    timestamp,
    metadata = {}
  }) {
    const obsId = id || `OBS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const obs = {
      id: obsId,
      runId,
      artifactId,
      observationType, // e.g. 'SHA256_HASH', 'PHASH_SIMILARITY', 'DIMENSIONS', 'PUBLICATION_TIMESTAMP'
      target: target || artifactId,
      value,
      confidence,
      timestamp: timestamp || new Date().toISOString(),
      metadata: { ...metadata }
    };
    this.observations.set(obsId, obs);
    return obs;
  }

  getObservation(id) {
    return this.observations.get(id) || null;
  }

  // ── EVIDENCE ───────────────────────────────────────────────────────────────
  createEvidence({
    id,
    observationIds = [],
    independenceGroupId,
    evidenceType,
    description,
    confidence = 1.0,
    polarity = EvidencePolarity.SUPPORTING,
    verified = true,
    metadata = {}
  }) {
    const evId = id || `EVD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const ev = {
      id: evId,
      observationIds: [...observationIds],
      independenceGroupId: independenceGroupId || `IG-${evId}`,
      evidenceType,
      description,
      confidence,
      polarity,
      verified: Boolean(verified),
      createdAt: new Date().toISOString(),
      metadata: { ...metadata }
    };
    this.evidence.set(evId, ev);
    return ev;
  }

  getEvidence(id) {
    return this.evidence.get(id) || null;
  }

  // ── FINDING ────────────────────────────────────────────────────────────────
  createFinding({
    id,
    investigationId,
    title,
    summary,
    status = FindingStatus.SUPPORTED,
    confidence = 0.85,
    evidenceIds = [],
    limitations = [],
    metadata = {}
  }) {
    const findId = id || `FND-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const finding = {
      id: findId,
      investigationId,
      title,
      summary,
      status,
      confidence,
      evidenceIds: [...evidenceIds],
      limitations: [...limitations],
      createdAt: new Date().toISOString(),
      metadata: { ...metadata }
    };
    this.findings.set(findId, finding);

    if (investigationId && this.investigations.has(investigationId)) {
      const inv = this.investigations.get(investigationId);
      if (!inv.findingIds.includes(findId)) {
        inv.findingIds.push(findId);
      }
    }

    return finding;
  }

  getFinding(id) {
    return this.findings.get(id) || null;
  }

  // ── SOURCE ─────────────────────────────────────────────────────────────────
  createSource({
    id,
    type = SourceTypes.WEB_PAGE,
    name,
    url,
    domain,
    platform = 'WEB',
    observedAt,
    firstObservedAt,
    lastObservedAt,
    isFirstParty = false,
    containsMediaDirectly = true,
    canDownload = true,
    hasMetadata = true,
    independentlyObserved = true,
    metadata = {}
  }) {
    const srcId = id || `SRC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const parsedDomain = domain || (url ? (() => { try { return new URL(url).hostname; } catch(_) { return null; } })() : null) || 'unknown-domain';
    const now = new Date().toISOString();

    const source = {
      id: srcId,
      type,
      name: name || parsedDomain || 'Unknown Source',
      url: url || null,
      domain: parsedDomain,
      platform,
      observedAt: observedAt || now,
      firstObservedAt: firstObservedAt || observedAt || now,
      lastObservedAt: lastObservedAt || observedAt || now,
      quality: {
        isFirstParty: Boolean(isFirstParty),
        containsMediaDirectly: Boolean(containsMediaDirectly),
        canDownload: Boolean(canDownload),
        hasMetadata: Boolean(hasMetadata),
        independentlyObserved: Boolean(independentlyObserved)
      },
      metadata: { ...metadata }
    };

    this.sources.set(srcId, source);
    return source;
  }

  getSource(id) {
    return this.sources.get(id) || null;
  }

  // ── OBSERVED APPEARANCE ────────────────────────────────────────────────────
  createAppearance({
    id,
    investigationId,
    artifactId,
    sourceId,
    observedAt,
    publishedAt,
    retrievedAt,
    evidenceIds = [],
    status = AppearanceStatus.OBSERVED,
    metadata = {}
  }) {
    const appId = id || `APP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const appearance = {
      id: appId,
      investigationId,
      artifactId,
      sourceId,
      observedAt: observedAt || now, // When system observed the source
      publishedAt: publishedAt || null, // Timestamp claimed/reported by source
      retrievedAt: retrievedAt || observedAt || now,
      evidenceIds: [...evidenceIds],
      status,
      metadata: { ...metadata }
    };

    this.appearances.set(appId, appearance);

    if (investigationId && this.investigations.has(investigationId)) {
      const inv = this.investigations.get(investigationId);
      if (!inv.appearanceIds.includes(appId)) {
        inv.appearanceIds.push(appId);
      }
    }

    return appearance;
  }

  getAppearance(id) {
    return this.appearances.get(id) || null;
  }

  getAppearancesByArtifact(artifactId) {
    return Array.from(this.appearances.values()).filter(a => a.artifactId === artifactId);
  }

  getAppearancesByInvestigation(investigationId) {
    return Array.from(this.appearances.values()).filter(a => a.investigationId === investigationId);
  }

  // ── MEDIA VERSION ──────────────────────────────────────────────────────────
  createMediaVersion({
    id,
    artifactId,
    parentArtifactId = null,
    versionType = 'VARIANT',
    relationship = RelationshipTypes.UNKNOWN_RELATIONSHIP,
    observedAt,
    sourceId = null,
    evidenceIds = [],
    status = 'ACTIVE',
    metadata = {}
  }) {
    const verId = id || `VER-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const version = {
      id: verId,
      artifactId,
      parentArtifactId,
      versionType,
      relationship,
      observedAt: observedAt || new Date().toISOString(),
      sourceId,
      evidenceIds: [...evidenceIds],
      status,
      metadata: { ...metadata }
    };
    this.versions.set(verId, version);
    return version;
  }

  // ── PROVENANCE RELATIONSHIP ────────────────────────────────────────────────
  createRelationship({
    id,
    investigationId,
    fromArtifactId,
    toArtifactId,
    relationshipType = RelationshipTypes.UNKNOWN_RELATIONSHIP,
    evidenceIds = [],
    confidence = 0.5,
    status = 'RECORDED',
    metadata = {}
  }) {
    const relId = id || `REL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const relationship = {
      id: relId,
      investigationId,
      fromArtifactId,
      toArtifactId,
      relationshipType,
      evidenceIds: [...evidenceIds],
      confidence,
      status,
      createdAt: new Date().toISOString(),
      metadata: { ...metadata }
    };

    this.relationships.set(relId, relationship);

    if (investigationId && this.investigations.has(investigationId)) {
      const inv = this.investigations.get(investigationId);
      if (!inv.relationshipIds.includes(relId)) {
        inv.relationshipIds.push(relId);
      }
    }

    return relationship;
  }

  getRelationship(id) {
    return this.relationships.get(id) || null;
  }

  // ── CLAIM (PHASE G) ─────────────────────────────────────────────────────────
  createClaim({
    id,
    investigationId,
    artifactId = null,
    statement,
    claimType = ClaimTypes.CONTEXT,
    sourceId = 'UNKNOWN',
    sourceText = null,
    status = ClaimStatus.UNASSESSED,
    confidence = null,
    evidenceIds = [],
    contradictionIds = [],
    contextualizingIds = [],
    subClaims = [],
    isMultiPart = false,
    assessmentFindingId = null,
    isDemo = false,
    metadata = {}
  }) {
    const claimId = id || `CLM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const claim = {
      id: claimId,
      investigationId,
      artifactId,
      statement: statement || '',
      claimType,
      sourceId: sourceId || 'UNKNOWN',
      sourceText: sourceText || null,
      status,
      confidence,
      evidenceIds: [...evidenceIds],
      contradictionIds: [...contradictionIds],
      contextualizingIds: [...contextualizingIds],
      subClaims: Array.isArray(subClaims) ? subClaims.map(sc => ({ ...sc })) : [],
      isMultiPart: Boolean(isMultiPart || (subClaims && subClaims.length > 0)),
      assessmentFindingId,
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    this.claims.set(claimId, claim);

    if (investigationId && this.investigations.has(investigationId)) {
      const inv = this.investigations.get(investigationId);
      if (!inv.claimIds) inv.claimIds = [];
      if (!inv.claimIds.includes(claimId)) {
        inv.claimIds.push(claimId);
      }
    }

    return claim;
  }

  getClaim(id) {
    return this.claims.get(id) || null;
  }

  updateClaim(id, patch = {}) {
    const claim = this.claims.get(id);
    if (!claim) return null;

    const updated = {
      ...claim,
      ...patch,
      id: claim.id,
      investigationId: claim.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...claim.metadata, ...(patch.metadata || {}) }
    };

    if (patch.evidenceIds) {
      updated.evidenceIds = [...patch.evidenceIds];
    }
    if (patch.contradictionIds) {
      updated.contradictionIds = [...patch.contradictionIds];
    }
    if (patch.contextualizingIds) {
      updated.contextualizingIds = [...patch.contextualizingIds];
    }
    if (patch.subClaims) {
      updated.subClaims = patch.subClaims.map(sc => ({ ...sc }));
      updated.isMultiPart = updated.subClaims.length > 0;
    }

    this.claims.set(id, updated);
    return updated;
  }

  deleteClaim(id) {
    const claim = this.claims.get(id);
    if (!claim) return false;

    if (claim.investigationId && this.investigations.has(claim.investigationId)) {
      const inv = this.investigations.get(claim.investigationId);
      if (inv.claimIds) {
        inv.claimIds = inv.claimIds.filter(cid => cid !== id);
      }
    }

    return this.claims.delete(id);
  }

  // ── DISCOVERY JOBS (PHASE H) ───────────────────────────────────────────────
  createDiscoveryJob({
    id,
    investigationId,
    artifactId,
    status = DiscoveryJobStatus.QUEUED,
    queryStrategy = DiscoveryStrategy.ALL,
    startedAt = null,
    completedAt = null,
    candidateCount = 0,
    error = null,
    isDemo = false,
    metadata = {}
  }) {
    const jobId = id || `JOB-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const job = {
      id: jobId,
      investigationId,
      artifactId,
      status,
      queryStrategy,
      startedAt: startedAt || now,
      completedAt,
      candidateCount,
      error,
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    this.discoveryJobs.set(jobId, job);
    return job;
  }

  getDiscoveryJob(id) {
    return this.discoveryJobs.get(id) || null;
  }

  updateDiscoveryJob(id, patch = {}) {
    const job = this.discoveryJobs.get(id);
    if (!job) return null;

    const updated = {
      ...job,
      ...patch,
      id: job.id,
      investigationId: job.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...job.metadata, ...(patch.metadata || {}) }
    };

    this.discoveryJobs.set(id, updated);
    return updated;
  }

  getDiscoveryJobsByInvestigation(investigationId) {
    return Array.from(this.discoveryJobs.values()).filter(
      j => j.investigationId === investigationId
    );
  }

  // ── DISCOVERY CANDIDATES (PHASE H) ─────────────────────────────────────────
  createDiscoveryCandidate({
    id,
    discoveryJobId,
    investigationId,
    artifactId,
    matchedArtifactId = null,
    sourceId = 'UNKNOWN',
    url = null,
    title = '',
    platform = 'Unknown Platform',
    discoveredAt = null,
    publishedAt = null,
    retrievedAt = null,
    contentHash = null,
    perceptualFingerprint = null,
    similarityMeasurements = {},
    relationshipType = CandidateRelationshipType.UNKNOWN,
    evidenceIds = [],
    independenceGroup = 'UNKNOWN',
    status = CandidateStatus.OBSERVED,
    sourceCharacteristics = {},
    limitations = [],
    transformationIndicators = [],
    isDemo = false,
    metadata = {}
  }) {
    const candidateId = id || `CND-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const candidate = {
      id: candidateId,
      discoveryJobId,
      investigationId,
      artifactId,
      matchedArtifactId,
      sourceId,
      url,
      title: title || 'Unnamed Candidate Appearance',
      platform: platform || 'Web',
      discoveredAt: discoveredAt || now,
      publishedAt: publishedAt || null,
      retrievedAt: retrievedAt || now,
      contentHash,
      perceptualFingerprint,
      similarityMeasurements: { ...similarityMeasurements },
      relationshipType,
      evidenceIds: [...evidenceIds],
      independenceGroup: independenceGroup || 'UNKNOWN',
      status,
      sourceCharacteristics: {
        directMediaHost: false,
        primaryPublisherClaim: false,
        repost: false,
        syndication: false,
        archive: false,
        socialPlatform: false,
        unknownHost: false,
        publicationTimestampAvailable: Boolean(publishedAt),
        mediaBytesRetrievable: false,
        attributionPresent: false,
        independentlyObserved: true,
        ...sourceCharacteristics
      },
      limitations: Array.isArray(limitations) ? [...limitations] : [],
      transformationIndicators: Array.isArray(transformationIndicators) ? [...transformationIndicators] : [],
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    this.discoveryCandidates.set(candidateId, candidate);
    return candidate;
  }

  getDiscoveryCandidate(id) {
    return this.discoveryCandidates.get(id) || null;
  }

  updateDiscoveryCandidate(id, patch = {}) {
    const candidate = this.discoveryCandidates.get(id);
    if (!candidate) return null;

    const updated = {
      ...candidate,
      ...patch,
      id: candidate.id,
      discoveryJobId: candidate.discoveryJobId,
      investigationId: candidate.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...candidate.metadata, ...(patch.metadata || {}) }
    };

    if (patch.evidenceIds) {
      updated.evidenceIds = [...patch.evidenceIds];
    }
    if (patch.limitations) {
      updated.limitations = [...patch.limitations];
    }
    if (patch.transformationIndicators) {
      updated.transformationIndicators = [...patch.transformationIndicators];
    }
    if (patch.sourceCharacteristics) {
      updated.sourceCharacteristics = {
        ...candidate.sourceCharacteristics,
        ...patch.sourceCharacteristics
      };
    }

    this.discoveryCandidates.set(id, updated);
    return updated;
  }

  getDiscoveryCandidatesByJob(jobId) {
    return Array.from(this.discoveryCandidates.values()).filter(
      c => c.discoveryJobId === jobId
    );
  }

  getDiscoveryCandidatesByInvestigation(investigationId) {
    return Array.from(this.discoveryCandidates.values()).filter(
      c => c.investigationId === investigationId
    );
  }

  // ── TRANSFORMATION (PHASE I) ──────────────────────────────────────────────
  createTransformation({
    id,
    investigationId,
    sourceArtifactId,
    targetArtifactId,
    type = TransformationTypes.UNKNOWN,
    direction = TransformationDirection.UNDIRECTED,
    observations = [],
    evidenceIds = [],
    analysisRunId = null,
    analysisMethodId = 'METHOD-GENEALOGY-TRANSFORM-01',
    confidence = 0.5,
    epistemicStatus = TransformationEpistemicStatus.POSSIBLE,
    limitations = [],
    competingHypotheses = [],
    measurements = {},
    isDemo = false,
    metadata = {}
  }) {
    const trfId = id || `TRF-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Extract observation IDs if observation objects passed
    const obsIds = (observations || []).map(obs => (typeof obs === 'string' ? obs : obs.id)).filter(Boolean);
    const evIds = (evidenceIds || []).map(ev => (typeof ev === 'string' ? ev : ev.id)).filter(Boolean);

    const defaultLimits = [
      'Transformation evidence indicates technical consistency, not historical creation order.',
      'Similarity and transformation measurements do not establish legal provenance or original capture.'
    ];

    const transformation = {
      id: trfId,
      investigationId,
      sourceArtifactId,
      targetArtifactId,
      type,
      direction,
      observationIds: obsIds,
      evidenceIds: evIds,
      analysisRunId,
      analysisMethodId,
      confidence: Number(confidence) || 0.5,
      epistemicStatus,
      limitations: Array.isArray(limitations) && limitations.length > 0 ? limitations : defaultLimits,
      competingHypotheses: Array.isArray(competingHypotheses) ? competingHypotheses : [],
      measurements: { ...measurements },
      isDemo: Boolean(isDemo),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { ...metadata }
    };

    if (isDemo && !transformation.limitations.some(l => l.includes('DEMO SCENARIO'))) {
      transformation.limitations.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Generated for simulated genealogy demonstration.');
    }

    this.transformations.set(trfId, transformation);
    return transformation;
  }

  getTransformation(id) {
    return this.transformations.get(id) || null;
  }

  updateTransformation(id, patch = {}) {
    const trf = this.transformations.get(id);
    if (!trf) return null;

    const updated = {
      ...trf,
      ...patch,
      id: trf.id,
      investigationId: trf.investigationId,
      sourceArtifactId: patch.sourceArtifactId || trf.sourceArtifactId,
      targetArtifactId: patch.targetArtifactId || trf.targetArtifactId,
      updatedAt: new Date().toISOString(),
      metadata: { ...trf.metadata, ...(patch.metadata || {}) }
    };

    if (patch.evidenceIds) updated.evidenceIds = [...patch.evidenceIds];
    if (patch.observationIds) updated.observationIds = [...patch.observationIds];
    if (patch.limitations) updated.limitations = [...patch.limitations];
    if (patch.competingHypotheses) updated.competingHypotheses = [...patch.competingHypotheses];
    if (patch.measurements) updated.measurements = { ...trf.measurements, ...patch.measurements };

    this.transformations.set(id, updated);
    return updated;
  }

  deleteTransformation(id) {
    return this.transformations.delete(id);
  }

  getTransformationsByInvestigation(investigationId) {
    return Array.from(this.transformations.values()).filter(
      t => t.investigationId === investigationId
    );
  }

  getTransformationsForArtifact(artifactId) {
    return Array.from(this.transformations.values()).filter(
      t => t.sourceArtifactId === artifactId || t.targetArtifactId === artifactId
    );
  }

  // ── PROPAGATION EVENTS (PHASE J) ──────────────────────────────────────────
  createPropagationEvent({
    id,
    investigationId,
    artifactId,
    sourceId = 'UNKNOWN',
    accountId = null,
    platform = 'Web',
    url = null,
    eventType = PropagationEventType.OBSERVED_APPEARANCE,
    observedAt = null,
    publishedAt = null,
    retrievedAt = null,
    parentEventId = null,
    independenceGroup = null,
    evidenceIds = [],
    confidence = 0.85,
    epistemicStatus = PropagationEpistemicStatus.OBSERVED,
    limitations = [],
    isDemo = false,
    metadata = {}
  }) {
    const evtId = id || `PEVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const defaultLimits = [
      'Observed appearance establishes presence on platform at recorded timestamp; does not establish authorial origin or first publication worldwide.',
      'Temporal observation precedence does not demonstrate causation or copying.'
    ];

    const event = {
      id: evtId,
      investigationId,
      artifactId,
      sourceId,
      accountId,
      platform,
      url,
      eventType,
      observedAt: observedAt || now,
      publishedAt: publishedAt || null,
      retrievedAt: retrievedAt || observedAt || now,
      parentEventId,
      independenceGroup: independenceGroup || `IG-${evtId}`,
      evidenceIds: Array.isArray(evidenceIds) ? [...evidenceIds] : [],
      confidence: Number(confidence) || 0.85,
      epistemicStatus,
      limitations: Array.isArray(limitations) && limitations.length > 0 ? [...limitations] : defaultLimits,
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    if (isDemo && !event.limitations.some(l => l.includes('DEMO SCENARIO'))) {
      event.limitations.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Simulated propagation event for workflow demonstration.');
    }

    this.propagationEvents.set(evtId, event);
    return event;
  }

  getPropagationEvent(id) {
    return this.propagationEvents.get(id) || null;
  }

  updatePropagationEvent(id, patch = {}) {
    const evt = this.propagationEvents.get(id);
    if (!evt) return null;

    const updated = {
      ...evt,
      ...patch,
      id: evt.id,
      investigationId: evt.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...evt.metadata, ...(patch.metadata || {}) }
    };

    if (patch.evidenceIds) updated.evidenceIds = [...patch.evidenceIds];
    if (patch.limitations) updated.limitations = [...patch.limitations];

    this.propagationEvents.set(id, updated);
    return updated;
  }

  deletePropagationEvent(id) {
    return this.propagationEvents.delete(id);
  }

  getPropagationEventsByInvestigation(investigationId) {
    return Array.from(this.propagationEvents.values()).filter(
      e => e.investigationId === investigationId
    );
  }

  getPropagationEventsByArtifact(artifactId) {
    return Array.from(this.propagationEvents.values()).filter(
      e => e.artifactId === artifactId
    );
  }

  // ── PROPAGATION RELATIONSHIPS (PHASE J) ───────────────────────────────────
  createPropagationRelationship({
    id,
    investigationId,
    fromEventId,
    toEventId,
    relationshipType = PropagationRelationshipType.UNKNOWN,
    relationshipBasis = 'INFERRED',
    evidenceIds = [],
    confidence = 0.75,
    epistemicStatus = PropagationEpistemicStatus.SUPPORTED,
    independenceGroup = null,
    limitations = [],
    measurements = {},
    isDemo = false,
    metadata = {}
  }) {
    const relId = id || `PREL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const defaultLimits = [
      'Propagation relationship indicates temporal or distribution pattern, not absolute chain of authorship.',
      'Precedence in observed timeline does not prove direct causation or copying.'
    ];

    const relationship = {
      id: relId,
      investigationId,
      fromEventId,
      toEventId,
      relationshipType,
      relationshipBasis: relationshipBasis || 'INFERRED',
      evidenceIds: Array.isArray(evidenceIds) ? [...evidenceIds] : [],
      confidence: Number(confidence) || 0.75,
      epistemicStatus,
      independenceGroup: independenceGroup || `IG-${relId}`,
      limitations: Array.isArray(limitations) && limitations.length > 0 ? [...limitations] : defaultLimits,
      measurements: { ...measurements },
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    if (isDemo && !relationship.limitations.some(l => l.includes('DEMO SCENARIO'))) {
      relationship.limitations.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Simulated propagation relationship.');
    }

    this.propagationRelationships.set(relId, relationship);
    return relationship;
  }

  getPropagationRelationship(id) {
    return this.propagationRelationships.get(id) || null;
  }

  getPropagationRelationshipsByInvestigation(investigationId) {
    return Array.from(this.propagationRelationships.values()).filter(
      r => r.investigationId === investigationId
    );
  }

  getPropagationRelationshipsForEvent(eventId) {
    return Array.from(this.propagationRelationships.values()).filter(
      r => r.fromEventId === eventId || r.toEventId === eventId
    );
  }

  // ── MONITORING JOBS (PHASE L) ─────────────────────────────────────────────
  createMonitoringJob({
    id,
    investigationId,
    artifactId,
    name,
    status = MonitoringJobStatus.ACTIVE,
    schedule = 'HOURLY',
    lastRunAt = null,
    nextRunAt = null,
    provider = 'LOCAL_FIRST_DISCOVERY',
    monitoredTarget = null,
    limitations = [],
    isDemo = false,
    metadata = {}
  }) {
    const jobId = id || `MJOB-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const defaultLimits = [
      'Monitoring scans indexed web and social platforms for matching perceptual/cryptographic signatures.',
      'Monitoring execution reflects observed public appearances, not offline or unindexed distributions.',
      'Discovery of a candidate does not confirm it as an origin or unauthorized infringement without formal adjudication.'
    ];

    const job = {
      id: jobId,
      investigationId,
      artifactId,
      name: name || `Monitoring Job ${jobId}`,
      status,
      schedule,
      lastRunAt,
      nextRunAt: nextRunAt || new Date(Date.now() + 3600000).toISOString(),
      provider,
      monitoredTarget: monitoredTarget || {
        type: MonitoredTargetType.ARTIFACT,
        targetId: artifactId
      },
      limitations: Array.isArray(limitations) && limitations.length > 0 ? [...limitations] : defaultLimits,
      isDemo: Boolean(isDemo),
      createdAt: now,
      updatedAt: now,
      metadata: { ...metadata }
    };

    if (isDemo && !job.limitations.some(l => l.includes('DEMO SCENARIO'))) {
      job.limitations.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Simulated monitoring job.');
    }

    this.monitoringJobs.set(jobId, job);
    return job;
  }

  getMonitoringJob(id) {
    return this.monitoringJobs.get(id) || null;
  }

  updateMonitoringJob(id, patch = {}) {
    const job = this.monitoringJobs.get(id);
    if (!job) return null;

    const updated = {
      ...job,
      ...patch,
      id: job.id,
      investigationId: job.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...job.metadata, ...(patch.metadata || {}) }
    };

    if (patch.limitations) updated.limitations = [...patch.limitations];
    this.monitoringJobs.set(id, updated);
    return updated;
  }

  deleteMonitoringJob(id) {
    return this.monitoringJobs.delete(id);
  }

  getMonitoringJobsByInvestigation(investigationId) {
    return Array.from(this.monitoringJobs.values()).filter(
      j => j.investigationId === investigationId
    );
  }

  // ── ALERTS (PHASE L) ──────────────────────────────────────────────────────
  createAlert({
    id,
    investigationId,
    monitoringJobId = null,
    artifactId = null,
    eventId = null,
    severity = AlertSeverity.INFO,
    title,
    description,
    alertType = AlertType.NEW_APPEARANCE,
    evidenceIds = [],
    status = AlertStatus.NEW,
    limitations = [],
    isDemo = false,
    metadata = {}
  }) {
    const alertId = id || `ALT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const defaultLimits = [
      'Alert indicates newly observed candidate or propagation signal matching monitoring criteria.',
      'Alert notification relies on linked empirical evidence and does not declare definitive copyright infringement.'
    ];

    const alert = {
      id: alertId,
      investigationId,
      monitoringJobId,
      artifactId,
      eventId,
      severity,
      title: title || `Alert ${alertId}`,
      description: description || '',
      alertType,
      evidenceIds: Array.isArray(evidenceIds) ? [...evidenceIds] : [],
      status,
      limitations: Array.isArray(limitations) && limitations.length > 0 ? [...limitations] : defaultLimits,
      isDemo: Boolean(isDemo),
      createdAt: now,
      acknowledgedAt: null,
      updatedAt: now,
      metadata: { ...metadata }
    };

    if (isDemo && !alert.limitations.some(l => l.includes('DEMO SCENARIO'))) {
      alert.limitations.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Simulated alert.');
    }

    this.alerts.set(alertId, alert);
    return alert;
  }

  getAlert(id) {
    return this.alerts.get(id) || null;
  }

  updateAlert(id, patch = {}) {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    const updated = {
      ...alert,
      ...patch,
      id: alert.id,
      investigationId: alert.investigationId,
      updatedAt: new Date().toISOString(),
      metadata: { ...alert.metadata, ...(patch.metadata || {}) }
    };

    if (patch.evidenceIds) updated.evidenceIds = [...patch.evidenceIds];
    if (patch.limitations) updated.limitations = [...patch.limitations];
    if (patch.status && patch.status !== AlertStatus.NEW && !updated.acknowledgedAt) {
      updated.acknowledgedAt = new Date().toISOString();
    }

    this.alerts.set(id, updated);
    return updated;
  }

  deleteAlert(id) {
    return this.alerts.delete(id);
  }

  getAlertsByInvestigation(investigationId) {
    return Array.from(this.alerts.values()).filter(
      a => a.investigationId === investigationId
    );
  }

  // ── REPORT AUDIT RECORDS (PHASE L & M) ────────────────────────────────────
  createReportRecord({
    id,
    investigationId,
    title,
    generatedBy = 'Lead Forensic Analyst',
    reportVersion = '1.0',
    evidenceSnapshotHash = null,
    evidenceIds = [],
    findingsCount = 0,
    artifactCount = 0,
    exportFormat = 'HTML',
    content = null,
    isDemo = false,
    metadata = {}
  }) {
    const reportId = id || `RPT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record = {
      id: reportId,
      investigationId,
      title: title || `Investigation Report ${reportId}`,
      generatedBy,
      reportVersion,
      evidenceSnapshotHash: evidenceSnapshotHash || `SNAP-${Date.now()}`,
      evidenceIds: Array.isArray(evidenceIds) ? [...evidenceIds] : [],
      findingsCount,
      artifactCount,
      exportFormat,
      content,
      isDemo: Boolean(isDemo),
      createdAt: now,
      metadata: { ...metadata }
    };

    this.reportAuditRecords.set(reportId, record);
    return record;
  }

  getReportRecord(id) {
    return this.reportAuditRecords.get(id) || null;
  }

  getReportsByInvestigation(investigationId) {
    return Array.from(this.reportAuditRecords.values()).filter(
      r => r.investigationId === investigationId
    );
  }
}

export const defaultStore = new ProvenanceStore();
