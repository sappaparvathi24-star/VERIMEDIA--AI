// VeriMedia AI — Media Timeline & Earliest Observed Appearance (Phase F)
import { AppearanceStatus, FindingStatus, EvidencePolarity } from './core.js';

/**
 * Builds the evidence-backed Media Timeline and evaluates the
 * Earliest Observed Appearance adhering to Phase F rules.
 */
export function buildMediaTimeline(store, investigationId) {
  const investigation = store.getInvestigation(investigationId);
  if (!investigation) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  // Gather all appearances associated with this investigation
  const appearanceIds = investigation.appearanceIds || [];
  const appearances = appearanceIds
    .map(id => store.getAppearance(id))
    .filter(Boolean);

  // If no appearances exist, return unknown provenance
  if (appearances.length === 0) {
    return {
      investigationId,
      events: [],
      earliestAppearance: null,
      status: 'UNKNOWN',
      provenanceConfidence: 'UNKNOWN',
      forensicConfidence: investigation.forensicConfidence || 0.85,
      whatWeKnow: ['No source appearances have been recorded for this investigation yet.'],
      whatRemainsUnknown: [
        'The earliest observed appearance is unknown.',
        'No source platforms or publication records are available.',
        'The absolute origin remains completely unverified.'
      ]
    };
  }

  // Map each appearance to a timeline event enriched with source and evidence
  const events = appearances.map(app => {
    const source = store.getSource(app.sourceId);
    const artifact = store.getArtifact(app.artifactId);
    const linkedEvidence = (app.evidenceIds || []).map(eid => store.getEvidence(eid)).filter(Boolean);

    // Primary sorting timestamp: publishedAt (claimed by source) if valid, otherwise observedAt
    const effectiveTimestamp = app.publishedAt || app.observedAt;
    const timeVal = new Date(effectiveTimestamp).getTime();

    return {
      id: `EVT-${app.id}`,
      appearanceId: app.id,
      artifactId: app.artifactId,
      artifactFilename: artifact?.filename || 'unknown_media',
      sourceId: app.sourceId,
      sourceName: source?.name || 'Unknown Source',
      sourceDomain: source?.domain || 'unknown-domain',
      sourceUrl: source?.url || null,
      sourcePlatform: source?.platform || 'WEB',
      sourceType: source?.type || 'UNKNOWN',
      sourceQuality: source?.quality || {},
      observedAt: app.observedAt, // When system retrieved it
      publishedAt: app.publishedAt, // When source reported publication
      retrievedAt: app.retrievedAt,
      effectiveTimestamp,
      timestampValue: isNaN(timeVal) ? 0 : timeVal,
      evidenceIds: app.evidenceIds || [],
      evidence: linkedEvidence,
      status: app.status || AppearanceStatus.OBSERVED,
      confidence: linkedEvidence.length > 0 ? (linkedEvidence.reduce((s, e) => s + e.confidence, 0) / linkedEvidence.length) : 0.5,
      limitations: [
        'Published timestamp indicates when source reported publication, not media creation time.',
        'Does not prove the source was the first or only distributor of this media.'
      ]
    };
  });

  // Sort chronological by effective timestamp
  events.sort((a, b) => a.timestampValue - b.timestampValue);

  // Check for conflicting timestamps across appearances
  let hasConflictingTimestamps = false;
  const conflictDetails = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const e1 = events[i];
      const e2 = events[j];
      if (e1.artifactId === e2.artifactId && e1.sourceId !== e2.sourceId) {
        // If both sources claim mutually incompatible first publication without syndication record
        if (e1.status === AppearanceStatus.CONFLICTING || e2.status === AppearanceStatus.CONFLICTING) {
          hasConflictingTimestamps = true;
          conflictDetails.push(`Source ${e1.sourceName} (${e1.publishedAt || 'N/A'}) and Source ${e2.sourceName} (${e2.publishedAt || 'N/A'}) have conflicting publication claims.`);
        }
      }
    }
  }

  // Evaluate Earliest Observed Appearance
  let earliestEvent = null;
  let timelineStatus = 'OBSERVED';
  let provenanceConfidence = 0.5;

  if (hasConflictingTimestamps) {
    timelineStatus = 'CONFLICTING';
    provenanceConfidence = 0.35;
  } else if (events.length === 1) {
    earliestEvent = events[0];
    timelineStatus = 'OBSERVED';
    provenanceConfidence = 0.55;
  } else {
    // Pick event with earliest published date
    const eventsWithPublished = events.filter(e => Boolean(e.publishedAt && !isNaN(new Date(e.publishedAt).getTime())));
    if (eventsWithPublished.length > 0) {
      earliestEvent = eventsWithPublished[0];
      provenanceConfidence = 0.75;
    } else {
      earliestEvent = events[0];
      provenanceConfidence = 0.50;
    }
  }

  // Label the earliest event strictly according to Phase F:
  // "EARLIEST OBSERVED APPEARANCE"
  // Mandatory: NEVER use "ORIGINAL SOURCE", "ORIGINAL FILE", or "ABSOLUTE ORIGIN"
  const earliestObservedLabel = 'EARLIEST OBSERVED APPEARANCE';
  const earliestObservedNote = events.length === 1
    ? 'One observed appearance is available. This does not establish absolute origin.'
    : hasConflictingTimestamps
    ? 'Conflicting publication timestamps detected between sources. No single origin can be established.'
    : `Earliest appearance supported in current evidence was observed on ${earliestEvent ? (earliestEvent.publishedAt || earliestEvent.observedAt) : 'N/A'}. This does not establish the absolute original source.`;

  // Build "What We Know" and "What Remains Unknown"
  const whatWeKnow = [];
  const whatRemainsUnknown = [];

  if (events.length > 0) {
    whatWeKnow.push(`${events.length} distinct appearance${events.length > 1 ? 's were' : ' was'} observed across ${new Set(events.map(e => e.sourceDomain)).size} verified domain(s).`);
  }

  if (earliestEvent) {
    whatWeKnow.push(`Earliest observed appearance in available evidence is from ${earliestEvent.sourceName} (${earliestEvent.sourceDomain}) with timestamp: ${earliestEvent.publishedAt || earliestEvent.observedAt}.`);
  }

  // Check relationship count
  const relCount = (investigation.relationshipIds || []).length;
  if (relCount > 0) {
    whatWeKnow.push(`${relCount} evidence-backed artifact relationship(s) recorded in investigation repository.`);
  }

  // Unknowns (Mandatory Phase F honesty)
  whatRemainsUnknown.push('The absolute original creation source and device cannot be established from current evidence.');
  whatRemainsUnknown.push('The actual creation time of the media is unknown (publication timestamps reflect online appearance only).');

  if (hasConflictingTimestamps) {
    whatRemainsUnknown.push('The true chronological order among conflicting source timestamps remains unresolved.');
  }

  if (events.length === 1) {
    whatRemainsUnknown.push('Whether earlier online or offline copies of this media exist is unknown.');
  }

  // Construct or update Phase F Findings
  if (earliestEvent) {
    const existingEarliestFinding = (investigation.findingIds || [])
      .map(fid => store.getFinding(fid))
      .find(f => f?.metadata?.isEarliestAppearance);

    if (!existingEarliestFinding) {
      store.createFinding({
        investigationId,
        title: earliestObservedLabel,
        summary: earliestObservedNote,
        status: hasConflictingTimestamps ? FindingStatus.CONFLICTING : FindingStatus.SUPPORTED,
        confidence: provenanceConfidence,
        evidenceIds: earliestEvent.evidenceIds || [],
        limitations: [
          'Observed publication timestamp does not establish absolute creation time.',
          'Additional earlier distributions may exist that are not currently indexed.',
          'Authoritative creator identity requires first-party cryptographic signing or copyright registration.'
        ],
        metadata: {
          isEarliestAppearance: true,
          earliestSourceId: earliestEvent.sourceId,
          earliestTimestamp: earliestEvent.effectiveTimestamp
        }
      });
    }
  }

  return {
    investigationId,
    status: timelineStatus,
    events,
    earliestAppearance: earliestEvent ? {
      label: earliestObservedLabel,
      note: earliestObservedNote,
      event: earliestEvent,
      appearanceId: earliestEvent.appearanceId,
      artifactId: earliestEvent.artifactId,
      sourceId: earliestEvent.sourceId,
      sourceName: earliestEvent.sourceName,
      sourceDomain: earliestEvent.sourceDomain,
      sourcePlatform: earliestEvent.sourcePlatform,
      publishedAt: earliestEvent.publishedAt,
      observedAt: earliestEvent.observedAt,
      evidenceIds: earliestEvent.evidenceIds || []
    } : null,
    provenanceConfidence,
    forensicConfidence: investigation.forensicConfidence || 0.85,
    whatWeKnow,
    whatRemainsUnknown,
    conflicts: conflictDetails,
    isDemo: Boolean(investigation.isDemo)
  };
}
