// VeriMedia AI — Propagation Intelligence & Timeline Graph (Phase J)
import { isPrivateOrBlockedIP } from '../proxy/requestProxy.js';
import { groupIntoContentFamilies } from './contentFamily.js';

export function validatePropagationUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a valid non-empty string' };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are permitted' };
    }
    if (isPrivateOrBlockedIP(parsed.hostname)) {
      return { valid: false, error: 'Target URL resolves to private or restricted network' };
    }
    return { valid: true, url: parsed.href };
  } catch (err) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Derives a grounded confidence score and retrieval metadata for an appearance
 * from backing discovery candidates, observations, and evidence.
 * If no backing signals exist, confidence is set to null (UNKNOWN) rather than an arbitrary flat constant.
 */
export function deriveAppearanceConfidence(store, app, src = null) {
  if (!store || !app) {
    return {
      confidence: null,
      retrievalMethod: 'UNKNOWN',
      matchStrength: null,
      limitations: ['Confidence UNKNOWN: appearance lacks backing data.']
    };
  }

  // 1. Search for a backing DiscoveryCandidate
  const candidates = Array.from(store.discoveryCandidates?.values?.() || []);
  const candidate = candidates.find(c => {
    if (c.investigationId && app.investigationId && c.investigationId !== app.investigationId) {
      return false;
    }
    if (app.evidenceIds?.length > 0 && c.evidenceIds?.some(eId => app.evidenceIds.includes(eId))) {
      return true;
    }
    if (c.sourceId && app.sourceId && c.sourceId !== 'UNKNOWN' && c.sourceId === app.sourceId) {
      if (!c.matchedArtifactId || c.matchedArtifactId === app.artifactId || c.artifactId === app.artifactId) {
        return true;
      }
    }
    if (src?.url && c.url && c.url === src.url) {
      return true;
    }
    if (c.matchedArtifactId && c.matchedArtifactId === app.artifactId) {
      return true;
    }
    return false;
  });

  if (candidate) {
    const sim = candidate.similarityMeasurements || {};

    // Exact hash match -> 1.0 confidence
    if (sim.exactMatch === true || candidate.relationshipType === 'EXACT_MATCH') {
      return {
        confidence: 1.0,
        retrievalMethod: 'EXACT_HASH_MATCH',
        matchStrength: 1.0,
        limitations: ['Confidence 1.0 grounded in verified bitstream cryptographic exact hash match.']
      };
    }

    // Perceptual similarity match -> score derived from visual similarity float
    if (typeof sim.visualSimilarity === 'number') {
      const vs = Number(sim.visualSimilarity.toFixed(2));
      return {
        confidence: vs,
        retrievalMethod: 'PERCEPTUAL_FINGERPRINT_MATCH',
        matchStrength: vs,
        limitations: [`Confidence ${vs} derived from perceptual hash visual similarity metric (${Math.round(vs * 100)}%).`]
      };
    }

    // Hamming distance on perceptual hash
    if (typeof sim.hammingDistance === 'number') {
      const matchStrength = Math.max(0, Number((1 - (sim.hammingDistance / 64)).toFixed(2)));
      return {
        confidence: matchStrength,
        retrievalMethod: 'PERCEPTUAL_FINGERPRINT_MATCH',
        matchStrength,
        limitations: [`Confidence ${matchStrength} derived from perceptual hash Hamming distance ${sim.hammingDistance}/64.`]
      };
    }

    // Weak semantic / text keyword search
    if (sim.similarityStatus === 'TEXT_MATCH_ONLY' || sim.comparisonMethod === 'EXTERNAL_API_METADATA_SEARCH') {
      return {
        confidence: 0.50,
        retrievalMethod: 'EXTERNAL_API_METADATA_SEARCH',
        matchStrength: 0.50,
        limitations: ['Confidence 0.50 grounded in external metadata text query without verified media bitstream matching.']
      };
    }

    // Heuristics based on verified candidate relationship type
    if (candidate.relationshipType === 'DERIVED_COPY') {
      return {
        confidence: 0.90,
        retrievalMethod: 'DERIVED_COPY_VERIFICATION',
        matchStrength: 0.90,
        limitations: ['Confidence 0.90 derived from verified derived copy relationship.']
      };
    }
    if (candidate.relationshipType === 'TRANSFORMED_DERIVATIVE') {
      return {
        confidence: 0.80,
        retrievalMethod: 'TRANSFORMATION_ANALYSIS',
        matchStrength: 0.80,
        limitations: ['Confidence 0.80 derived from transformation analysis of derivative media.']
      };
    }
    if (candidate.relationshipType === 'RELATED_MEDIA') {
      return {
        confidence: 0.65,
        retrievalMethod: 'RELATED_MEDIA_QUERY',
        matchStrength: 0.65,
        limitations: ['Confidence 0.65 derived from related context and metadata observation.']
      };
    }
  }

  // 2. Search for backing Evidence & Observations directly on the appearance
  if (Array.isArray(app.evidenceIds) && app.evidenceIds.length > 0) {
    for (const evId of app.evidenceIds) {
      const ev = store.getEvidence ? store.getEvidence(evId) : store.evidence?.get?.(evId);
      if (ev) {
        if (ev.evidenceType === 'EXACT_HASH_MATCH' || ev.evidenceType === 'CRYPTOGRAPHIC_PROVENANCE_MATCH') {
          return {
            confidence: 1.0,
            retrievalMethod: ev.evidenceType,
            matchStrength: 1.0,
            limitations: ['Confidence 1.0 derived from backing cryptographic evidence.']
          };
        }

        // Check observations under this evidence
        if (Array.isArray(ev.observationIds) && ev.observationIds.length > 0) {
          for (const obsId of ev.observationIds) {
            const obs = store.getObservation ? store.getObservation(obsId) : store.observations?.get?.(obsId);
            if (obs && obs.value) {
              if (obs.value.exactMatch === true) {
                return {
                  confidence: 1.0,
                  retrievalMethod: 'EXACT_HASH_MATCH',
                  matchStrength: 1.0,
                  limitations: ['Confidence 1.0 derived from backing exact match observation.']
                };
              }
              if (typeof obs.value.visualSimilarity === 'number') {
                const vs = Number(obs.value.visualSimilarity.toFixed(2));
                return {
                  confidence: vs,
                  retrievalMethod: 'PERCEPTUAL_FINGERPRINT_MATCH',
                  matchStrength: vs,
                  limitations: [`Confidence ${vs} derived from observation visual similarity metric.`]
                };
              }
            }
          }
        }

        if (typeof ev.confidence === 'number') {
          return {
            confidence: ev.confidence,
            retrievalMethod: ev.evidenceType || 'EVIDENCE_CORROBORATION',
            matchStrength: ev.confidence,
            limitations: [`Confidence ${ev.confidence} derived from corroborating evidence (${ev.evidenceType || 'EVIDENCE'}).`]
          };
        }
      }
    }
  }

  // 3. Fallback: No backing candidate or observation data found -> mark confidence as null / UNKNOWN
  return {
    confidence: null,
    retrievalMethod: 'UNKNOWN',
    matchStrength: null,
    limitations: ['Appearance confidence is UNKNOWN: no backing cryptographic verification or similarity observation available.']
  };
}

export function analyzePropagation(store, investigationId, options = {}) {
  const inv = store.getInvestigation(investigationId);
  const events = Array.from(store.propagationEvents.values()).filter(
    e => e.investigationId === investigationId
  );
  const relationships = Array.from(store.propagationRelationships.values()).filter(
    r => r.investigationId === investigationId
  );

  // If no dedicated propagation events exist, fallback to appearance events
  if (events.length === 0) {
    const appearances = Array.from(store.appearances.values()).filter(
      a => a.investigationId === investigationId
    );
    for (const app of appearances) {
      const src = app.sourceId ? store.getSource(app.sourceId) : null;
      const backing = deriveAppearanceConfidence(store, app, src);

      events.push({
        id: app.id,
        investigationId,
        artifactId: app.artifactId,
        platform: src?.platform || 'Web',
        url: src?.url || null,
        publishedAt: app.publishedAt,
        observedAt: app.observedAt,
        eventType: 'OBSERVED_APPEARANCE',
        confidence: backing.confidence,
        retrievalMethod: backing.retrievalMethod,
        matchStrength: backing.matchStrength,
        limitations: [
          'Extracted from baseline appearances timeline.',
          ...backing.limitations
        ]
      });
    }
  }

  // Sort events chronologically
  events.sort((a, b) => {
    const tA = new Date(a.publishedAt || a.observedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.publishedAt || b.observedAt || b.createdAt || 0).getTime();
    return tA - tB;
  });

  const earliestObservedAppearance = events.length > 0 ? events[0] : null;

  const graph = {
    nodes: events.map(e => ({
      id: e.id,
      label: `${e.platform || 'Web'}: ${e.id.slice(0, 8)}`,
      platform: e.platform,
      url: e.url,
      timestamp: e.publishedAt || e.observedAt,
      eventType: e.eventType,
      confidence: e.confidence,
      retrievalMethod: e.retrievalMethod || null,
      matchStrength: e.matchStrength ?? null
    })),
    edges: relationships.map(r => ({
      id: r.id,
      from: r.fromEventId,
      to: r.toEventId,
      type: r.relationshipType,
      confidence: r.confidence
    }))
  };

  const platformCounts = {};
  for (const e of events) {
    const p = e.platform || 'Web';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  }

  const clusters = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count,
    percentage: events.length > 0 ? Number(((count / events.length) * 100).toFixed(1)) : 0
  }));

  // Content Families: Cluster propagation events using their stored hashes
  // If a propagation event has no hash available, it remains a singleton family
  const familyMembers = events.map(e => {
    const art = e.artifactId ? store.getArtifact(e.artifactId) : null;
    const cand = (e.candidateId || e.metadata?.candidateId) && store.discoveryCandidates
      ? store.discoveryCandidates.get(e.candidateId || e.metadata?.candidateId)
      : null;

    const hash = e.hash ||
                 e.metadata?.hash ||
                 e.perceptualHash ||
                 e.metadata?.perceptualHash ||
                 art?.perceptualHash ||
                 art?.metadata?.hash ||
                 art?.metadata?.perceptualHash ||
                 cand?.perceptualFingerprint ||
                 cand?.similarityMeasurements?.hash ||
                 null;

    return {
      id: e.id,
      sourceId: e.sourceId || e.source || e.platform,
      platform: e.platform || 'Web',
      url: e.url || null,
      publishedAt: e.publishedAt || null,
      observedAt: e.observedAt || null,
      createdAt: e.createdAt || null,
      hash,
      event: e
    };
  });

  const contentFamilies = groupIntoContentFamilies(familyMembers, { threshold: options.threshold || 0.88 });

  // Synchronize family reference and evidence independenceGroupId
  for (const fam of contentFamilies) {
    for (const memberId of fam.memberIds) {
      const evt = events.find(e => e.id === memberId);
      if (evt) {
        evt.contentFamily = fam;
        evt.contentFamilyId = fam.familyId;
        if (evt.evidenceIds && Array.isArray(evt.evidenceIds)) {
          for (const eid of evt.evidenceIds) {
            const ev = store.getEvidence(eid);
            if (ev && (!ev.independenceGroupId || ev.independenceGroupId.startsWith('IG-PROP-') || ev.independenceGroupId.startsWith('IG-DEFAULT-'))) {
              ev.independenceGroupId = fam.familyId;
            }
          }
        }
      }
    }
  }

  const whatWeKnow = [];
  const whatRemainsUnknown = [];

  if (events.length > 0) {
    whatWeKnow.push(`Observed ${events.length} propagation events across ${clusters.length} platform(s).`);
    if (contentFamilies.length < events.length) {
      whatWeKnow.push(`${events.length} appearances observed, collapsing to ${contentFamilies.length} distinct content family/families.`);
    }
    if (earliestObservedAppearance) {
      whatWeKnow.push(`Earliest dissemination node logged on ${earliestObservedAppearance.platform} at ${earliestObservedAppearance.publishedAt || earliestObservedAppearance.observedAt}.`);
    }
  } else {
    whatRemainsUnknown.push('No propagation events logged for this investigation.');
  }

  whatRemainsUnknown.push('Private channel distributions (messaging apps, closed forums) cannot be tracked.');

  return {
    investigationId,
    events,
    totalEvents: events.length,
    earliestObservedAppearance,
    graph,
    clusters,
    contentFamilies,
    whatWeKnow,
    whatRemainsUnknown,
    isDemo: Boolean(inv?.isDemo)
  };
}

export function tracePropagationEvent(store, eventId) {
  const event = store.getPropagationEvent?.(eventId) || store.propagationEvents.get(eventId);
  if (!event) {
    throw new Error(`Propagation event not found: ${eventId}`);
  }

  const artifact = event.artifactId ? store.getArtifact(event.artifactId) : null;
  const source = event.sourceId ? store.getSource(event.sourceId) : null;
  const incoming = Array.from(store.propagationRelationships.values()).filter(r => r.toEventId === eventId);
  const outgoing = Array.from(store.propagationRelationships.values()).filter(r => r.fromEventId === eventId);

  return {
    event,
    artifact,
    source,
    incomingRelationships: incoming,
    outgoingRelationships: outgoing
  };
}
