// VeriMedia AI — Canonical Analysis Contract
// Defines standard structured evidence envelope for all verification engines

export const EngineStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

/**
 * Creates a canonical analysis result envelope.
 * @param {object} params
 * @returns {object} Canonical contract object
 */
export function createEngineResult({
  engine,
  status = EngineStatus.COMPLETED,
  applicable = true,
  startedAt = new Date().toISOString(),
  completedAt = new Date().toISOString(),
  observations = [],
  measurements = [],
  evidenceIds = [],
  limitations = [],
  errors = [],
  source = null,
  realAnalysis = true,
  extra = {}
} = {}) {
  // Validate status against permitted values
  const validStatus = Object.values(EngineStatus).includes(status)
    ? status
    : EngineStatus.INCONCLUSIVE;

  return {
    engine: engine || 'UNKNOWN_ENGINE',
    status: validStatus,
    applicable: Boolean(applicable),
    startedAt,
    completedAt,
    observations: Array.isArray(observations) ? observations : [],
    measurements: Array.isArray(measurements) ? measurements : [],
    evidenceIds: Array.isArray(evidenceIds) ? evidenceIds : [],
    limitations: Array.isArray(limitations) ? limitations : [],
    errors: Array.isArray(errors) ? errors : [],
    source: source || null,
    realAnalysis: Boolean(realAnalysis),
    ...extra
  };
}

/**
 * Quick helper for engines that are not applicable to the content type
 */
export function createNotApplicableResult(engine, reason) {
  return createEngineResult({
    engine,
    status: EngineStatus.NOT_APPLICABLE,
    applicable: false,
    limitations: [reason || `Engine ${engine} is not applicable to this media type`],
    realAnalysis: true
  });
}

/**
 * Quick helper for engines whose required credentials/tools are unavailable
 */
export function createUnavailableResult(engine, reason) {
  return createEngineResult({
    engine,
    status: EngineStatus.UNAVAILABLE,
    applicable: true,
    limitations: [reason || `Engine ${engine} is unavailable on this deployment`],
    realAnalysis: false
  });
}
