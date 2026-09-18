// VeriMedia AI — Artifact Comparator & Transformation Analyzer (Phase F & I)
import { analyzeArtifactTransformations } from './genealogy.js';

export { hammingDistanceHex } from './discovery.js';

/**
 * Compares two artifacts and produces structured Observations, Evidence,
 * Findings, ProvenanceRelationships, and Transformations adhering to Phase F & I rules.
 */
export function compareArtifacts(store, investigationId, artifactAId, artifactBId, options = {}) {
  return analyzeArtifactTransformations(store, investigationId, artifactAId, artifactBId, options);
}
