// VeriMedia AI — Artifact Comparison & Provenance Relationship Inference (Phase F)
import { RelationshipTypes, FindingStatus, EvidencePolarity } from './core.js';
import { hashSimilarity } from '../forensics/perceptualHash.js';
import { clipVisualSimilarity } from '../../ml/vision/clipEmbedding.js';

export function compareArtifacts(store, investigationId, artifactAId, artifactBId, options = {}) {
  const artA = store.getArtifact(artifactAId);
  const artB = store.getArtifact(artifactBId);

  if (!artA || !artB) {
    throw new Error(`Artifacts not found for comparison: ${artifactAId}, ${artifactBId}`);
  }

  const isExactHash = Boolean(artA.sha256 && artB.sha256 && artA.sha256 === artB.sha256);
  let perceptualSimilarity = 0.0;
  let clipSimilarity = 0.0;

  if (isExactHash) {
    perceptualSimilarity = 1.0;
    clipSimilarity = 1.0;
  } else {
    if (artA.perceptualHash && artB.perceptualHash) {
      perceptualSimilarity = hashSimilarity(artA.perceptualHash, artB.perceptualHash);
    }
    if (artA.clipEmbedding && artB.clipEmbedding) {
      clipSimilarity = clipVisualSimilarity(artA.clipEmbedding, artB.clipEmbedding);
    }
  }

  // Combined visual similarity metric
  const effectiveSimilarity = clipSimilarity > 0
    ? (perceptualSimilarity > 0 ? Number((perceptualSimilarity * 0.5 + clipSimilarity * 0.5).toFixed(4)) : clipSimilarity)
    : perceptualSimilarity;

  const run = store.createAnalysisRun({
    investigationId,
    artifactId: artB.id,
    method: 'CRYPTOGRAPHIC_AND_PERCEPTUAL_COMPARISON'
  });

  const observations = [];
  const evidenceList = [];
  const findings = [];

  let relationshipType = RelationshipTypes.UNKNOWN_RELATIONSHIP;
  let confidence = 0.5;

  if (isExactHash) {
    relationshipType = RelationshipTypes.OBSERVED_SAME_CONTENT;
    confidence = 1.0;

    const obs = store.createObservation({
      runId: run.id,
      artifactId: artB.id,
      observationType: 'EXACT_HASH_MATCH',
      value: artA.sha256
    });
    observations.push(obs);

    const ev = store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: `IG-EXACT-${artA.id}-${artB.id}`,
      evidenceType: 'EXACT_HASH_MATCH',
      description: `Identical SHA-256 cryptographic bitstream verified: ${artA.sha256}`,
      confidence: 1.0,
      polarity: EvidencePolarity.SUPPORTING
    });
    evidenceList.push(ev);

    const finding = store.createFinding({
      investigationId,
      title: 'Identical Cryptographic Bitstream Match',
      summary: `Artifacts ${artA.filename || artA.id} and ${artB.filename || artB.id} share identical SHA-256 hashes.`,
      status: FindingStatus.SUPPORTED,
      confidence: 1.0,
      evidenceIds: [ev.id],
      limitations: [
        'Exact cryptographic bitstream equality establishes identical encoding, but does not prove original creation ownership.'
      ]
    });
    findings.push(finding);
  } else if (perceptualSimilarity >= 0.80) {
    relationshipType = perceptualSimilarity >= 0.95
      ? RelationshipTypes.TRANSFORMED_VERSION
      : RelationshipTypes.POSSIBLY_DERIVED;
    confidence = Number(perceptualSimilarity.toFixed(2));

    const obs = store.createObservation({
      runId: run.id,
      artifactId: artB.id,
      observationType: 'PERCEPTUAL_HASH_SIMILARITY',
      value: { similarity: perceptualSimilarity, hashA: artA.perceptualHash, hashB: artB.perceptualHash }
    });
    observations.push(obs);

    const ev = store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: `IG-PERCEPTUAL-${artA.id}-${artB.id}`,
      evidenceType: 'PERCEPTUAL_VECTOR_SIMILARITY',
      description: `High perceptual vector similarity observed (${(perceptualSimilarity * 100).toFixed(1)}%).`,
      confidence,
      polarity: EvidencePolarity.SUPPORTING
    });
    evidenceList.push(ev);

    const finding = store.createFinding({
      investigationId,
      title: 'Perceptual Transformation Relationship',
      summary: `Artifact ${artB.filename || artB.id} is visually consistent with ${artA.filename || artA.id} with perceptual similarity of ${(perceptualSimilarity * 100).toFixed(1)}%.`,
      status: FindingStatus.SUPPORTED,
      confidence,
      evidenceIds: [ev.id],
      limitations: [
        'Visual similarity does not prove which artifact came first or which is the authentic origin.',
        'Transformations such as re-encoding, cropping, or filtering preserve visual features while altering digital signatures.'
      ]
    });
    findings.push(finding);
  }

  const relationship = store.createRelationship({
    investigationId,
    fromArtifactId: artA.id,
    toArtifactId: artB.id,
    relationshipType,
    confidence,
    evidenceIds: evidenceList.map(e => e.id),
    status: isExactHash || perceptualSimilarity >= 0.80 ? 'SUPPORTED' : 'INCONCLUSIVE'
  });

  return {
    isExactMatch: isExactHash,
    perceptualSimilarity,
    relationship,
    evidence: evidenceList,
    observations,
    findings,
    run
  };
}
