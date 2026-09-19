// VeriMedia AI — Media Genealogy & Transformation Graph Analysis (Phase I)

export function buildGenealogyGraph(store, investigationId) {
  const inv = store.getInvestigation(investigationId);
  if (!inv) {
    return {
      investigationId,
      nodes: [],
      edges: [],
      transformations: [],
      summary: 'No investigation found.'
    };
  }

  const artifacts = (inv.artifactIds || []).map(id => store.getArtifact(id)).filter(Boolean);
  const transformations = store.getTransformationsByInvestigation?.(investigationId) || 
    Array.from(store.transformations.values()).filter(t => t.investigationId === investigationId);
  
  const relationships = Array.from(store.relationships.values()).filter(
    r => r.investigationId === investigationId
  );

  const nodes = artifacts.map(art => ({
    id: art.id,
    label: art.filename || art.id,
    mimeType: art.mimeType,
    sha256: art.sha256,
    perceptualHash: art.perceptualHash,
    dimensions: art.dimensions,
    duration: art.duration,
    isReference: Boolean(art.isReference),
    isDemo: Boolean(art.isDemo),
    createdAt: art.createdAt
  }));

  const edges = [];

  for (const trf of transformations) {
    edges.push({
      id: trf.id,
      from: trf.sourceArtifactId,
      to: trf.targetArtifactId,
      type: trf.type,
      direction: trf.direction,
      confidence: trf.confidence,
      epistemicStatus: trf.epistemicStatus,
      evidenceIds: trf.evidenceIds || [],
      limitations: trf.limitations || []
    });
  }

  for (const rel of relationships) {
    if (!edges.some(e => (e.from === rel.fromArtifactId && e.to === rel.toArtifactId))) {
      edges.push({
        id: rel.id,
        from: rel.fromArtifactId,
        to: rel.toArtifactId,
        type: rel.relationshipType,
        direction: 'FORWARD',
        confidence: rel.confidence,
        epistemicStatus: rel.status,
        evidenceIds: rel.evidenceIds || []
      });
    }
  }

  return {
    investigationId,
    nodes,
    edges,
    transformations,
    relationships,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    isDemo: Boolean(inv.isDemo)
  };
}

export function traceTransformation(store, transformationId) {
  const trf = store.getTransformation?.(transformationId) || store.transformations.get(transformationId);
  if (!trf) {
    throw new Error(`Transformation not found: ${transformationId}`);
  }

  const sourceArt = trf.sourceArtifactId ? store.getArtifact(trf.sourceArtifactId) : null;
  const targetArt = trf.targetArtifactId ? store.getArtifact(trf.targetArtifactId) : null;
  const evidenceList = (trf.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);
  const observations = (trf.observations || []).map(id => store.getObservation(id)).filter(Boolean);
  const run = trf.analysisRunId ? store.getAnalysisRun(trf.analysisRunId) : null;

  return {
    transformation: trf,
    sourceArtifact: sourceArt,
    targetArtifact: targetArt,
    analysisRun: run,
    evidence: evidenceList,
    observations,
    verified: evidenceList.length > 0
  };
}
