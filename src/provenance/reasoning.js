// VeriMedia AI — Evidence Fusion & Reasoning Traceability (Phase K & 18)
import { buildMediaTimeline } from './timeline.js';

export function fuseEvidenceAndReasoning(store, investigationId, options = {}) {
  const inv = store.getInvestigation(investigationId);
  const findings = (inv?.findingIds || []).map(id => store.getFinding(id)).filter(Boolean);
  
  // Collect all findings belonging to this investigation
  const allInvestigationFindings = findings.length > 0 
    ? findings 
    : Array.from(store.findings.values()).filter(f => f.investigationId === investigationId);

  const evidenceIds = new Set();
  allInvestigationFindings.forEach(f => {
    (f.evidenceIds || []).forEach(eid => evidenceIds.add(eid));
  });

  const evidenceList = Array.from(evidenceIds).map(eid => store.getEvidence(eid)).filter(Boolean);
  const distinctGroups = new Set();

  evidenceList.forEach(ev => {
    if (ev.independenceGroupId) {
      distinctGroups.add(ev.independenceGroupId);
    } else {
      distinctGroups.add(`IG-${ev.id}`);
    }
  });

  const distinctIndependenceChannels = distinctGroups.size;

  let baseConfidence = 0.50;
  if (distinctIndependenceChannels >= 3) {
    baseConfidence = 0.94;
  } else if (distinctIndependenceChannels === 2) {
    baseConfidence = 0.88;
  } else if (distinctIndependenceChannels === 1) {
    baseConfidence = 0.85;
  }

  const timeline = buildMediaTimeline(store, investigationId);
  const artifacts = (inv?.artifactIds || []).map(id => store.getArtifact(id)).filter(Boolean);

  const storyline = (timeline.events || []).map((evt, idx) => ({
    step: idx + 1,
    id: evt.id,
    title: evt.sourceName || evt.artifactName || `Appearance ${idx + 1}`,
    artifactName: evt.artifactName,
    timestamp: evt.publishedAt || evt.observedAt,
    platform: evt.platform || 'WEB',
    description: evt.metadata?.description || `Observed on ${evt.sourceName || evt.platform} (${evt.status})`,
    status: evt.status,
    evidenceIds: evt.evidenceIds || []
  }));

  const whatWeKnow = timeline.whatWeKnow || [];
  const whatRemainsUnknown = timeline.whatRemainsUnknown || [];
  const summary = `Investigation ${investigationId} analyzed ${artifacts.length} artifact(s) across ${distinctIndependenceChannels} independent channel(s) with ${allInvestigationFindings.length} finding(s).`;

  return {
    investigationId,
    distinctIndependenceChannels,
    totalEvidenceNodes: evidenceList.length,
    findingsCount: allInvestigationFindings.length,
    calibratedConfidence: baseConfidence,
    evidenceLedger: evidenceList,
    findings: allInvestigationFindings,
    timeline,
    storyline,
    whatWeKnow,
    whatRemainsUnknown,
    summary,
    fusedAt: new Date().toISOString()
  };
}

export function traceReasoningChain(store, findingId) {
  const finding = store.getFinding(findingId);
  if (!finding) {
    throw new Error(`Finding not found: ${findingId}`);
  }

  const evidenceChain = (finding.evidenceIds || []).map(eid => {
    const evidence = store.getEvidence(eid);
    if (!evidence) return null;

    const observations = (evidence.observationIds || []).map(obsId => {
      const obs = store.getObservation(obsId);
      if (!obs) return null;
      const run = obs.runId ? store.getAnalysisRun(obs.runId) : null;
      const artifact = obs.artifactId ? store.getArtifact(obs.artifactId) : null;
      return {
        observation: obs,
        run,
        artifact
      };
    }).filter(Boolean);

    return {
      evidence,
      observations
    };
  }).filter(Boolean);

  return {
    finding,
    evidenceChain,
    verified: evidenceChain.length > 0
  };
}
