import crypto from 'crypto';

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function createMediaArtifact({
  id = generateId('art'),
  filename = 'unnamed',
  mimeType = 'application/octet-stream',
  size = 0,
  sha256 = '',
  perceptualHash = '',
  metadata = {},
  sourceType = 'upload',
  sourceUrl = '',
  createdAt = new Date().toISOString()
} = {}) {
  return {
    id,
    filename,
    mimeType,
    size,
    sha256,
    perceptualHash,
    metadata,
    sourceType,
    sourceUrl,
    createdAt
  };
}

export function createObservation({
  id = generateId('obs'),
  artifactId,
  type,
  value = null,
  unit = '',
  description = '',
  source = 'Local Inspection',
  observedAt = new Date().toISOString(),
  methodId = null,
  analysisRunId = null,
  status = 'OBSERVED',
  metadata = {}
} = {}) {
  return {
    id,
    artifactId,
    type,
    value,
    unit,
    description,
    source,
    observedAt,
    methodId,
    analysisRunId,
    status,
    metadata
  };
}

export function createEvidence({
  id = generateId('evd'),
  artifactId,
  observationIds = [],
  type = 'forensic_evidence',
  description = '',
  strength = 1.0,
  independenceGroup = 'primary_inspection',
  status = 'SUPPORTED',
  analysisRunId = null,
  createdAt = new Date().toISOString(),
  limitations = '',
  metadata = {}
} = {}) {
  return {
    id,
    artifactId,
    observationIds,
    type,
    description,
    strength,
    independenceGroup,
    status,
    analysisRunId,
    createdAt,
    limitations,
    metadata
  };
}

export function createFinding({
  id = generateId('fnd'),
  artifactId,
  category,
  statement,
  evidenceIds = [],
  confidence = 1.0,
  epistemicStatus = 'INFERRED',
  limitations = '',
  createdAt = new Date().toISOString(),
  metadata = {}
} = {}) {
  return {
    id,
    artifactId,
    category,
    statement,
    evidenceIds,
    confidence,
    epistemicStatus,
    limitations,
    createdAt,
    metadata
  };
}

export function createAnalysisRun({
  id = generateId('run'),
  artifactId,
  analysisType = 'FORENSIC_ANALYSIS_RUN',
  startedAt = new Date().toISOString(),
  completedAt = new Date().toISOString(),
  status = 'COMPLETED',
  methodId = null,
  inputHash = '',
  resultSummary = '',
  metadata = {}
} = {}) {
  return {
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
  };
}

export function createAnalysisMethod({
  id = generateId('method'),
  name = 'Unnamed Method',
  version = '1.0.0',
  description = '',
  limitations = '',
  epistemicCategory = 'GENERAL_FORENSIC_INSPECTION',
  metadata = {}
} = {}) {
  return {
    id,
    name,
    version,
    description,
    limitations,
    epistemicCategory,
    metadata
  };
}

export function createInvestigation({
  id = generateId('inv'),
  title = '',
  description = '',
  status = 'OPEN',
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  createdBy = 'Analyst',
  artifactIds = [],
  findingIds = [],
  priority = 'MEDIUM',
  tags = [],
  metadata = {},
  artifactId = null,
  mode = 'REAL_INVESTIGATION',
  findings = [],
  evidence = [],
  observations = [],
  analysisRuns = [],
  uncertainty = []
} = {}) {
  const normArtifactIds = Array.isArray(artifactIds) ? [...artifactIds] : [];
  if (artifactId && !normArtifactIds.includes(artifactId)) {
    normArtifactIds.push(artifactId);
  }

  const normFindingIds = Array.isArray(findingIds) ? [...findingIds] : [];
  if (Array.isArray(findings)) {
    findings.forEach(f => {
      const fid = typeof f === 'string' ? f : f?.id;
      if (fid && !normFindingIds.includes(fid)) {
        normFindingIds.push(fid);
      }
    });
  }

  const finalTitle = title || (artifactId ? `Investigation ${artifactId.slice(0, 10)}` : `Investigation ${id.slice(0, 10)}`);
  const validStatuses = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED', 'COMPLETED'];
  const finalStatus = validStatuses.includes(status) ? status : 'OPEN';

  return {
    id,
    title: finalTitle,
    description,
    status: finalStatus,
    createdAt,
    updatedAt,
    createdBy,
    artifactIds: normArtifactIds,
    findingIds: normFindingIds,
    priority,
    tags,
    metadata: {
      mode: mode || (metadata && metadata.mode) || 'REAL_INVESTIGATION',
      ...metadata
    },
    artifactId: artifactId || normArtifactIds[0] || null,
    mode: mode || (metadata && metadata.mode) || 'REAL_INVESTIGATION',
    findings,
    evidence,
    observations,
    analysisRuns,
    uncertainty
  };
}

export function createTimelineEvent({
  id = generateId('evt'),
  investigationId,
  type = 'INVESTIGATION_CREATED',
  timestamp = new Date().toISOString(),
  actor = 'System',
  description = '',
  metadata = {}
} = {}) {
  return {
    id,
    investigationId,
    type,
    timestamp,
    actor,
    description,
    metadata
  };
}

export function createNote({
  id = generateId('nte'),
  investigationId,
  authorId = 'Analyst',
  text = '',
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
} = {}) {
  return {
    id,
    investigationId,
    authorId,
    text,
    createdAt,
    updatedAt
  };
}

export function createArtifactRelationship({
  id = generateId('rel'),
  investigationId,
  sourceArtifactId,
  targetArtifactId,
  type = 'UNKNOWN',
  evidenceIds = [],
  description = '',
  createdAt = new Date().toISOString()
} = {}) {
  return {
    id,
    investigationId,
    sourceArtifactId,
    targetArtifactId,
    type,
    evidenceIds,
    description,
    createdAt
  };
}

export function createSource({
  id = generateId('src'),
  artifactId,
  sourceType = 'upload',
  sourceUrl = '',
  metadata = {}
} = {}) {
  return {
    id,
    artifactId,
    sourceType,
    sourceUrl,
    metadata
  };
}
