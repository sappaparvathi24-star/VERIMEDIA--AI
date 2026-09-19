// VeriMedia AI — Propagation Intelligence & Timeline Graph (Phase J)
import { isPrivateOrBlockedIP } from '../proxy/requestProxy.js';

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
      events.push({
        id: app.id,
        investigationId,
        artifactId: app.artifactId,
        platform: src?.platform || 'Web',
        url: src?.url || null,
        publishedAt: app.publishedAt,
        observedAt: app.observedAt,
        eventType: 'OBSERVED_APPEARANCE',
        confidence: 0.85,
        limitations: ['Extracted from baseline appearances timeline.']
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
      eventType: e.eventType
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

  const whatWeKnow = [];
  const whatRemainsUnknown = [];

  if (events.length > 0) {
    whatWeKnow.push(`Observed ${events.length} propagation events across ${clusters.length} platform(s).`);
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
