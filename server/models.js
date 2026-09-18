'use strict';

const crypto = require('crypto');
const { EPISTEMIC_STATUSES } = require('./config');

/**
 * Generate a unique typed identifier
 * @param {string} prefix 
 * @returns {string}
 */
function generateId(prefix = 'obj') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Factory for a MediaArtifact entity
 * @param {Object} params
 * @returns {Object}
 */
function createMediaArtifact({
  id = generateId('art'),
  filename,
  mimeType,
  size,
  sha256,
  perceptualHash,
  createdAt = new Date().toISOString(),
  metadata = {},
  sourceType = 'upload' // 'upload' | 'url' | 'demo'
}) {
  return {
    id,
    filename,
    mimeType,
    size,
    sha256,
    perceptualHash: perceptualHash || 'p0000000000000000',
    createdAt,
    metadata,
    sourceType
  };
}

/**
 * Factory for an Observation entity
 * @param {Object} params
 * @returns {Object}
 */
function createObservation({
  id = generateId('obs'),
  artifactId,
  type,
  value,
  source = 'Local Inspection Engine',
  timestamp = new Date().toISOString(),
  methodology
}) {
  return {
    id,
    artifactId,
    type,
    value,
    source,
    timestamp,
    methodology
  };
}

/**
 * Factory for an Evidence entity
 * @param {Object} params
 * @returns {Object}
 */
function createEvidence({
  id = generateId('evd'),
  observationIds = [],
  evidenceType,
  independenceGroup = 'primary_inspection',
  strength = 1.0,
  status = EPISTEMIC_STATUSES.OBSERVED,
  limitations = ''
}) {
  return {
    id,
    observationIds,
    evidenceType,
    independenceGroup,
    strength,
    status,
    limitations
  };
}

/**
 * Factory for a Finding entity
 * @param {Object} params
 * @returns {Object}
 */
function createFinding({
  id = generateId('fnd'),
  category,
  statement,
  evidenceIds = [],
  confidence = 1.0,
  epistemicStatus = EPISTEMIC_STATUSES.OBSERVED,
  uncertaintyNotes = ''
}) {
  return {
    id,
    category,
    statement,
    evidenceIds,
    confidence,
    epistemicStatus,
    uncertaintyNotes
  };
}

/**
 * Factory for a Source entity
 * @param {Object} params
 * @returns {Object}
 */
function createSource({
  id = generateId('src'),
  url = '',
  platform = 'Direct Upload',
  observedAt = new Date().toISOString(),
  account = 'User Ingestion',
  metadata = {},
  sourceQuality = 'PRIMARY_SUBMISSION'
}) {
  return {
    id,
    url,
    platform,
    observedAt,
    account,
    metadata,
    sourceQuality
  };
}

/**
 * Factory for a MediaVersion entity
 * @param {Object} params
 * @returns {Object}
 */
function createMediaVersion({
  id = generateId('ver'),
  artifactId,
  sourceId,
  sha256,
  perceptualHash,
  transformations = []
}) {
  return {
    id,
    artifactId,
    sourceId,
    sha256,
    perceptualHash,
    transformations
  };
}

/**
 * Factory for a Claim entity
 * @param {Object} params
 * @returns {Object}
 */
function createClaim({
  text,
  normalizedClaim = '',
  status = EPISTEMIC_STATUSES.UNKNOWN,
  supportingEvidenceIds = [],
  contradictingEvidenceIds = [],
  confidence = 0.5
}) {
  return {
    text,
    normalizedClaim,
    status,
    supportingEvidenceIds,
    contradictingEvidenceIds,
    confidence
  };
}

/**
 * Factory for a complete Investigation package
 * @param {Object} params
 * @returns {Object}
 */
function createInvestigation({
  id = generateId('inv'),
  createdAt = new Date().toISOString(),
  artifactId,
  mode = 'REAL_INVESTIGATION', // 'REAL_INVESTIGATION' | 'DEMO_SCENARIO'
  status = 'COMPLETED',
  findings = [],
  timeline = [],
  evidence = [],
  observations = [],
  sources = [],
  uncertainty = []
}) {
  return {
    id,
    createdAt,
    artifactId,
    mode,
    status,
    findings,
    timeline,
    evidence,
    observations,
    sources,
    uncertainty
  };
}

module.exports = {
  generateId,
  createMediaArtifact,
  createObservation,
  createEvidence,
  createFinding,
  createSource,
  createMediaVersion,
  createClaim,
  createInvestigation
};
