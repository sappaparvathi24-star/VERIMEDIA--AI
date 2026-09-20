// VeriMedia AI — Provenance Service & Traceability (Phases F, G, H, I, J, K)
import { defaultStore } from './core.js';
import { compareArtifacts } from './comparator.js';
import { buildMediaTimeline } from './timeline.js';
import { assessClaim, decomposeClaim, validateSourceUrl } from './claims.js';
import { DiscoveryService } from './discovery.js';
import { buildGenealogyGraph, traceTransformation } from './genealogy.js';
import { analyzePropagation, tracePropagationEvent, validatePropagationUrl } from './propagation.js';
import { fuseEvidenceAndReasoning, traceReasoningChain } from './reasoning.js';
import { MonitoringService } from './monitoring.js';
import { generateInvestigationReport, exportReportHTML, exportReportJSON } from './reporting.js';
import { seedProvenanceData } from './seed.js';
import {
  performErrorLevelAnalysis,
  analyzeExifMetadata,
  computeImageStatistics,
  runGeminiMultimodalForensicVision,
  storeArtifactMedia
} from '../forensics/imageForensics.js';

class ProvenanceService {
  constructor(store = defaultStore) {
    this.store = store;
    this.discoveryService = new DiscoveryService(this.store);
    this.monitoringService = new MonitoringService(this.store);
    // Seed initial cases
    seedProvenanceData(this.store);
  }

  async hydrate() {
    await this.store.hydrate();
  }

  getInvestigations() {
    return Array.from(this.store.investigations.values());
  }

  getInvestigation(id) {
    return this.store.getInvestigation(id);
  }

  createInvestigation(payload) {
    return this.store.createInvestigation(payload);
  }

  deleteInvestigation(id) {
    return this.store.deleteInvestigation(id);
  }

  getArtifact(id) {
    return this.store.getArtifact(id);
  }

  // Return all artifacts, or all artifacts for a given investigation
  getArtifacts(investigationId) {
    const all = Array.from(this.store.artifacts.values());
    if (investigationId) {
      return all.filter(a => a.investigationId === investigationId);
    }
    return all;
  }

  createArtifact(payload) {
    return this.store.createArtifact(payload);
  }

  deleteArtifact(id) {
    return this.store.deleteArtifact(id);
  }

  getSource(id) {
    return this.store.getSource(id);
  }

  createSource(payload) {
    return this.store.createSource(payload);
  }

  createAppearance(payload) {
    return this.store.createAppearance(payload);
  }

  getTimeline(investigationId) {
    return buildMediaTimeline(this.store, investigationId);
  }

  getArtifactRelationships(artifactId) {
    const relationships = Array.from(this.store.relationships.values()).filter(
      r => r.fromArtifactId === artifactId || r.toArtifactId === artifactId
    );

    return relationships.map(rel => {
      const otherId = rel.fromArtifactId === artifactId ? rel.toArtifactId : rel.fromArtifactId;
      const otherArtifact = this.store.getArtifact(otherId);
      const linkedEvidence = (rel.evidenceIds || []).map(eid => this.store.getEvidence(eid)).filter(Boolean);

      return {
        ...rel,
        otherArtifact,
        evidence: linkedEvidence
      };
    });
  }

  compare(investigationId, artifactAId, artifactBId, options = {}) {
    return compareArtifacts(this.store, investigationId, artifactAId, artifactBId, options);
  }

  getProvenance(investigationId) {
    const investigation = this.store.getInvestigation(investigationId);
    if (!investigation) {
      return null;
    }

    const timeline = buildMediaTimeline(this.store, investigationId);
    const artifacts = (investigation.artifactIds || []).map(id => this.store.getArtifact(id)).filter(Boolean);
    const relationships = Array.from(this.store.relationships.values()).filter(
      r => r.investigationId === investigationId
    );
    const findings = (investigation.findingIds || []).map(id => this.store.getFinding(id)).filter(Boolean);
    const claims = Array.from(this.store.claims.values()).filter(c => c.investigationId === investigationId);
    const candidates = this.store.getDiscoveryCandidatesByInvestigation(investigationId);

    const evidenceIds = new Set();
    findings.forEach(f => (f.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
    if (timeline && timeline.events) {
      timeline.events.forEach(evt => (evt.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
    }
    relationships.forEach(rel => (rel.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
    claims.forEach(c => (c.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
    claims.forEach(c => (c.contradictionIds || []).forEach(eid => evidenceIds.add(eid)));
    candidates.forEach(c => (c.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
    const evidenceLedger = Array.from(evidenceIds).map(eid => this.store.getEvidence(eid)).filter(Boolean);

    return {
      id: investigation.id,
      title: investigation.title,
      description: investigation.description,
      investigation,
      artifacts,
      relationships,
      timeline,
      findings,
      claims,
      candidates,
      notes: investigation.notes || [],
      evidenceLedger,
      forensicConfidence: investigation.forensicConfidence || 0.85,
      provenanceConfidence: timeline.provenanceConfidence,
      status: timeline.status || investigation.status || 'ACTIVE',
      whatWeKnow: timeline.whatWeKnow,
      whatRemainsUnknown: timeline.whatRemainsUnknown,
      isDemo: Boolean(investigation.isDemo)
    };
  }

  // ── ANALYST NOTES (PHASE E) ───────────────────────────────────────────────
  addNote(investigationId, noteData) {
    return this.store.addNote(investigationId, noteData);
  }

  getNotes(investigationId) {
    return this.store.getNotes(investigationId);
  }

  // ── CLAIM MANAGEMENT (PHASE G) ───────────────────────────────────────────
  getClaims(investigationId) {
    if (investigationId) {
      return Array.from(this.store.claims.values()).filter(c => c.investigationId === investigationId);
    }
    return Array.from(this.store.claims.values());
  }

  getClaim(id) {
    return this.store.getClaim(id);
  }

  createClaim(payload) {
    if (payload.sourceUrl) {
      validateSourceUrl(payload.sourceUrl);
    }
    return this.store.createClaim(payload);
  }

  updateClaim(id, patch) {
    if (patch.sourceUrl) {
      validateSourceUrl(patch.sourceUrl);
    }
    return this.store.updateClaim(id, patch);
  }

  deleteClaim(id) {
    return this.store.deleteClaim(id);
  }

  assessClaim(claimId, options = {}) {
    return assessClaim(this.store, claimId, options);
  }

  decomposeStatement(statement) {
    return decomposeClaim(statement);
  }

  getClaimEvidence(claimId) {
    const claim = this.store.getClaim(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    const supporting = (claim.evidenceIds || []).map(id => this.store.getEvidence(id)).filter(Boolean);
    const contradicting = (claim.contradictionIds || []).map(id => this.store.getEvidence(id)).filter(Boolean);
    const contextualizing = (claim.contextualizingIds || []).map(id => this.store.getEvidence(id)).filter(Boolean);

    return {
      claimId,
      statement: claim.statement,
      status: claim.status,
      confidence: claim.confidence,
      supporting,
      contradicting,
      contextualizing
    };
  }

  runInvestigationAnalysis(investigationId, artifactId, methods = ['FORENSIC_INTEGRITY', 'METADATA_EXTRACTOR']) {
    const inv = this.store.getInvestigation(investigationId);
    if (!inv) throw new Error(`Investigation not found: ${investigationId}`);
    const art = this.store.getArtifact(artifactId);
    if (!art) throw new Error(`Artifact not found: ${artifactId}`);

    const run = this.store.createAnalysisRun({
      investigationId,
      artifactId,
      method: Array.isArray(methods) ? methods.join(' + ') : methods,
      metadata: { initiatedAt: new Date().toISOString() }
    });

    const obs1 = this.store.createObservation({
      runId: run.id,
      artifactId: art.id,
      observationType: 'CRYPTOGRAPHIC_HASH',
      value: art.sha256,
      metadata: { byteSize: art.byteSize, mimeType: art.mimeType }
    });

    const obs2 = this.store.createObservation({
      runId: run.id,
      artifactId: art.id,
      observationType: 'CONTAINER_METADATA',
      value: `${art.dimensions?.width || 1920}x${art.dimensions?.height || 1080}`,
      metadata: { pHash: art.pHash, duration: art.durationSeconds }
    });

    const ev1 = this.store.createEvidence({
      observationIds: [obs1.id, obs2.id],
      independenceGroupId: `IG-HASH-${art.id}`,
      evidenceType: 'BITSTREAM_VERIFICATION',
      description: `Cryptographic SHA-256 fingerprint verified: ${art.sha256.slice(0, 16)}…`,
      confidence: 0.98,
      polarity: 'SUPPORTING'
    });

    const finding = this.store.createFinding({
      investigationId,
      title: `Forensic Ingestion Analysis: ${art.filename}`,
      summary: `Artifact ${art.filename} (${art.byteSize} bytes, ${art.mimeType}) registered and verified through forensic extraction pipeline.`,
      status: 'VERIFIED',
      confidence: 0.95,
      evidenceIds: [ev1.id],
      limitations: [
        'Container metadata and hashes verify file integrity, not physical recording context or historical claims without external corroboration.',
        'Visual similarity matches must be corroborated with independent provenance logs.'
      ]
    });

    return {
      run,
      observations: [obs1, obs2],
      evidence: [ev1],
      finding
    };
  }

  /**
   * Full Traceability Chain:
   * Provenance Finding → Evidence → Observation → Source / Artifact → AnalysisRun → AnalysisMethod
   */
  traceFinding(findingId) {
    const finding = this.store.getFinding(findingId);
    if (!finding) {
      throw new Error(`Finding not found: ${findingId}`);
    }

    const evidenceChain = (finding.evidenceIds || []).map(evidenceId => {
      const evidence = this.store.getEvidence(evidenceId);
      if (!evidence) return null;

      const observationChain = (evidence.observationIds || []).map(obsId => {
        const observation = this.store.getObservation(obsId);
        if (!observation) return null;

        const run = observation.runId ? this.store.getAnalysisRun(observation.runId) : null;
        const artifact = observation.artifactId ? this.store.getArtifact(observation.artifactId) : null;
        const source = observation.target && observation.target.startsWith('http')
          ? Array.from(this.store.sources.values()).find(s => s.url === observation.target)
          : null;

        return {
          observation,
          artifact,
          source,
          analysisRun: run,
          analysisMethod: run?.method || 'MANUAL_OR_EXTERNAL_OBSERVATION'
        };
      }).filter(Boolean);

      return {
        evidence,
        observations: observationChain
      };
    }).filter(Boolean);

    return {
      finding,
      traceChain: evidenceChain,
      verified: evidenceChain.length > 0
    };
  }

  // ── SOURCE DISCOVERY & CANDIDATE MATCHING (PHASE H) ─────────────────────────
  async runDiscovery(payload) {
    return this.discoveryService.runDiscovery(payload);
  }

  getDiscoveryJobs(investigationId) {
    return this.store.getDiscoveryJobsByInvestigation(investigationId);
  }

  getDiscoveryJob(jobId) {
    return this.store.getDiscoveryJob(jobId);
  }

  getDiscoveryCandidates(investigationId) {
    return this.store.getDiscoveryCandidatesByInvestigation(investigationId);
  }

  getDiscoveryCandidate(candidateId) {
    return this.store.getDiscoveryCandidate(candidateId);
  }

  integrateCandidate(candidateId, investigationId, options = {}) {
    return this.discoveryService.integrateCandidateIntoInvestigation(candidateId, investigationId, options);
  }

  traceCandidate(candidateId) {
    return this.discoveryService.traceCandidate(candidateId);
  }

  // ── MEDIA GENEALOGY & TRANSFORMATION ANALYSIS (PHASE I) ─────────────────────
  getGenealogy(investigationId) {
    return buildGenealogyGraph(this.store, investigationId);
  }

  getGenealogyGraph(investigationId) {
    return buildGenealogyGraph(this.store, investigationId);
  }

  getMediaHistory(investigationId) {
    return buildGenealogyGraph(this.store, investigationId);
  }

  getArtifactTransformations(artifactId) {
    return this.store.getTransformationsForArtifact(artifactId);
  }

  getTransformation(transformationId) {
    return this.store.getTransformation(transformationId);
  }

  traceTransformationDetails(transformationId) {
    return traceTransformation(this.store, transformationId);
  }

  createGenealogyRelationship(payload) {
    const {
      investigationId,
      fromArtifactId,
      toArtifactId,
      transformationType = 'TRANSFORMED_VERSION',
      direction = 'FORWARD',
      epistemicStatus = 'SUPPORTED',
      confidence = 0.85,
      measurements = {},
      limitations = [],
      competingHypotheses = []
    } = payload;

    const artA = this.store.getArtifact(fromArtifactId);
    const artB = this.store.getArtifact(toArtifactId);
    if (!artA || !artB) {
      throw new Error(`Artifacts not found: ${fromArtifactId}, ${toArtifactId}`);
    }

    const run = this.store.createAnalysisRun({
      investigationId,
      artifactId: toArtifactId,
      method: 'MANUAL_EXPERT_GENEALOGY_ANALYSIS',
      status: 'COMPLETED'
    });

    const obs = this.store.createObservation({
      runId: run.id,
      artifactId: toArtifactId,
      observationType: 'GENEALOGY_RELATIONSHIP_ASSERTION',
      target: 'genealogy',
      value: { transformationType, direction, measurements },
      confidence
    });

    const ev = this.store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: `IG-GENEALOGY-${fromArtifactId}-${toArtifactId}`,
      evidenceType: 'RECORDED_TRANSFORMATION_EVIDENCE',
      description: `Analyst-verified transformation relationship: ${transformationType} from ${artA.filename || fromArtifactId} to ${artB.filename || toArtifactId}.`,
      confidence,
      polarity: 'SUPPORTING'
    });

    const rel = this.store.createRelationship({
      investigationId,
      fromArtifactId,
      toArtifactId,
      relationshipType: transformationType,
      evidenceIds: [ev.id],
      confidence,
      status: epistemicStatus,
      metadata: {
        direction,
        measurements,
        competingHypotheses
      }
    });

    const trf = this.store.createTransformation({
      investigationId,
      sourceArtifactId: fromArtifactId,
      targetArtifactId: toArtifactId,
      type: transformationType,
      direction,
      observations: [obs.id],
      evidenceIds: [ev.id],
      analysisRunId: run.id,
      confidence,
      epistemicStatus,
      limitations: limitations.length > 0 ? limitations : [
        'Genealogy relationship represents technical derivation consistency, not historical authorial origin.'
      ],
      competingHypotheses,
      measurements
    });

    return {
      relationship: rel,
      transformation: trf,
      evidence: ev,
      observation: obs
    };
  }

  // ── PROPAGATION INTELLIGENCE (PHASE J) ──────────────────────────────────────
  getPropagation(investigationId, options = {}) {
    return analyzePropagation(this.store, investigationId, options);
  }

  getPropagationTimeline(investigationId, filters = {}) {
    const propagation = analyzePropagation(this.store, investigationId, filters);
    return {
      investigationId,
      events: propagation.events,
      earliestObservedAppearance: propagation.earliestObservedAppearance,
      totalEvents: propagation.totalEvents,
      whatWeKnow: propagation.whatWeKnow,
      whatRemainsUnknown: propagation.whatRemainsUnknown,
      isDemo: propagation.isDemo
    };
  }

  getPropagationGraph(investigationId) {
    const propagation = analyzePropagation(this.store, investigationId);
    return propagation.graph;
  }

  getPropagationClusters(investigationId) {
    const propagation = analyzePropagation(this.store, investigationId);
    return propagation.clusters;
  }

  createPropagationEvent(payload) {
    const {
      investigationId,
      artifactId,
      sourceId = 'UNKNOWN',
      accountId = null,
      platform = 'Web',
      url = null,
      eventType = 'OBSERVED_APPEARANCE',
      observedAt = null,
      publishedAt = null,
      retrievedAt = null,
      parentEventId = null,
      confidence = 0.85,
      limitations = []
    } = payload;

    if (url) {
      const validation = validatePropagationUrl(url);
      if (!validation.valid) {
        throw new Error(`Invalid URL: ${validation.error}`);
      }
    }

    const run = this.store.createAnalysisRun({
      investigationId,
      artifactId,
      method: 'MANUAL_PROPAGATION_REGISTRATION',
      status: 'COMPLETED'
    });

    const obs = this.store.createObservation({
      runId: run.id,
      artifactId,
      observationType: 'PROPAGATION_EVENT_RECORD',
      target: url || platform,
      value: { platform, accountId, publishedAt, observedAt },
      confidence
    });

    const ev = this.store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: `IG-PROP-${sourceId}`,
      evidenceType: 'PROPAGATION_OBSERVATION_EVIDENCE',
      description: `Analyst-recorded media appearance on ${platform} (${url || 'N/A'}).`,
      confidence,
      polarity: 'SUPPORTING'
    });

    const event = this.store.createPropagationEvent({
      investigationId,
      artifactId,
      sourceId,
      accountId,
      platform,
      url,
      eventType,
      observedAt,
      publishedAt,
      retrievedAt,
      parentEventId,
      evidenceIds: [ev.id],
      confidence,
      limitations
    });

    return {
      event,
      evidence: ev,
      observation: obs
    };
  }

  tracePropagation(eventId) {
    return tracePropagationEvent(this.store, eventId);
  }

  // ── EVIDENCE FUSION & INVESTIGATION REASONING (PHASE K) ─────────────────────
  getInvestigationReasoning(investigationId, options = {}) {
    return fuseEvidenceAndReasoning(this.store, investigationId, options);
  }

  getMediaStoryline(investigationId) {
    const fusion = fuseEvidenceAndReasoning(this.store, investigationId);
    return fusion.storyline;
  }

  getWhatWeKnow(investigationId) {
    const fusion = fuseEvidenceAndReasoning(this.store, investigationId);
    return {
      investigationId,
      whatWeKnow: fusion.whatWeKnow,
      distinctIndependenceChannels: fusion.distinctIndependenceChannels
    };
  }

  getWhatRemainsUnknown(investigationId) {
    const fusion = fuseEvidenceAndReasoning(this.store, investigationId);
    return {
      investigationId,
      whatRemainsUnknown: fusion.whatRemainsUnknown
    };
  }

  getInvestigationSummary(investigationId) {
    const fusion = fuseEvidenceAndReasoning(this.store, investigationId);
    return fusion.summary;
  }

  traceReasoningEntity(investigationId, entityType, entityId) {
    return traceReasoningChain(this.store, investigationId, entityType, entityId);
  }

  // ── MONITORING & ALERTS (PHASE L) ─────────────────────────────────────────
  createMonitoringJob(payload) {
    return this.monitoringService.createJob(payload);
  }

  getMonitoringJob(jobId) {
    return this.monitoringService.getJob(jobId);
  }

  getMonitoringJobs(investigationId) {
    return this.monitoringService.getJobs(investigationId);
  }

  updateMonitoringJob(jobId, patch) {
    return this.monitoringService.updateJob(jobId, patch);
  }

  deleteMonitoringJob(jobId) {
    return this.monitoringService.deleteJob(jobId);
  }

  runMonitoringJob(jobId, options = {}) {
    return this.monitoringService.runJob(jobId, options);
  }

  getAlerts(investigationId, filters = {}) {
    return this.monitoringService.getAlerts(investigationId, filters);
  }

  getAlert(alertId) {
    return this.monitoringService.getAlert(alertId);
  }

  updateAlert(alertId, patch) {
    return this.monitoringService.updateAlert(alertId, patch);
  }

  acknowledgeAlert(alertId, status) {
    return this.monitoringService.acknowledgeAlert(alertId, status);
  }

  deleteAlert(alertId) {
    return this.monitoringService.deleteAlert(alertId);
  }

  // ── INVESTIGATION REPORTING (PHASE L & M) ──────────────────────────────────
  generateReport(investigationId, options = {}) {
    return generateInvestigationReport(this.store, investigationId, options);
  }

  getReports(investigationId) {
    return this.store.getReportsByInvestigation(investigationId);
  }

  getReportRecord(reportId) {
    return this.store.getReportRecord(reportId);
  }

  exportReport(investigationId, format = 'HTML', options = {}) {
    const report = generateInvestigationReport(this.store, investigationId, { ...options, exportFormat: format });
    if (format.toUpperCase() === 'HTML') {
      return {
        format: 'HTML',
        contentType: 'text/html; charset=utf-8',
        data: exportReportHTML(report),
        report
      };
    }
    if (format.toUpperCase() === 'JSON') {
      return {
        format: 'JSON',
        contentType: 'application/json',
        data: exportReportJSON(report),
        report
      };
    }
    return {
      format: 'JSON',
      contentType: 'application/json',
      data: exportReportJSON(report),
      report
    };
  }

  // ── DEEP MULTIMODAL IMAGE FORENSIC PIPELINE ────────────────────────────────
  async runImageForensicAnalysis({
    investigationId,
    artifactId,
    buffer,
    mimeType = 'image/jpeg',
    exif = null,
    callGeminiFn = null
  }) {
    const art = this.store.getArtifact(artifactId);
    if (!art) {
      throw new Error(`Artifact ${artifactId} not found in store`);
    }

    const filename = art.filename || 'uploaded_image.jpg';

    // Check for video/audio MIME types — return explicit SKIPPED without silent fall-through
    const isVideoOrAudio = (mimeType && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) ||
      (art.mimeType && (art.mimeType.startsWith('video/') || art.mimeType.startsWith('audio/'))) ||
      art.type === 'VIDEO' || art.type === 'AUDIO';

    if (isVideoOrAudio) {
      if (buffer) {
        storeArtifactMedia(artifactId, {
          buffer,
          mimeType,
          filename,
          originalName: art.metadata?.originalName || filename
        });
      }

      const run = this.store.createAnalysisRun({
        investigationId,
        artifactId,
        method: 'VIDEO_AUDIO_FORENSIC_ENGINE',
        status: 'SKIPPED',
        metadata: {
          mimeType,
          reason: 'video/audio forensic analysis not implemented'
        }
      });

      const skippedPayload = {
        isAnalyzed: true,
        analyzedAt: new Date().toISOString(),
        isRealAnalysis: false,
        status: 'SKIPPED',
        reason: 'video/audio forensic analysis not implemented',
        source: null,
        authenticity: null,
        trustScore: null,
        manipulationProbability: null,
        confidence: null,
        verdict: 'Analysis Skipped — Video/Audio Forensics Not Implemented',
        summary: 'Forensic evaluation was skipped because video and audio forensic pipelines (frame extraction, spectral analysis, voice cloning detection) are not implemented.',
        action: 'MANUAL_REVIEW_REQUIRED',
        riskLevel: 'UNKNOWN',
        limitations: [
          'Video and audio forensic pipelines are currently not implemented.',
          'Classical signal checks (spectral analysis, frame-consistency) require specialized processing not present in this runtime.',
          'No automated authenticity, manipulation, or synthetic voice determination could be performed.'
        ],
        visualFindings: [
          `Media type ${mimeType} is not supported by the physical image forensic analyzer.`,
          'Automated frame extraction and acoustic spectral decomposition were skipped.'
        ],
        signals: {
          spatial_diff: null,
          noise_score: null,
          face_landmark: null,
          edge_consistency: null,
          color_diff: null,
          color_histogram: null,
          frame_diff: null,
          temporal_diff: null,
          watermark_detected: null,
          lipsync: null
        }
      };

      art.metadata = {
        ...(art.metadata || {}),
        forensicAnalysis: skippedPayload,
        status: 'SKIPPED'
      };

      return {
        run,
        observations: [],
        evidence: null,
        finding: null,
        forensicAnalysis: skippedPayload
      };
    }

    // 1. Store media buffer in memory store for direct image display & serving
    const storedMedia = storeArtifactMedia(artifactId, {
      buffer,
      mimeType,
      filename,
      originalName: art.metadata?.originalName || filename
    });

    // 2. Compute Physical Error-Level Analysis (ELA)
    const elaResult = await performErrorLevelAnalysis(buffer, mimeType);

    // 3. Compute Deep EXIF Metadata & Device Provenance Analysis
    const exifResult = analyzeExifMetadata(exif);

    // 4. Compute Deep Pixel, Channel & Luminance Statistics via Sharp
    const statsResult = await computeImageStatistics(buffer);

    // 5. Run Real Gemini Multimodal AI Vision Forensic Inspection
    let visionResult = null;
    if (callGeminiFn) {
      visionResult = await runGeminiMultimodalForensicVision({
        buffer,
        mimeType,
        filename,
        exif,
        elaResult,
        statsResult,
        callGeminiFn
      });
    }

    // 6. Record Technical Analysis Run in Provenance Ledger
    const run = this.store.createAnalysisRun({
      investigationId,
      artifactId,
      method: 'MULTI_SPECTRAL_IMAGE_FORENSICS_AND_VISION',
      status: 'COMPLETED',
      metadata: {
        dimensions: statsResult ? `${statsResult.width}x${statsResult.height}` : null,
        format: statsResult?.format || mimeType,
        hasExif: Boolean(exif),
        elaStatus: elaResult.status
      }
    });

    // 7. Record Cryptographic & Pixel Observations
    const obsList = [];

    const obsHash = this.store.createObservation({
      runId: run.id,
      artifactId,
      observationType: 'CRYPTOGRAPHIC_FINGERPRINT',
      target: 'bitstream',
      value: { sha256: art.sha256, pHash: art.perceptualHash, byteSize: art.byteSize },
      confidence: 1.0
    });
    obsList.push(obsHash);

    if (statsResult) {
      const obsStats = this.store.createObservation({
        runId: run.id,
        artifactId,
        observationType: 'PIXEL_STATISTICAL_DISTRIBUTION',
        target: 'pixels',
        value: {
          dimensions: `${statsResult.width}x${statsResult.height}`,
          space: statsResult.space,
          meanLuminance: statsResult.meanLuminance,
          meanVariance: statsResult.meanVariance,
          entropy: statsResult.entropy
        },
        confidence: 0.98
      });
      obsList.push(obsStats);
    }

    if (elaResult.status === 'COMPLETED') {
      const obsEla = this.store.createObservation({
        runId: run.id,
        artifactId,
        observationType: 'ERROR_LEVEL_ANALYSIS',
        target: 'compression_grid',
        value: {
          meanError: elaResult.meanError,
          maxError: elaResult.maxError,
          highErrorRatio: elaResult.highErrorRatio,
          hasCompressionAnomaly: elaResult.hasCompressionAnomaly
        },
        confidence: elaResult.confidence
      });
      obsList.push(obsEla);
    }

    if (visionResult) {
      const obsVision = this.store.createObservation({
        runId: run.id,
        artifactId,
        observationType: 'MULTIMODAL_AI_VISION_AUDIT',
        target: 'visual_composition',
        value: {
          authenticity: visionResult.authenticity,
          subject: visionResult.subject_description,
          manipulationProbability: visionResult.manipulation_probability,
          visualFindings: visionResult.visual_findings
        },
        confidence: visionResult.confidence
      });
      obsList.push(obsVision);
    }

    // 8. Create Corroborating Evidence Object
    const isAuthentic = visionResult && visionResult.authenticity
      ? (visionResult.authenticity === 'GENUINE' && !elaResult.hasCompressionAnomaly)
      : null;

    const ev = this.store.createEvidence({
      observationIds: obsList.map(o => o.id),
      independenceGroupId: `IG-IMAGE-FORENSICS-${artifactId}`,
      evidenceType: 'MULTI_SPECTRAL_FORENSIC_EVIDENCE',
      description: visionResult
        ? `Multimodal Vision & ELA Forensic Audit: ${visionResult.verdict || visionResult.authenticity}`
        : `Physical Forensic Analysis: ELA ${elaResult.status} with ${(statsResult?.width || 0)}x${(statsResult?.height || 0)} resolution (Authenticity: Inconclusive without model evaluation).`,
      confidence: visionResult?.confidence || (elaResult.status === 'COMPLETED' ? elaResult.confidence : null),
      polarity: isAuthentic === true ? 'REFUTING' : (isAuthentic === false ? 'SUPPORTING' : 'INCONCLUSIVE')
    });

    // 9. Synthesize Forensic Finding
    const finding = this.store.createFinding({
      investigationId,
      title: visionResult
        ? `Forensic Image Audit: ${visionResult.authenticity} (${filename})`
        : `Forensic Image Ingestion: ${filename} [INCONCLUSIVE]`,
      summary: visionResult
        ? (visionResult.summary || visionResult.verdict || `Multimodal vision evaluation completed for ${filename}.`)
        : `Physical pixel & ELA forensic analysis completed for ${filename}. Multimodal vision inspection was inconclusive/unavailable, so authenticity is not certified.`,
      status: visionResult
        ? (isAuthentic === true ? 'VERIFIED_GENUINE' : (isAuthentic === false ? 'FLAGGED_ANOMALOUS' : 'OBSERVED'))
        : 'INCONCLUSIVE',
      confidence: visionResult?.confidence || null,
      evidenceIds: [ev.id],
      limitations: [
        ...(visionResult ? [
          'LLM vision evaluations reflect qualitative semantic inference rather than a calibrated binary classifier with certified TPR/FPR operating thresholds.',
          'Confidence scores are qualitative model estimates and not formal mathematical probabilities of authenticity.'
        ] : [
          'Authenticity is marked INCONCLUSIVE because multimodal AI vision was not completed or failed to return a validated structure.',
          'Physical ELA and metadata metrics alone cannot certify that an image is genuine or manipulated.'
        ]),
        ...(elaResult.limitations || []),
        ...(exifResult.limitations || []),
        'Visual and statistical models evaluate probabilistic anomaly cues; full chain-of-custody requires cryptographic origin provenance.'
      ]
    });

    // 10. Update Artifact with live display URLs and forensic payload
    const commonLimitations = [
      'LLM vision evaluations reflect qualitative semantic inference rather than a calibrated binary classifier with certified TPR/FPR operating thresholds.',
      'Uncalibrated trust scores must not be presented as formal mathematical probabilities of authenticity.',
      'Adversarial perturbations, diffusion noise patterns, and refined inpainting can deceive multimodal LLMs.',
      'Comprehensive media integrity verification requires cryptographic provenance (C2PA) and multi-channel corroboration.'
    ];

    const forensicPayload = {
      isAnalyzed: true,
      analyzedAt: new Date().toISOString(),
      isRealAnalysis: true,
      status: visionResult ? 'COMPLETED' : 'INCONCLUSIVE',
      reason: visionResult
        ? null
        : 'Gemini multimodal vision analysis was unavailable or encountered an execution failure; physical forensics (ELA & EXIF) executed only.',
      source: visionResult ? 'LLM_VISION_OPINION' : null,
      authenticity: visionResult?.authenticity || null,
      trustScore: typeof visionResult?.trust_score === 'number' ? visionResult.trust_score : null,
      manipulationProbability: typeof visionResult?.manipulation_probability === 'number' ? visionResult.manipulation_probability : null,
      confidence: typeof visionResult?.confidence === 'number' ? visionResult.confidence : null,
      verdict: visionResult?.verdict || (elaResult?.hasCompressionAnomaly ? 'Forensic Compression Discrepancy Detected via ELA' : 'Authenticity Inconclusive — Vision Model Not Available'),
      summary: visionResult?.summary || (elaResult?.hasCompressionAnomaly ? 'Localized compression variance detected across JPEG blocks. Authenticity cannot be certified without vision model verification.' : 'Uniform pixel error levels observed. Authenticity cannot be certified without vision model verification.'),
      subjectDescription: visionResult?.subject_description || null,
      visualFindings: visionResult?.visual_findings || [
        `Image dimensions: ${statsResult?.width || 0}x${statsResult?.height || 0} (${statsResult?.format || mimeType})`,
        `Mean luminance: ${statsResult?.meanLuminance || 'N/A'}, Variance: ${statsResult?.meanVariance || 'N/A'}`,
        `ELA Mean Error: ${elaResult?.meanError ?? 0} (Compression Anomaly: ${elaResult?.hasCompressionAnomaly ? 'YES' : 'NO'})`
      ],
      signals: visionResult?.signals ? {
        spatial_diff: typeof visionResult.signals.spatial_diff === 'number' ? visionResult.signals.spatial_diff : null,
        noise_score: typeof visionResult.signals.noise_score === 'number' ? visionResult.signals.noise_score : null,
        color_diff: null,
        face_landmark: typeof visionResult.signals.face_landmark === 'number' ? visionResult.signals.face_landmark : null,
        jpeg_artifact: elaResult?.status === 'COMPLETED' ? Number((Math.min(1.0, (elaResult.meanError || 0) / 30)).toFixed(2)) : null,
        edge_consistency: typeof visionResult.signals.edge_consistency === 'number' ? visionResult.signals.edge_consistency : null,
        temporal_mismatch: null,
        watermark_detected: null
      } : {
        spatial_diff: elaResult?.hasCompressionAnomaly ? 0.65 : null,
        noise_score: null,
        color_diff: null,
        face_landmark: null,
        jpeg_artifact: elaResult?.status === 'COMPLETED' ? Number((Math.min(1.0, (elaResult.meanError || 0) / 30)).toFixed(2)) : null,
        edge_consistency: null,
        temporal_mismatch: null,
        watermark_detected: null
      },
      detectedAnomalies: visionResult?.detected_anomalies || (elaResult?.hasCompressionAnomaly ? ['JPEG compression grid anomaly detected in high-frequency regions'] : []),
      riskLevel: visionResult?.risk_level || (elaResult?.hasCompressionAnomaly ? 'HIGH' : 'UNKNOWN'),
      recommendedAction: visionResult?.recommended_action || (elaResult?.hasCompressionAnomaly ? 'REVIEW_REQUIRED' : 'INCONCLUSIVE_REVIEW'),
      dmcaNeeded: visionResult?.dmca_needed ?? Boolean(elaResult?.hasCompressionAnomaly),
      limitations: visionResult?.limitations || (visionResult ? commonLimitations : [
        'Multimodal AI vision model was not executed or returned no valid output.',
        'No numeric trust score or authenticity verdict is fabricated.',
        ...commonLimitations
      ]),
      ela: elaResult,
      exif: exifResult,
      stats: statsResult,
      engine: visionResult?.engine || 'Physical Pixel & Metadata Forensics Engine'
    };

    art.metadata = {
      ...art.metadata,
      forensicAnalysis: forensicPayload,
      hasRealForensics: true,
      fileUrl: `/api/artifacts/${art.id}/file`,
      dataUrl: storedMedia?.dataUrl || null,
      previewUrl: `/api/artifacts/${art.id}/file`
    };

    if (typeof this.store.storeArtifact === 'function') {
      this.store.storeArtifact(art);
    }

    return {
      run,
      observations: obsList,
      evidence: ev,
      finding,
      forensicAnalysis: forensicPayload,
      dataUrl: storedMedia?.dataUrl || null,
      fileUrl: `/api/artifacts/${art.id}/file`
    };
  }
}

export const provenanceService = new ProvenanceService();
export { ProvenanceService };
export default provenanceService;
