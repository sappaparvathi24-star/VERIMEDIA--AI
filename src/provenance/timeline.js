// VeriMedia AI — Media Timeline Construction & Epistemic Demarcation (Phase F)
import { AppearanceStatus } from './core.js';

export function buildMediaTimeline(store, investigationId) {
  const inv = store.getInvestigation(investigationId);
  if (!inv) {
    return {
      investigationId,
      events: [],
      earliestAppearance: null,
      status: 'UNKNOWN',
      forensicConfidence: 0.85,
      provenanceConfidence: 'UNKNOWN',
      conflicts: [],
      whatWeKnow: [],
      whatRemainsUnknown: ['Investigation not found or empty provenance history.'],
      isDemo: false
    };
  }

  const appearances = Array.from(store.appearances.values()).filter(
    app => app.investigationId === investigationId
  );

  const events = [];
  const conflicts = [];
  let hasConflicts = false;

  for (const app of appearances) {
    const source = app.sourceId ? store.getSource(app.sourceId) : null;
    const artifact = app.artifactId ? store.getArtifact(app.artifactId) : null;
    const tsString = app.publishedAt || app.observedAt || app.createdAt;
    const tsValue = tsString ? new Date(tsString).getTime() : 0;

    if (app.status === AppearanceStatus.CONFLICTING) {
      hasConflicts = true;
      conflicts.push({
        appearanceId: app.id,
        sourceName: source?.name || 'Unknown Source',
        publishedAt: app.publishedAt,
        observedAt: app.observedAt,
        reason: 'Conflicting publication timestamp asserted by external source.'
      });
    }

    events.push({
      id: app.id,
      appearanceId: app.id,
      artifactId: app.artifactId,
      artifactName: artifact?.filename || 'Unknown Media',
      sourceId: app.sourceId,
      sourceName: source?.name || 'Unknown Source',
      sourceUrl: source?.url || null,
      domain: source?.domain || null,
      platform: source?.platform || 'WEB',
      publishedAt: app.publishedAt,
      observedAt: app.observedAt,
      timestampValue: tsValue,
      status: app.status || AppearanceStatus.OBSERVED,
      evidenceIds: app.evidenceIds || [],
      metadata: app.metadata || {}
    });
  }

  // Sort events chronologically
  events.sort((a, b) => a.timestampValue - b.timestampValue);

  let earliestAppearance = null;
  if (events.length > 0) {
    const earliest = events[0];
    earliestAppearance = {
      event: earliest,
      label: 'EARLIEST OBSERVED APPEARANCE',
      note: 'Earliest observed appearance in available evidence; does not establish absolute origin or creator identity.'
    };
  }

  const forensicConfidence = inv.metadata?.forensicConfidence || inv.forensicConfidence || 0.85;
  let provenanceConfidence = 'UNKNOWN';
  let status = 'UNKNOWN';

  if (events.length > 0) {
    status = hasConflicts ? 'CONFLICTING' : 'OBSERVED';
    provenanceConfidence = hasConflicts ? 0.40 : 0.55;
  }

  const whatWeKnow = [];
  const whatRemainsUnknown = [];

  if (events.length > 0) {
    whatWeKnow.push(`Observed ${events.length} public appearance(s) across cataloged sources.`);
    if (earliestAppearance) {
      whatWeKnow.push(`Earliest public appearance recorded at ${earliestAppearance.event.publishedAt || earliestAppearance.event.observedAt} on ${earliestAppearance.event.sourceName}.`);
    }
  }

  if (events.length === 0) {
    whatRemainsUnknown.push('Provenance timeline is unknown; no verified appearance records currently ingested.');
  } else if (hasConflicts) {
    whatRemainsUnknown.push('Investigation contains conflicting source timestamps that require manual adjudication.');
    whatRemainsUnknown.push('Earliest source publication order cannot be definitively determined due to timestamp discrepancies.');
  } else {
    whatRemainsUnknown.push('Absolute offline creation moment and unindexed dark-web distributions remain unknown.');
  }

  return {
    investigationId,
    events,
    earliestAppearance,
    status,
    forensicConfidence,
    provenanceConfidence,
    conflicts,
    whatWeKnow,
    whatRemainsUnknown,
    isDemo: Boolean(inv.isDemo)
  };
}
