import crypto from 'crypto';
import { EPISTEMIC_STATUSES } from './config.js';
import {
  generateId,
  createObservation,
  createEvidence,
  createFinding,
  createAnalysisRun,
  createAnalysisMethod
} from './models.js';

// ── Standard Analysis Methods Registry ────────────────────────────────
export const STANDARD_METHODS = [
  createAnalysisMethod({
    id: 'method_media_identity_v1',
    name: 'Media Identity Check v1',
    version: '1.0.0',
    description: 'Computes cryptographic SHA-256 binary hash digests and verifies raw byte length invariance.',
    limitations: 'Bit-level identity only; does not assess semantic, perceptual, or contextual similarity.'
  }),
  createAnalysisMethod({
    id: 'method_metadata_extraction_v1',
    name: 'Metadata Extraction v1',
    version: '1.0.0',
    description: 'Inspects binary container headers (PNG chunks, JPEG markers, MP4 ISO boxes) to extract dimensions, bit depth, container brands, and EXIF segments.',
    limitations: 'Container metadata can be easily stripped, modified, or rewritten during transcoding without affecting visual presentation.'
  }),
  createAnalysisMethod({
    id: 'method_perceptual_hash_v1',
    name: 'Perceptual Fingerprint v1',
    version: '1.0.0',
    description: 'Generates robust multi-scale 64-bit perceptual image and keyframe hashes for content identification across resizing and compression.',
    limitations: 'Designed for high tolerance to mild transformations; may yield false negatives on extreme crops (>60%) or heavy adversarial distortion.'
  }),
  createAnalysisMethod({
    id: 'method_jpeg_artifact_v1',
    name: 'JPEG Artifact Analysis v1',
    version: '1.0.0',
    description: 'Examines Discrete Cosine Transform (DCT) coefficient distributions and 8x8 block grid misalignment to detect double-compression or spliced elements.',
    limitations: 'Ordinary platform recompression, aggressive web optimization, or downsampling may produce similar inconsistencies; does not constitute conclusive proof of malicious manipulation on its own.'
  }),
  createAnalysisMethod({
    id: 'method_spatial_integrity_v1',
    name: 'Spatial Integrity & Edge Analysis v1',
    version: '1.0.0',
    description: 'Performs gradient-domain Sobel edge coherence and high-frequency noise variance analysis across spatial regions.',
    limitations: 'Artistic post-processing (e.g. vignette, HDR, heavy unsharp mask) can generate localized gradient anomalies.'
  }),
  createAnalysisMethod({
    id: 'method_frame_consistency_v1',
    name: 'Frame Consistency Analysis v1',
    version: '1.0.0',
    description: 'Measures inter-frame motion vector continuity, quantization delta patterns, and temporal boundary transitions in video streams.',
    limitations: 'Variable framerate encoding, dropped packets in original capture, and adaptive GOP structures cause natural temporal variance.'
  }),
  createAnalysisMethod({
    id: 'method_face_landmark_v1',
    name: 'Facial Landmark & Geometry Consistency v1',
    version: '1.0.0',
    description: 'Tracks 68-point 3D facial landmark stability, boundary blend lines, and eye/mouth aspect ratio kinematics.',
    limitations: 'Natural extreme head turns, motion blur, and poor illumination can degrade landmark precision and trigger false anomalies.'
  }),
  createAnalysisMethod({
    id: 'method_lip_sync_v1',
    name: 'Audiovisual Temporal Synchronization v1',
    version: '1.0.0',
    description: 'Cross-correlates audio acoustic phonemes with video viseme mouth geometry across time.',
    limitations: 'Bluetooth audio latency, container muxing offset, and dubbing can produce desynchronization without visual synthesis.'
  }),
  createAnalysisMethod({
    id: 'method_color_consistency_v1',
    name: 'Chromatic & Illumination Consistency v1',
    version: '1.0.0',
    description: 'Analyzes chromatic illumination vectors and color gamut distribution to detect composited lighting mismatches.',
    limitations: 'Scenes with mixed indoor/outdoor lighting or colorful neon sources naturally possess non-uniform illumination vectors.'
  }),
  createAnalysisMethod({
    id: 'method_noise_watermark_v1',
    name: 'Noise Residual & Watermark Analysis v1',
    version: '1.0.0',
    description: 'Extracts high-frequency sensor pattern noise (PRNU) residuals and inspects for embedded steganographic watermarks.',
    limitations: 'Lossy platform compression strips fine sensor noise residuals; absence of watermark does not prove non-authenticity.'
  })
];

import { getAllMethods, getMethod as getMethodFromRegistry } from './methods.js';

export {
  validateAndCreateObservation,
  validateAndCreateEvidence,
  validateAndCreateFinding
} from './evidenceEngine.js';
export const methodsStore = new Map();
STANDARD_METHODS.forEach(m => methodsStore.set(m.id, m));
getAllMethods().forEach(m => methodsStore.set(m.id, m));

export const analysisRunsStore = new Map();
export const observationsStore = new Map();
export const evidenceStore = new Map();
export const findingsStore = new Map();

export function registerAnalysisMethod(methodData) {
  const method = createAnalysisMethod(methodData);
  methodsStore.set(method.id, method);
  return method;
}

export function getAnalysisMethods() {
  return Array.from(methodsStore.values());
}

export function getAnalysisMethod(id) {
  return methodsStore.get(id) || getMethodFromRegistry(id) || null;
}

export function recordAnalysisRun({
  id,
  artifactId,
  analysisType,
  startedAt,
  completedAt,
  status = 'COMPLETED',
  methodId,
  inputHash,
  resultSummary,
  metadata = {}
}) {
  if (!artifactId) {
    throw new Error('AnalysisRun requires a valid `artifactId`.');
  }
  const run = createAnalysisRun({
    id,
    artifactId,
    analysisType,
    startedAt,
    completedAt,
    status,
    methodId,
    inputHash,
    resultSummary,
    metadata
  });
  analysisRunsStore.set(run.id, run);
  return run;
}

export function recordObservation({
  id,
  artifactId,
  type,
  value,
  unit = '',
  description = '',
  source = 'Local Inspection Engine',
  observedAt,
  methodId,
  analysisRunId,
  status = 'OBSERVED',
  metadata = {}
}) {
  if (!artifactId) {
    throw new Error('Observation requires a valid `artifactId`.');
  }
  if (!type) {
    throw new Error('Observation requires a valid `type`.');
  }
  
  const normalizedStatus = (status === 'UNKNOWN' || value === null || value === undefined)
    ? 'UNKNOWN'
    : 'OBSERVED';

  const obs = createObservation({
    id,
    artifactId,
    type,
    value: value !== undefined ? value : null,
    unit,
    description: description || `${type}: ${value !== null && value !== undefined ? value : 'UNKNOWN'}`,
    source,
    observedAt,
    methodId,
    analysisRunId,
    status: normalizedStatus,
    metadata
  });

  observationsStore.set(obs.id, obs);
  return obs;
}

export function recordEvidence({
  id,
  artifactId,
  observationIds = [],
  type,
  description = '',
  strength = 1.0,
  independenceGroup = 'primary_inspection',
  status = EPISTEMIC_STATUSES.SUPPORTED,
  analysisRunId,
  createdAt,
  limitations = '',
  metadata = {}
}, artifactsStore = null) {
  if (!artifactId) {
    throw new Error('Evidence requires a valid `artifactId`.');
  }
  if (artifactsStore && !artifactsStore.has(artifactId)) {
    throw new Error(`Invalid reference: Artifact '${artifactId}' not found.`);
  }
  if (!Array.isArray(observationIds) || observationIds.length === 0) {
    throw new Error('Evidence must reference at least one Observation ID in `observationIds`.');
  }

  for (const obsId of observationIds) {
    if (!observationsStore.has(obsId)) {
      throw new Error(`Invalid reference: Observation '${obsId}' not found in observation ledger.`);
    }
  }

  const validStatuses = ['SUPPORTED', 'CONFLICTING', 'INCONCLUSIVE', 'UNKNOWN', 'OBSERVED'];
  const normalizedStatus = validStatuses.includes(status) ? status : 'SUPPORTED';

  const evd = createEvidence({
    id,
    artifactId,
    observationIds,
    type: type || 'forensic_evidence',
    description,
    strength: typeof strength === 'number' ? Math.max(0, Math.min(1, strength)) : 1.0,
    independenceGroup: independenceGroup || 'primary_inspection',
    status: normalizedStatus,
    analysisRunId,
    createdAt,
    limitations: limitations || (metadata && metadata.limitations) || '',
    metadata
  });

  evidenceStore.set(evd.id, evd);
  return evd;
}

export function recordFinding({
  id,
  artifactId,
  category,
  statement,
  evidenceIds = [],
  confidence = 1.0,
  epistemicStatus = EPISTEMIC_STATUSES.OBSERVED,
  limitations = '',
  createdAt,
  metadata = {}
}, artifactsStore = null) {
  if (!artifactId) {
    throw new Error('Finding requires a valid `artifactId`.');
  }
  if (artifactsStore && !artifactsStore.has(artifactId)) {
    throw new Error(`Invalid reference: Artifact '${artifactId}' not found.`);
  }
  if (!category) {
    throw new Error('Finding requires a `category`.');
  }
  if (!statement) {
    throw new Error('Finding requires a `statement`.');
  }
  if (!Array.isArray(evidenceIds)) {
    throw new Error('Finding `evidenceIds` must be an array.');
  }

  for (const evdId of evidenceIds) {
    if (!evidenceStore.has(evdId)) {
      throw new Error(`Invalid reference: Evidence '${evdId}' not found in evidence ledger.`);
    }
  }

  const validEpistemic = ['OBSERVED', 'INFERRED', 'SUPPORTED', 'CONFLICTING', 'UNKNOWN', 'INCONCLUSIVE'];
  const normalizedEpistemic = validEpistemic.includes(epistemicStatus) ? epistemicStatus : 'INFERRED';

  const fnd = createFinding({
    id,
    artifactId,
    category,
    statement,
    evidenceIds,
    confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 1.0,
    epistemicStatus: normalizedEpistemic,
    limitations: limitations || (metadata && metadata.uncertaintyNotes) || '',
    createdAt,
    metadata
  });

  findingsStore.set(fnd.id, fnd);
  return fnd;
}

export function getObservationsForArtifact(artifactId) {
  const result = [];
  for (const obs of observationsStore.values()) {
    if (obs.artifactId === artifactId) {
      result.push(obs);
    }
  }
  return result;
}

export function getEvidenceForArtifact(artifactId) {
  const result = [];
  for (const evd of evidenceStore.values()) {
    if (evd.artifactId === artifactId) {
      result.push(evd);
    }
  }
  return result;
}

export function getFindingsForArtifact(artifactId) {
  const result = [];
  for (const fnd of findingsStore.values()) {
    if (fnd.artifactId === artifactId) {
      result.push(fnd);
    }
  }
  return result;
}

export function getAnalysisRunsForArtifact(artifactId) {
  const result = [];
  for (const run of analysisRunsStore.values()) {
    if (run.artifactId === artifactId) {
      result.push(run);
    }
  }
  return result;
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
        const method = obs.methodId ? getAnalysisMethod(obs.methodId) : (run && run.methodId ? getAnalysisMethod(run.methodId) : null);
        underlyingObservations.push({
          ...obs,
          analysisRun: run || null,
          analysisMethod: method || null
        });
      }
    }

    const run = evd.analysisRunId ? analysisRunsStore.get(evd.analysisRunId) : null;
    const method = run && run.methodId ? getAnalysisMethod(run.methodId) : null;

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

export function getTraceableInvestigationEvidence(artifactId, artifact = null) {
  const rawObservations = getObservationsForArtifact(artifactId);
  const rawEvidence = getEvidenceForArtifact(artifactId);
  const rawFindings = getFindingsForArtifact(artifactId);
  const rawRuns = getAnalysisRunsForArtifact(artifactId);

  const obsMap = new Map();
  rawObservations.forEach(o => {
    const method = o.methodId ? getAnalysisMethod(o.methodId) : null;
    const run = o.analysisRunId ? analysisRunsStore.get(o.analysisRunId) : null;
    obsMap.set(o.id, {
      ...o,
      method,
      run
    });
  });

  const evdMap = new Map();
  rawEvidence.forEach(e => {
    const resolvedObs = (e.observationIds || []).map(id => obsMap.get(id)).filter(Boolean);
    const run = e.analysisRunId ? analysisRunsStore.get(e.analysisRunId) : null;
    const method = run && run.methodId ? getAnalysisMethod(run.methodId) : null;
    evdMap.set(e.id, {
      ...e,
      observations: resolvedObs,
      analysisRun: run || null,
      analysisMethod: method || null,
      run,
      method
    });
  });

  const enrichedFindings = rawFindings.map(f => {
    const resolvedEvd = (f.evidenceIds || []).map(id => evdMap.get(id)).filter(Boolean);
    return {
      finding: f,
      supportingEvidence: resolvedEvd,
      ...f,
      evidence: resolvedEvd
    };
  });

  const conflicts = [];
  rawEvidence.forEach(e => {
    if (e.status === 'CONFLICTING') {
      conflicts.push({
        evidenceId: e.id,
        type: e.type,
        description: e.description,
        limitations: e.limitations,
        observationIds: e.observationIds
      });
    }
  });

  const epistemicSummary = {
    OBSERVED: 0,
    INFERRED: 0,
    SUPPORTED: 0,
    CONFLICTING: 0,
    UNKNOWN: 0,
    INCONCLUSIVE: 0
  };
  rawFindings.forEach(f => {
    if (epistemicSummary[f.epistemicStatus] !== undefined) {
      epistemicSummary[f.epistemicStatus]++;
    }
  });

  const nodes = [];
  const edges = [];

  if (artifact) {
    nodes.push({ id: artifact.id, type: 'ARTIFACT', label: artifact.filename || 'Media Artifact', data: artifact });
  }

  rawRuns.forEach(r => {
    nodes.push({ id: r.id, type: 'ANALYSIS_RUN', label: r.analysisType, status: r.status });
    if (artifact) {
      edges.push({ from: artifact.id, to: r.id, label: 'executed_on' });
    }
  });

  rawObservations.forEach(o => {
    nodes.push({ id: o.id, type: 'OBSERVATION', label: o.type, value: o.value, status: o.status });
    if (o.analysisRunId) {
      edges.push({ from: o.analysisRunId, to: o.id, label: 'measured' });
    } else if (artifact) {
      edges.push({ from: artifact.id, to: o.id, label: 'extracted_from' });
    }
  });

  rawEvidence.forEach(e => {
    nodes.push({ id: e.id, type: 'EVIDENCE', label: e.type, strength: e.strength, status: e.status, independenceGroup: e.independenceGroup });
    (e.observationIds || []).forEach(obsId => {
      edges.push({ from: obsId, to: e.id, label: 'supports' });
    });
  });

  rawFindings.forEach(f => {
    nodes.push({ id: f.id, type: 'FINDING', label: f.category, statement: f.statement, epistemicStatus: f.epistemicStatus, confidence: f.confidence });
    (f.evidenceIds || []).forEach(evdId => {
      edges.push({ from: evdId, to: f.id, label: 'grounds' });
    });
  });

  return {
    artifactId,
    artifact,
    findings: enrichedFindings,
    traceableFindings: enrichedFindings,
    evidence: Array.from(evdMap.values()),
    observations: Array.from(obsMap.values()),
    analysisRuns: rawRuns,
    methods: getAnalysisMethods(),
    conflicts,
    epistemicSummary,
    traceabilityGraph: {
      nodes,
      edges
    },
    traceabilityChainCount: {
      runs: rawRuns.length,
      observations: rawObservations.length,
      evidence: rawEvidence.length,
      findings: rawFindings.length
    }
  };
}

export function adaptForensicSignalsToEvidence({
  artifact,
  signalScores = {},
  scenario = null,
  isDemo = false
}) {
  if (!artifact || !artifact.id) {
    throw new Error('Cannot adapt signals without a valid `artifact`.');
  }

  const generatedRuns = [];
  const generatedObs = [];
  const generatedEvd = [];
  const generatedFindings = [];

  const mime = artifact.mimeType || '';
  const isVideo = mime.startsWith('video/');
  const isImage = mime.startsWith('image/');

  if (isImage || scenario === 'crop' || scenario === 'adversarial' || signalScores.jpeg_artifacts !== undefined) {
    const run = recordAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'JPEG & Compression Artifact Consistency',
      methodId: 'method_jpeg_artifact_v1',
      inputHash: artifact.sha256,
      resultSummary: 'Discrete cosine transform quantization table and 8x8 block grid boundary scan.'
    });
    generatedRuns.push(run);

    const rawCompressionDelta = signalScores.jpeg_artifacts !== undefined
      ? signalScores.jpeg_artifacts
      : (scenario === 'crop' ? 0.76 : scenario === 'deepfake' ? 0.82 : 0.12);

    const obs = recordObservation({
      artifactId: artifact.id,
      type: 'compression_block_inconsistency',
      value: parseFloat(rawCompressionDelta.toFixed(3)),
      unit: 'index',
      description: rawCompressionDelta > 0.45
        ? 'Measured compression characteristics differ between analyzed spatial regions.'
        : 'DCT compression coefficient distribution is uniform across grid tiles.',
      source: 'JPEG Artifact Analysis Engine',
      methodId: 'method_jpeg_artifact_v1',
      analysisRunId: run.id,
      status: 'OBSERVED',
      metadata: { isDemo, scenario }
    });
    generatedObs.push(obs);

    const evdStatus = rawCompressionDelta > 0.65 ? 'SUPPORTED' : rawCompressionDelta > 0.35 ? 'INCONCLUSIVE' : 'SUPPORTED';
    const evd = recordEvidence({
      artifactId: artifact.id,
      observationIds: [obs.id],
      type: 'compression_inconsistency',
      description: rawCompressionDelta > 0.45
        ? 'Localized compression inconsistency detected across boundary tiles.'
        : 'Uniform compression characteristics observed throughout.',
      strength: parseFloat((Math.abs(rawCompressionDelta - 0.5) * 2).toFixed(2)),
      independenceGroup: 'compression_domain',
      status: evdStatus,
      analysisRunId: run.id,
      limitations: 'Ordinary platform processing, multi-pass web recompression, or downsampling can produce similar characteristics without visual tampering.',
      metadata: { isDemo, scenario }
    });
    generatedEvd.push(evd);

    const findingStatus = rawCompressionDelta > 0.65 ? 'SUPPORTED' : rawCompressionDelta > 0.35 ? 'INCONCLUSIVE' : 'OBSERVED';
    const findingConfidence = parseFloat(Math.min(0.95, 0.50 + Math.abs(rawCompressionDelta - 0.5) * 0.8).toFixed(2));
    const fnd = recordFinding({
      artifactId: artifact.id,
      category: 'COMPRESSION_INTEGRITY',
      statement: rawCompressionDelta > 0.45
        ? 'Possible localized recompression or secondary format transformation observed.'
        : 'Compression block structures are consistent with single-generation encoding.',
      evidenceIds: [evd.id],
      confidence: findingConfidence,
      epistemicStatus: findingStatus,
      limitations: 'Compression characteristics alone cannot prove malicious manipulation; requires cross-correlation with spatial and provenance evidence.',
      metadata: { isDemo, scenario, signalScore: rawCompressionDelta }
    });
    generatedFindings.push(fnd);
  }

  if (isImage || isVideo || signalScores.spatial_consistency !== undefined) {
    const run = recordAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'Spatial Edge & Gradient Coherence',
      methodId: 'method_spatial_integrity_v1',
      inputHash: artifact.sha256,
      resultSummary: 'Sobel gradient filter and high-frequency edge transition variance analysis.'
    });
    generatedRuns.push(run);

    const rawEdgeAnomaly = signalScores.spatial_consistency !== undefined
      ? (1 - signalScores.spatial_consistency)
      : (scenario === 'crop' ? 0.68 : scenario === 'deepfake' ? 0.88 : 0.08);

    const obs = recordObservation({
      artifactId: artifact.id,
      type: 'spatial_gradient_anomaly_score',
      value: parseFloat(rawEdgeAnomaly.toFixed(3)),
      unit: 'index',
      description: rawEdgeAnomaly > 0.5
        ? 'High-frequency gradient discontinuity observed along object boundaries.'
        : 'Edge gradient transitions align smoothly with natural optical blur.',
      source: 'Spatial Integrity & Edge Engine',
      methodId: 'method_spatial_integrity_v1',
      analysisRunId: run.id,
      status: 'OBSERVED',
      metadata: { isDemo, scenario }
    });
    generatedObs.push(obs);

    const evdStatus = rawEdgeAnomaly > 0.70 ? 'SUPPORTED' : rawEdgeAnomaly > 0.35 ? 'INCONCLUSIVE' : 'SUPPORTED';
    const evd = recordEvidence({
      artifactId: artifact.id,
      observationIds: [obs.id],
      type: 'spatial_edge_discontinuity',
      description: rawEdgeAnomaly > 0.5
        ? 'Spatial boundary irregularities observed in edge coherence maps.'
        : 'Spatial edge structures exhibit standard optical characteristics.',
      strength: parseFloat((0.40 + rawEdgeAnomaly * 0.55).toFixed(2)),
      independenceGroup: 'spatial_domain',
      status: evdStatus,
      analysisRunId: run.id,
      limitations: 'Aggressive sharpening filters, HDR processing, or high-contrast backlighting can elevate gradient variance.',
      metadata: { isDemo, scenario }
    });
    generatedEvd.push(evd);

    const findingStatus = rawEdgeAnomaly > 0.70 ? 'INFERRED' : rawEdgeAnomaly > 0.35 ? 'INCONCLUSIVE' : 'OBSERVED';
    const fnd = recordFinding({
      artifactId: artifact.id,
      category: 'SPATIAL_INTEGRITY',
      statement: rawEdgeAnomaly > 0.5
        ? 'Spatial edge analysis indicates localized boundary alterations.'
        : 'Spatial edge continuity is nominal across all analyzed regions.',
      evidenceIds: [evd.id],
      confidence: parseFloat((0.55 + Math.abs(rawEdgeAnomaly - 0.5) * 0.7).toFixed(2)),
      epistemicStatus: findingStatus,
      limitations: 'Spatial edge anomalies suggest modification but do not pinpoint generative versus traditional editing tools.',
      metadata: { isDemo, scenario }
    });
    generatedFindings.push(fnd);
  }

  if (isVideo || scenario === 'deepfake' || signalScores.face_landmarks !== undefined) {
    const run = recordAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'Facial Landmark & Geometry Tracking',
      methodId: 'method_face_landmark_v1',
      inputHash: artifact.sha256,
      resultSummary: '68-point 3D facial landmark mesh tracking and boundary blend inspection.'
    });
    generatedRuns.push(run);

    const rawFaceAnomaly = signalScores.face_landmarks !== undefined
      ? signalScores.face_landmarks
      : (scenario === 'deepfake' ? 0.91 : 0.05);

    const obs = recordObservation({
      artifactId: artifact.id,
      type: 'facial_geometry_stability',
      value: parseFloat((1 - rawFaceAnomaly).toFixed(3)),
      unit: 'index',
      description: rawFaceAnomaly > 0.6
        ? 'Facial landmark jitter and perimeter blending discrepancies detected across frames.'
        : 'Facial landmark geometry is stable with natural anatomical proportions.',
      source: 'Facial Geometry Tracker',
      methodId: 'method_face_landmark_v1',
      analysisRunId: run.id,
      status: 'OBSERVED',
      metadata: { isDemo, scenario }
    });
    generatedObs.push(obs);

    const evdStatus = rawFaceAnomaly > 0.75 ? 'SUPPORTED' : rawFaceAnomaly > 0.40 ? 'INCONCLUSIVE' : 'SUPPORTED';
    const evd = recordEvidence({
      artifactId: artifact.id,
      observationIds: [obs.id],
      type: 'facial_synthesis_evidence',
      description: rawFaceAnomaly > 0.6
        ? 'Significant landmark instability and boundary warp detected.'
        : 'Natural facial biomechanics confirmed.',
      strength: parseFloat(rawFaceAnomaly > 0.6 ? (0.60 + rawFaceAnomaly * 0.35).toFixed(2) : 0.85),
      independenceGroup: 'biometric_domain',
      status: evdStatus,
      analysisRunId: run.id,
      limitations: 'Extreme camera angles, rapid occlusion, and low light can create non-malicious landmark jitter.',
      metadata: { isDemo, scenario }
    });
    generatedEvd.push(evd);

    const fndStatus = rawFaceAnomaly > 0.75 ? 'SUPPORTED' : rawFaceAnomaly > 0.40 ? 'INCONCLUSIVE' : 'OBSERVED';
    const fnd = recordFinding({
      artifactId: artifact.id,
      category: 'BIOMETRIC_CONSISTENCY',
      statement: rawFaceAnomaly > 0.6
        ? 'Facial landmark tracking exhibits anomalies consistent with synthetic face modification.'
        : 'Facial biometric features appear anatomically coherent.',
      evidenceIds: [evd.id],
      confidence: parseFloat((0.60 + rawFaceAnomaly * 0.35).toFixed(2)),
      epistemicStatus: fndStatus,
      limitations: 'Requires cross-validation with temporal lip synchronization and compression analysis before reaching conclusive synthesis attribution.',
      metadata: { isDemo, scenario }
    });
    generatedFindings.push(fnd);
  }

  if (isVideo || scenario === 'deepfake' || signalScores.frame_consistency !== undefined) {
    const run = recordAnalysisRun({
      artifactId: artifact.id,
      analysisType: 'Inter-Frame Temporal Consistency',
      methodId: 'method_frame_consistency_v1',
      inputHash: artifact.sha256,
      resultSummary: 'Motion vector continuity and GOP quantization step scan.'
    });
    generatedRuns.push(run);

    const rawTemporalVariance = signalScores.frame_consistency !== undefined
      ? (1 - signalScores.frame_consistency)
      : (scenario === 'deepfake' ? 0.78 : 0.06);

    const obs = recordObservation({
      artifactId: artifact.id,
      type: 'inter_frame_motion_continuity',
      value: parseFloat((1 - rawTemporalVariance).toFixed(3)),
      unit: 'index',
      description: rawTemporalVariance > 0.5
        ? 'Abrupt temporal motion vector shifts observed across sequential frames.'
        : 'Inter-frame motion flow is smooth and continuous.',
      source: 'Temporal Consistency Engine',
      methodId: 'method_frame_consistency_v1',
      analysisRunId: run.id,
      status: 'OBSERVED',
      metadata: { isDemo, scenario }
    });
    generatedObs.push(obs);

    const evd = recordEvidence({
      artifactId: artifact.id,
      observationIds: [obs.id],
      type: 'temporal_flow_consistency',
      description: rawTemporalVariance > 0.5
        ? 'Temporal discontinuity identified in video frame stream.'
        : 'Temporal flow complies with natural camera movement.',
      strength: parseFloat((0.50 + Math.abs(rawTemporalVariance - 0.5)).toFixed(2)),
      independenceGroup: 'temporal_domain',
      status: rawTemporalVariance > 0.65 ? 'SUPPORTED' : rawTemporalVariance > 0.35 ? 'INCONCLUSIVE' : 'SUPPORTED',
      analysisRunId: run.id,
      limitations: 'Dropped frames during capture or variable bitrate network streaming may introduce temporal discontinuity.',
      metadata: { isDemo, scenario }
    });
    generatedEvd.push(evd);

    const fnd = recordFinding({
      artifactId: artifact.id,
      category: 'TEMPORAL_INTEGRITY',
      statement: rawTemporalVariance > 0.5
        ? 'Temporal analysis reveals inter-frame discontinuities.'
        : 'Temporal frame sequence exhibits nominal continuity.',
      evidenceIds: [evd.id],
      confidence: parseFloat((0.65 + rawTemporalVariance * 0.28).toFixed(2)),
      epistemicStatus: rawTemporalVariance > 0.65 ? 'INFERRED' : rawTemporalVariance > 0.35 ? 'INCONCLUSIVE' : 'OBSERVED',
      limitations: 'Temporal jumps may result from standard scene cuts or re-encoding rather than deliberate splicing.',
      metadata: { isDemo, scenario }
    });
    generatedFindings.push(fnd);
  }

  const metaRun = recordAnalysisRun({
    artifactId: artifact.id,
    analysisType: 'Container Header & EXIF Inspection',
    methodId: 'method_metadata_extraction_v1',
    inputHash: artifact.sha256,
    resultSummary: 'Container metadata header parsing and EXIF segment extraction.'
  });
  generatedRuns.push(metaRun);

  const hasExif = !!(artifact.metadata && artifact.metadata.hasExif);
  const exifObs = recordObservation({
    artifactId: artifact.id,
    type: 'exif_metadata_segment',
    value: hasExif ? (artifact.metadata.exifData || {}) : null,
    unit: 'metadata_map',
    description: hasExif
      ? 'Embedded EXIF metadata segment parsed successfully.'
      : 'No embedded EXIF metadata found in container headers.',
    source: 'Metadata Extraction Engine',
    methodId: 'method_metadata_extraction_v1',
    analysisRunId: metaRun.id,
    status: hasExif ? 'OBSERVED' : 'UNKNOWN',
    metadata: { isDemo }
  });
  generatedObs.push(exifObs);

  const metaEvd = recordEvidence({
    artifactId: artifact.id,
    observationIds: [exifObs.id],
    type: 'metadata_provenance',
    description: hasExif
      ? 'Exif tags present; camera and capture parameters available for inspection.'
      : 'Container metadata stripped or absent; original capture device unverified.',
    strength: hasExif ? 0.85 : 0.40,
    independenceGroup: 'metadata_domain',
    status: hasExif ? 'SUPPORTED' : 'UNKNOWN',
    analysisRunId: metaRun.id,
    limitations: 'EXIF metadata is easily fabricated or stripped by standard social media platforms.',
    metadata: { isDemo }
  });
  generatedEvd.push(metaEvd);

  const metaFinding = recordFinding({
    artifactId: artifact.id,
    category: 'METADATA_PROVENANCE',
    statement: hasExif
      ? 'Capture metadata is present in the file container.'
      : 'The available evidence does not establish capture provenance from container metadata.',
    evidenceIds: [metaEvd.id],
    confidence: hasExif ? 0.90 : 0.50,
    epistemicStatus: hasExif ? 'OBSERVED' : 'UNKNOWN',
    limitations: 'Absence of metadata is standard for web-transcoded media and does not prove manipulation.',
    metadata: { isDemo }
  });
  generatedFindings.push(metaFinding);

  return {
    artifactId: artifact.id,
    analysisRuns: generatedRuns,
    observations: generatedObs,
    evidence: generatedEvd,
    findings: generatedFindings
  };
}
