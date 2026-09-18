import { EPISTEMIC_STATUSES } from './config.js';
import {
  generateId,
  createObservation,
  createEvidence,
  createFinding,
  createAnalysisRun
} from './models.js';
import { getMethod, getAllMethods } from './methods.js';
import {
  observationsStore,
  evidenceStore,
  findingsStore,
  analysisRunsStore,
  methodsStore
} from './evidence.js';

export {
  observationsStore,
  evidenceStore,
  findingsStore,
  analysisRunsStore,
  methodsStore
};

/**
 * Reset / clear all evidence stores (useful for testing)
 */
export function clearStores() {
  observationsStore.clear();
  evidenceStore.clear();
  findingsStore.clear();
  analysisRunsStore.clear();
}

/**
 * Validate an incoming Observation payload
 */
export function validateAndCreateObservation(data, artifactsStore) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid observation payload: Must be an object.' };
  }

  const { artifactId, type, value, unit = '', description = '', source = 'Local Inspection', methodId = null, analysisRunId = null, status = 'OBSERVED', metadata = {} } = data;

  if (!artifactId || typeof artifactId !== 'string') {
    return { valid: false, error: 'Observation requires a valid string `artifactId`.' };
  }

  if (artifactsStore && !artifactsStore.has(artifactId)) {
    return { valid: false, error: `Referenced artifact '${artifactId}' does not exist.` };
  }

  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Observation requires a non-empty `type` string.' };
  }

  const normalizedStatus = (status || '').toUpperCase();
  if (normalizedStatus !== 'OBSERVED' && normalizedStatus !== 'UNKNOWN') {
    return { valid: false, error: `Invalid observation status '${status}'. Must be 'OBSERVED' or 'UNKNOWN'.` };
  }

  if (methodId && !getMethod(methodId)) {
    return { valid: false, error: `Referenced methodId '${methodId}' is not registered.` };
  }

  if (analysisRunId && !analysisRunsStore.has(analysisRunId)) {
    return { valid: false, error: `Referenced analysisRunId '${analysisRunId}' does not exist.` };
  }

  const obs = createObservation({
    id: data.id || generateId('obs'),
    artifactId,
    type,
    value: normalizedStatus === 'UNKNOWN' ? null : value,
    unit,
    description,
    source,
    methodId,
    analysisRunId,
    status: normalizedStatus,
    metadata
  });

  return { valid: true, observation: obs };
}

/**
 * Validate an incoming Evidence payload
 */
export function validateAndCreateEvidence(data, artifactsStore) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid evidence payload: Must be an object.' };
  }

  const {
    artifactId,
    observationIds = [],
    type,
    evidenceType,
    description = '',
    strength = 1.0,
    independenceGroup = 'primary_inspection',
    status = 'SUPPORTED',
    analysisRunId = null,
    limitations = '',
    metadata = {}
  } = data;

  if (!artifactId || typeof artifactId !== 'string') {
    return { valid: false, error: 'Evidence requires a valid string `artifactId`.' };
  }

  if (artifactsStore && !artifactsStore.has(artifactId)) {
    return { valid: false, error: `Referenced artifact '${artifactId}' does not exist.` };
  }

  if (!Array.isArray(observationIds) || observationIds.length === 0) {
    return { valid: false, error: 'Evidence must reference at least one valid observation in `observationIds`.' };
  }

  for (const obsId of observationIds) {
    if (!observationsStore.has(obsId)) {
      return { valid: false, error: `Referenced observationId '${obsId}' does not exist in observation ledger.` };
    }
  }

  const validStatuses = ['SUPPORTED', 'CONFLICTING', 'INCONCLUSIVE', 'UNKNOWN', 'OBSERVED'];
  const normalizedStatus = (status || '').toUpperCase();
  if (!validStatuses.includes(normalizedStatus)) {
    return { valid: false, error: `Invalid evidence status '${status}'. Must be one of: ${validStatuses.join(', ')}.` };
  }

  if (analysisRunId && !analysisRunsStore.has(analysisRunId)) {
    return { valid: false, error: `Referenced analysisRunId '${analysisRunId}' does not exist.` };
  }

  const evd = createEvidence({
    id: data.id || generateId('evd'),
    artifactId,
    observationIds,
    type: type || evidenceType || 'forensic_evidence',
    description: description || limitations,
    strength: typeof strength === 'number' ? strength : 1.0,
    independenceGroup,
    status: normalizedStatus,
    analysisRunId,
    limitations,
    metadata
  });

  return { valid: true, evidence: evd };
}

/**
 * Validate an incoming Finding payload
 */
export function validateAndCreateFinding(data, artifactsStore) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid finding payload: Must be an object.' };
  }

  const {
    artifactId,
    category,
    statement,
    evidenceIds = [],
    confidence = 1.0,
    epistemicStatus = 'OBSERVED',
    limitations = '',
    metadata = {}
  } = data;

  if (!artifactId || typeof artifactId !== 'string') {
    return { valid: false, error: 'Finding requires a valid string `artifactId`.' };
  }

  if (artifactsStore && !artifactsStore.has(artifactId)) {
    return { valid: false, error: `Referenced artifact '${artifactId}' does not exist.` };
  }

  if (!category || typeof category !== 'string') {
    return { valid: false, error: 'Finding requires a non-empty `category` string.' };
  }

  if (!statement || typeof statement !== 'string') {
    return { valid: false, error: 'Finding requires a non-empty `statement` string.' };
  }

  if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
    return { valid: false, error: 'Finding must reference at least one valid evidence item in `evidenceIds`.' };
  }

  for (const evdId of evidenceIds) {
    if (!evidenceStore.has(evdId)) {
      return { valid: false, error: `Referenced evidenceId '${evdId}' does not exist in evidence ledger.` };
    }
  }

  const validEpistemic = ['OBSERVED', 'INFERRED', 'SUPPORTED', 'CONFLICTING', 'UNKNOWN', 'INCONCLUSIVE'];
  const normalizedStatus = (epistemicStatus || '').toUpperCase();
  if (!validEpistemic.includes(normalizedStatus)) {
    return { valid: false, error: `Invalid finding epistemicStatus '${epistemicStatus}'. Must be one of: ${validEpistemic.join(', ')}.` };
  }

  const fnd = createFinding({
    id: data.id || generateId('fnd'),
    artifactId,
    category,
    statement,
    evidenceIds,
    confidence: typeof confidence === 'number' ? confidence : 1.0,
    epistemicStatus: normalizedStatus,
    limitations,
    metadata
  });

  return { valid: true, finding: fnd };
}

export function recordObservation(obs) {
  observationsStore.set(obs.id, obs);
  return obs;
}

export function recordEvidence(evd) {
  evidenceStore.set(evd.id, evd);
  return evd;
}

export function recordFinding(fnd) {
  findingsStore.set(fnd.id, fnd);
  return fnd;
}

export function recordAnalysisRun(run) {
  analysisRunsStore.set(run.id, run);
  return run;
}

export function getObservationsForArtifact(artifactId) {
  const list = [];
  for (const obs of observationsStore.values()) {
    if (obs.artifactId === artifactId) {
      list.push(obs);
    }
  }
  return list;
}

export function getEvidenceForArtifact(artifactId) {
  const list = [];
  for (const evd of evidenceStore.values()) {
    if (evd.artifactId === artifactId) {
      list.push(evd);
    }
  }
  return list;
}

export function getFindingsForArtifact(artifactId) {
  const list = [];
  for (const fnd of findingsStore.values()) {
    if (fnd.artifactId === artifactId) {
      list.push(fnd);
    }
  }
  return list;
}

export function getAnalysisRunsForArtifact(artifactId) {
  const list = [];
  for (const run of analysisRunsStore.values()) {
    if (run.artifactId === artifactId) {
      list.push(run);
    }
  }
  return list;
}

export function buildTraceabilityChain(findingId, artifactsStore) {
  const finding = findingsStore.get(findingId);
  if (!finding) return null;

  const artifact = artifactsStore ? artifactsStore.get(finding.artifactId) : null;
  const supportingEvidence = [];

  for (const evdId of finding.evidenceIds || []) {
    const evd = evidenceStore.get(evdId);
    if (!evd) continue;

    const underlyingObservations = [];
    for (const obsId of evd.observationIds || []) {
      const obs = observationsStore.get(obsId);
      if (obs) {
        const run = obs.analysisRunId ? analysisRunsStore.get(obs.analysisRunId) : null;
        const method = obs.methodId ? getMethod(obs.methodId) : (run && run.methodId ? getMethod(run.methodId) : null);
        underlyingObservations.push({
          ...obs,
          analysisRun: run || null,
          analysisMethod: method || null
        });
      }
    }

    const run = evd.analysisRunId ? analysisRunsStore.get(evd.analysisRunId) : null;
    const method = run && run.methodId ? getMethod(run.methodId) : null;

    supportingEvidence.push({
      ...evd,
      analysisRun: run || null,
      analysisMethod: method || null,
      observations: underlyingObservations
    });
  }

  return {
    finding,
    artifact: artifact || { id: finding.artifactId },
    supportingEvidence,
    traceabilitySummary: {
      findingId: finding.id,
      category: finding.category,
      epistemicStatus: finding.epistemicStatus,
      confidence: finding.confidence,
      evidenceCount: supportingEvidence.length,
      observationsCount: supportingEvidence.reduce((acc, e) => acc + (e.observations ? e.observations.length : 0), 0)
    }
  };
}

export function processForensicSignalsToEvidence({
  artifact,
  rawSignals = {},
  mode = 'REAL_INVESTIGATION'
}) {
  if (!artifact) {
    throw new Error('Valid MediaArtifact is required to process evidence');
  }

  const createdRuns = [];
  const createdObservations = [];
  const createdEvidence = [];
  const createdFindings = [];

  const recordRun = (run) => { createdRuns.push(run); recordAnalysisRun(run); return run; };
  const recordObs = (obs) => { createdObservations.push(obs); recordObservation(obs); return obs; };
  const recordEvd = (evd) => { createdEvidence.push(evd); recordEvidence(evd); return evd; };
  const recordFnd = (fnd) => { createdFindings.push(fnd); recordFinding(fnd); return fnd; };

  // 1. Media Identity & Cryptographic Run
  const identityRun = recordRun(createAnalysisRun({
    artifactId: artifact.id,
    analysisType: 'MEDIA_IDENTITY_VERIFICATION',
    status: 'COMPLETED',
    methodId: 'method_media_identity_v1',
    inputHash: artifact.sha256,
    resultSummary: `Computed FIPS 180-4 SHA-256 digest: ${artifact.sha256.slice(0, 16)}...`
  }));

  const obsSha = recordObs(createObservation({
    artifactId: artifact.id,
    type: 'cryptographic_hash',
    value: artifact.sha256,
    unit: 'hex_digest',
    description: `FIPS 180-4 SHA-256 binary digest: ${artifact.sha256}`,
    source: 'VeriMedia Cryptographic Vault',
    methodId: 'method_media_identity_v1',
    analysisRunId: identityRun.id,
    status: 'OBSERVED',
    metadata: { algorithm: 'SHA-256', mode }
  }));

  const obsSize = recordObs(createObservation({
    artifactId: artifact.id,
    type: 'binary_byte_length',
    value: artifact.size,
    unit: 'bytes',
    description: `Exact binary payload byte count: ${artifact.size} bytes`,
    source: 'File Ingestion Stream',
    methodId: 'method_media_identity_v1',
    analysisRunId: identityRun.id,
    status: 'OBSERVED',
    metadata: { sizeKb: (artifact.size / 1024).toFixed(2), mode }
  }));

  const evdCrypto = recordEvd(createEvidence({
    artifactId: artifact.id,
    observationIds: [obsSha.id, obsSize.id],
    type: 'cryptographic_identity',
    description: 'Direct byte-level cryptographic signature confirmed.',
    strength: 1.0,
    independenceGroup: 'byte_level_hashing',
    status: 'SUPPORTED',
    analysisRunId: identityRun.id,
    limitations: 'SHA-256 confirms binary bit-for-bit identity; does not detect visual edits that alter bytes.',
    metadata: { mode }
  }));

  recordFnd(createFinding({
    artifactId: artifact.id,
    category: 'MEDIA_IDENTITY',
    statement: `Cryptographic fingerprint established: SHA-256 ${artifact.sha256}.`,
    evidenceIds: [evdCrypto.id],
    confidence: 1.0,
    epistemicStatus: 'OBSERVED',
    limitations: 'Exact binary identity confirmed. Any byte alteration produces a different hash.',
    metadata: { mode }
  }));

  // 2. Container Format & Metadata Run
  const metaRun = recordRun(createAnalysisRun({
    artifactId: artifact.id,
    analysisType: 'CONTAINER_METADATA_EXTRACTION',
    status: 'COMPLETED',
    methodId: 'method_metadata_extract_v1',
    inputHash: artifact.sha256,
    resultSummary: `Extracted container MIME: ${artifact.mimeType}`
  }));

  const obsMime = recordObs(createObservation({
    artifactId: artifact.id,
    type: 'container_mime_validation',
    value: artifact.mimeType,
    unit: 'mime_type',
    description: `Detected container MIME: ${artifact.mimeType}`,
    source: 'Media Header Inspection Engine',
    methodId: 'method_metadata_extract_v1',
    analysisRunId: metaRun.id,
    status: 'OBSERVED',
    metadata: { mode }
  }));

  const containerObsIds = [obsMime.id];

  if (artifact.metadata && artifact.metadata.width && artifact.metadata.height) {
    const obsDim = recordObs(createObservation({
      artifactId: artifact.id,
      type: 'spatial_dimensions',
      value: `${artifact.metadata.width}x${artifact.metadata.height}`,
      unit: 'pixels',
      description: `Spatial frame dimensions: ${artifact.metadata.width}x${artifact.metadata.height}`,
      source: 'Media Header Inspection Engine',
      methodId: 'method_metadata_extract_v1',
      analysisRunId: metaRun.id,
      status: 'OBSERVED',
      metadata: { aspectRatio: artifact.metadata.aspectRatio, mode }
    }));
    containerObsIds.push(obsDim.id);
  }

  if (artifact.metadata && artifact.metadata.duration != null) {
    const obsDur = recordObs(createObservation({
      artifactId: artifact.id,
      type: 'media_duration',
      value: `${artifact.metadata.duration}s`,
      unit: 'seconds',
      description: `Container playback duration: ${artifact.metadata.duration} seconds`,
      source: 'Media Header Inspection Engine',
      methodId: 'method_metadata_extract_v1',
      analysisRunId: metaRun.id,
      status: 'OBSERVED',
      metadata: { mode }
    }));
    containerObsIds.push(obsDur.id);
  }

  if (!artifact.metadata || !artifact.metadata.hasExif) {
    recordObs(createObservation({
      artifactId: artifact.id,
      type: 'exif_camera_metadata',
      value: null,
      description: 'Camera EXIF header tags not present in container.',
      source: 'Media Header Inspection Engine',
      methodId: 'method_metadata_extract_v1',
      analysisRunId: metaRun.id,
      status: 'UNKNOWN',
      metadata: { mode }
    }));
  }

  const evdFormat = recordEvd(createEvidence({
    artifactId: artifact.id,
    observationIds: containerObsIds,
    type: 'container_integrity',
    description: `Validated container structure (${artifact.mimeType}).`,
    strength: 0.95,
    independenceGroup: 'header_inspection',
    status: 'SUPPORTED',
    analysisRunId: metaRun.id,
    limitations: 'Container headers can be re-wrapped or transcoded.',
    metadata: { mode }
  }));

  recordFnd(createFinding({
    artifactId: artifact.id,
    category: 'CONTAINER_FORMAT',
    statement: `Validated media format: ${artifact.mimeType} (${(artifact.size / 1024 / 1024).toFixed(2)} MB)${artifact.metadata && artifact.metadata.width ? ` · ${artifact.metadata.width}x${artifact.metadata.height}` : ''}.`,
    evidenceIds: [evdFormat.id],
    confidence: 0.98,
    epistemicStatus: 'OBSERVED',
    limitations: 'Verified against binary magic byte and chunk structure standards.',
    metadata: { mode }
  }));

  // 3. Perceptual Fingerprint Run
  const pHashRun = recordRun(createAnalysisRun({
    artifactId: artifact.id,
    analysisType: 'PERCEPTUAL_FINGERPRINTING',
    status: 'COMPLETED',
    methodId: 'method_perceptual_fingerprint_v1',
    inputHash: artifact.sha256,
    resultSummary: `Computed perceptual hash: ${artifact.perceptualHash}`
  }));

  const obsPhash = recordObs(createObservation({
    artifactId: artifact.id,
    type: 'perceptual_hash',
    value: artifact.perceptualHash,
    unit: 'hex_hash',
    description: `Multi-scale 64-bit spatial fingerprint: ${artifact.perceptualHash}`,
    source: 'Perceptual Invariant Engine',
    methodId: 'method_perceptual_fingerprint_v1',
    analysisRunId: pHashRun.id,
    status: 'OBSERVED',
    metadata: { mode }
  }));

  const evdPhash = recordEvd(createEvidence({
    artifactId: artifact.id,
    observationIds: [obsPhash.id],
    type: 'perceptual_invariant',
    description: 'Perceptual fingerprint established for visual matching.',
    strength: 0.92,
    independenceGroup: 'perceptual_distance',
    status: 'SUPPORTED',
    analysisRunId: pHashRun.id,
    limitations: 'Perceptual hashing resists modest re-encoding but can diverge under extreme cropping or warping.',
    metadata: { mode }
  }));

  recordFnd(createFinding({
    artifactId: artifact.id,
    category: 'PERCEPTUAL_IDENTITY',
    statement: `Perceptual fingerprint established (${artifact.perceptualHash}).`,
    evidenceIds: [evdPhash.id],
    confidence: 0.92,
    epistemicStatus: 'OBSERVED',
    limitations: 'Enables invariant perceptual matching across compression transformations.',
    metadata: { mode }
  }));

  // 4. Adapt Specialized Forensic Signals
  const {
    jpegArtifacts,
    faceLandmarks,
    frameConsistency
  } = rawSignals;

  if (jpegArtifacts !== undefined && jpegArtifacts !== null) {
    const jpegRun = recordRun(createAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'JPEG_COMPRESSION_ANALYSIS',
      status: 'COMPLETED',
      methodId: 'method_jpeg_artifact_v1',
      inputHash: artifact.sha256,
      resultSummary: `Measured localized quantization variance: ${jpegArtifacts}`
    }));

    const hasAnomaly = typeof jpegArtifacts === 'number' ? jpegArtifacts > 0.45 : false;
    const obsJpeg = recordObs(createObservation({
      artifactId: artifact.id,
      type: 'jpeg_compression_quantization',
      value: jpegArtifacts,
      unit: 'inconsistency_score',
      description: hasAnomaly
        ? 'Measured compression characteristics differ between analyzed spatial regions.'
        : 'DCT compression quantization grid is uniform across analyzed regions.',
      source: 'Discrete Cosine Transform Inspection Engine',
      methodId: 'method_jpeg_artifact_v1',
      analysisRunId: jpegRun.id,
      status: 'OBSERVED',
      metadata: { score: jpegArtifacts, mode }
    }));

    const evdJpeg = recordEvd(createEvidence({
      artifactId: artifact.id,
      observationIds: [obsJpeg.id],
      type: 'compression_forensics',
      description: hasAnomaly ? 'Localized compression block inconsistency observed.' : 'Uniform compression characteristics confirmed.',
      strength: 0.72,
      independenceGroup: 'compression_domain',
      status: hasAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      analysisRunId: jpegRun.id,
      limitations: 'Ordinary platform recompression or multi-generational encoding can produce similar block variations.',
      metadata: { mode }
    }));

    recordFnd(createFinding({
      artifactId: artifact.id,
      category: 'COMPRESSION_ANALYSIS',
      statement: hasAnomaly
        ? 'Possible localized recompression or multi-generation encoding detected.'
        : 'Compression block structures are consistent across spatial regions.',
      evidenceIds: [evdJpeg.id],
      confidence: 0.71,
      epistemicStatus: hasAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      limitations: 'Compression characteristics alone do not constitute absolute proof of malicious editing.',
      metadata: { mode }
    }));
  }

  if (frameConsistency !== undefined && frameConsistency !== null) {
    const frameRun = recordRun(createAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'TEMPORAL_CADENCE_ANALYSIS',
      status: 'COMPLETED',
      methodId: 'method_frame_consistency_v1',
      inputHash: artifact.sha256,
      resultSummary: `Temporal continuity metric: ${frameConsistency}`
    }));

    const hasTemporalAnomaly = typeof frameConsistency === 'number' ? frameConsistency < 0.65 : false;
    const obsFrame = recordObs(createObservation({
      artifactId: artifact.id,
      type: 'temporal_motion_vectors',
      value: frameConsistency,
      unit: 'continuity_index',
      description: hasTemporalAnomaly
        ? 'Discontinuous optical flow vectors detected across sequential video frames.'
        : 'Smooth optical flow and motion continuity confirmed across temporal frames.',
      source: 'Temporal Continuity Engine',
      methodId: 'method_frame_consistency_v1',
      analysisRunId: frameRun.id,
      status: 'OBSERVED',
      metadata: { score: frameConsistency, mode }
    }));

    const evdFrame = recordEvd(createEvidence({
      artifactId: artifact.id,
      observationIds: [obsFrame.id],
      type: 'temporal_forensics',
      description: hasTemporalAnomaly ? 'Inter-frame motion discontinuity identified.' : 'Temporal motion continuity validated.',
      strength: 0.78,
      independenceGroup: 'temporal_domain',
      status: hasTemporalAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      analysisRunId: frameRun.id,
      limitations: 'Variable framerate encoding or dropped network packets during capture can introduce motion discontinuities.',
      metadata: { mode }
    }));

    recordFnd(createFinding({
      artifactId: artifact.id,
      category: 'TEMPORAL_ANALYSIS',
      statement: hasTemporalAnomaly
        ? 'Inter-frame motion anomaly detected; may indicate splice or frame omission.'
        : 'Inter-frame temporal motion cadence is consistent.',
      evidenceIds: [evdFrame.id],
      confidence: 0.75,
      epistemicStatus: hasTemporalAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      limitations: 'Frame drops or VFR capture may simulate temporal anomalies.',
      metadata: { mode }
    }));
  }

  if (faceLandmarks !== undefined && faceLandmarks !== null) {
    const faceRun = recordRun(createAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'FACIAL_LANDMARK_INSPECTION',
      status: 'COMPLETED',
      methodId: 'method_face_landmarks_v1',
      inputHash: artifact.sha256,
      resultSummary: `Biometric boundary score: ${faceLandmarks}`
    }));

    const hasFaceAnomaly = typeof faceLandmarks === 'number' ? faceLandmarks < 0.60 : false;
    const obsFace = recordObs(createObservation({
      artifactId: artifact.id,
      type: 'facial_boundary_alignment',
      value: faceLandmarks,
      unit: 'alignment_score',
      description: hasFaceAnomaly
        ? 'Sub-pixel blending artifacts detected around facial boundary contours.'
        : 'Facial landmarks match expected anatomical and pose geometry.',
      source: 'Biometric Integrity Engine',
      methodId: 'method_face_landmarks_v1',
      analysisRunId: faceRun.id,
      status: 'OBSERVED',
      metadata: { score: faceLandmarks, mode }
    }));

    const evdFace = recordEvd(createEvidence({
      artifactId: artifact.id,
      observationIds: [obsFace.id],
      type: 'biometric_forensics',
      description: hasFaceAnomaly ? 'Facial boundary contour inconsistency.' : 'Facial geometry aligned with head pose.',
      strength: 0.82,
      independenceGroup: 'biometric_domain',
      status: hasFaceAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      analysisRunId: faceRun.id,
      limitations: 'Low video resolution or dynamic lighting transitions can degrade boundary alignment precision.',
      metadata: { mode }
    }));

    recordFnd(createFinding({
      artifactId: artifact.id,
      category: 'BIOMETRIC_ANALYSIS',
      statement: hasFaceAnomaly
        ? 'Facial boundary anomaly detected; warrants review for synthetic blending or face swapping.'
        : 'Facial anatomical landmarks are geometrically consistent.',
      evidenceIds: [evdFace.id],
      confidence: 0.79,
      epistemicStatus: hasFaceAnomaly ? 'INCONCLUSIVE' : 'SUPPORTED',
      limitations: 'Extreme camera angles or compression artifacts can affect facial contour analysis.',
      metadata: { mode }
    }));
  }

  return {
    runs: createdRuns,
    observations: createdObservations,
    evidence: createdEvidence,
    findings: createdFindings
  };
}
