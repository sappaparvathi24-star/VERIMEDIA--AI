// VeriMedia AI — Propagation Intelligence & Spread Analysis (Phase J)
import {
  PropagationEventType,
  PropagationRelationshipType,
  PropagationEpistemicStatus,
  EvidencePolarity,
  AppearanceStatus
} from './core.js';

/**
 * Validates and sanitizes a URL against SSRF attacks.
 */
export function validatePropagationUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return { valid: false, error: 'Malformed URL structure' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Protocol must be HTTP or HTTPS' };
  }

  const rawHost = parsed.hostname.toLowerCase();
  const hostname = rawHost.replace(/^\[|\]$/g, '');
  const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal', 'metadata'];
  if (blockedHosts.includes(rawHost) || blockedHosts.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname === '::1' || hostname === '::') {
    return { valid: false, error: 'Access to internal/private network addresses is blocked' };
  }

  // Check IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const octets = ipMatch.slice(1, 5).map(Number);
    if (octets[0] === 10) return { valid: false, error: 'Access to private IP range 10.0.0.0/8 is blocked' };
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return { valid: false, error: 'Access to private IP range 172.16.0.0/12 is blocked' };
    if (octets[0] === 192 && octets[1] === 168) return { valid: false, error: 'Access to private IP range 192.168.0.0/16 is blocked' };
    if (octets[0] === 169 && octets[1] === 254) return { valid: false, error: 'Access to link-local IP range 169.254.0.0/16 is blocked' };
  }

  return { valid: true, sanitizedUrl: parsed.toString(), hostname, protocol: parsed.protocol };
}

/**
 * Synthesizes and analyzes propagation events, relationships, clusters,
 * timeline, and graph for an investigation (Phase J).
 */
export function analyzePropagation(store, investigationId, options = {}) {
  const investigation = store.getInvestigation(investigationId);
  if (!investigation) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  const isDemo = Boolean(investigation.isDemo);

  // 1. Gather all existing propagation events in store for this investigation
  let existingEvents = store.getPropagationEventsByInvestigation(investigationId);
  if (!isDemo) {
    existingEvents = existingEvents.filter(e => !e.isDemo);
  }

  // 2. Ingest / Synchronize from appearances if not already present
  const appearances = store.getAppearancesByInvestigation(investigationId)
    .filter(app => isDemo ? true : !app.metadata?.isDemo);

  for (const app of appearances) {
    const existingEvt = existingEvents.find(e => e.id === `PEVT-${app.id}` || e.metadata?.appearanceId === app.id);
    if (!existingEvt) {
      const src = store.getSource(app.sourceId);
      const art = store.getArtifact(app.artifactId);
      const evItem = (app.evidenceIds || []).map(id => store.getEvidence(id)).find(Boolean);
      const indGroup = evItem?.independenceGroupId || src?.metadata?.independenceGroup || (src?.quality?.independentlyObserved === false ? 'IG-SYNDICATED' : `IG-${app.sourceId}`);

      let eventType = PropagationEventType.OBSERVED_APPEARANCE;
      if (src?.quality?.isFirstParty) {
        eventType = PropagationEventType.PUBLICATION;
      } else if (src?.quality?.independentlyObserved === false) {
        eventType = PropagationEventType.SYNDICATION;
      } else if (src?.type === 'SOCIAL_POST' || src?.platform?.toLowerCase().includes('tiktok') || src?.platform?.toLowerCase().includes('twitter')) {
        eventType = PropagationEventType.REPOST;
      }

      const newEvt = store.createPropagationEvent({
        id: `PEVT-${app.id}`,
        investigationId,
        artifactId: app.artifactId,
        sourceId: app.sourceId,
        accountId: src?.metadata?.accountId || src?.metadata?.handle || null,
        platform: src?.platform || 'Web',
        url: src?.url || null,
        eventType,
        observedAt: app.observedAt,
        publishedAt: app.publishedAt,
        retrievedAt: app.retrievedAt,
        independenceGroup: indGroup,
        evidenceIds: app.evidenceIds || [],
        confidence: evItem?.confidence || 0.85,
        epistemicStatus: app.status === AppearanceStatus.CONFLICTING ? PropagationEpistemicStatus.INCONCLUSIVE : PropagationEpistemicStatus.OBSERVED,
        isDemo,
        metadata: {
          appearanceId: app.id,
          sourceName: src?.name,
          sourceDomain: src?.domain,
          artifactFilename: art?.filename
        }
      });
      existingEvents.push(newEvt);
    }
  }

  // 3. Ingest / Synchronize from discovery candidates if not already present
  const candidates = store.getDiscoveryCandidatesByInvestigation(investigationId)
    .filter(c => isDemo ? true : !c.isDemo);

  for (const cand of candidates) {
    const existingEvt = existingEvents.find(e => e.id === `PEVT-CND-${cand.id}` || e.metadata?.candidateId === cand.id);
    if (!existingEvt && cand.url) {
      let eventType = PropagationEventType.OBSERVED_APPEARANCE;
      if (cand.sourceCharacteristics?.syndication) {
        eventType = PropagationEventType.SYNDICATION;
      } else if (cand.sourceCharacteristics?.repost) {
        eventType = PropagationEventType.REPOST;
      } else if (cand.sourceCharacteristics?.archive) {
        eventType = PropagationEventType.MIRROR;
      }

      const newEvt = store.createPropagationEvent({
        id: `PEVT-CND-${cand.id}`,
        investigationId,
        artifactId: cand.artifactId,
        sourceId: cand.sourceId,
        accountId: cand.metadata?.accountId || null,
        platform: cand.platform || 'Web',
        url: cand.url,
        eventType,
        observedAt: cand.discoveredAt || cand.retrievedAt,
        publishedAt: cand.publishedAt,
        retrievedAt: cand.retrievedAt,
        independenceGroup: cand.independenceGroup || `IG-${cand.id}`,
        evidenceIds: cand.evidenceIds || [],
        confidence: 0.80,
        epistemicStatus: cand.status === 'INCONCLUSIVE' ? PropagationEpistemicStatus.INCONCLUSIVE : PropagationEpistemicStatus.SUPPORTED,
        isDemo,
        metadata: {
          candidateId: cand.id,
          discoveryJobId: cand.discoveryJobId,
          sourceName: cand.title,
          relationshipType: cand.relationshipType
        }
      });
      existingEvents.push(newEvt);
    }
  }

  // 4. Temporal Analysis & Event Ordering
  const sortedEvents = [...existingEvents].sort((a, b) => {
    const timeA = new Date(a.publishedAt || a.observedAt).getTime() || 0;
    const timeB = new Date(b.publishedAt || b.observedAt).getTime() || 0;
    return timeA - timeB;
  });

  // Identify Earliest Observed Appearance
  const earliestObservedAppearance = sortedEvents.length > 0 ? sortedEvents[0] : null;

  // 5. Generate / Synthesize Propagation Relationships between events
  const relationships = [];
  const existingRels = store.getPropagationRelationshipsByInvestigation(investigationId)
    .filter(r => isDemo ? true : !r.isDemo);

  // Analyze pairwise relationships
  for (let i = 0; i < sortedEvents.length; i++) {
    for (let j = i + 1; j < sortedEvents.length; j++) {
      const e1 = sortedEvents[i];
      const e2 = sortedEvents[j];

      // Check if relationship already stored
      const match = existingRels.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
      if (match) {
        relationships.push(match);
        continue;
      }

      const time1 = new Date(e1.publishedAt || e1.observedAt).getTime();
      const time2 = new Date(e2.publishedAt || e2.observedAt).getTime();

      let relType = PropagationRelationshipType.UNKNOWN;
      let epistemicStatus = PropagationEpistemicStatus.SUPPORTED;
      let confidence = 0.75;
      const combinedEvIds = Array.from(new Set([...(e1.evidenceIds || []), ...(e2.evidenceIds || [])]));

      // Determine relationship nature
      if (e1.independenceGroup === e2.independenceGroup && e1.independenceGroup !== `IG-${e1.id}`) {
        relType = PropagationRelationshipType.POSSIBLE_SYNDICATION;
        confidence = 0.88;
      } else if (e1.artifactId === e2.artifactId && e1.platform !== e2.platform) {
        relType = PropagationRelationshipType.POSSIBLE_REPOST;
        confidence = 0.82;
      } else if (time1 && time2 && time1 < time2) {
        relType = PropagationRelationshipType.OBSERVED_BEFORE;
        confidence = 0.80;
      } else if (!time1 || !time2) {
        relType = PropagationRelationshipType.UNKNOWN;
        epistemicStatus = PropagationEpistemicStatus.UNKNOWN;
        confidence = 0.40;
      }

      // Check for timestamp contradiction
      if (e1.epistemicStatus === PropagationEpistemicStatus.INCONCLUSIVE || e2.epistemicStatus === PropagationEpistemicStatus.INCONCLUSIVE) {
        epistemicStatus = PropagationEpistemicStatus.INCONCLUSIVE;
      }

      const relRecord = store.createPropagationRelationship({
        id: `PREL-${e1.id}-${e2.id}`,
        investigationId,
        fromEventId: e1.id,
        toEventId: e2.id,
        relationshipType: relType,
        evidenceIds: combinedEvIds,
        confidence,
        epistemicStatus,
        independenceGroup: e1.independenceGroup === e2.independenceGroup ? e1.independenceGroup : 'MULTIPLE_INDEPENDENCE_GROUPS',
        limitations: [
          'Temporal observation precedence indicates chronological discovery order only, not authorial creation or causal copying.',
          'Similarity across platforms indicates related media distribution, not proof of identity of the uploader.'
        ],
        measurements: {
          timeDeltaSeconds: (!isNaN(time1) && !isNaN(time2)) ? Math.round((time2 - time1) / 1000) : null,
          sameIndependenceGroup: e1.independenceGroup === e2.independenceGroup
        },
        isDemo
      });

      relationships.push(relRecord);
    }
  }

  // 6. Propagation Clusters ("Spread Clusters")
  const clusters = buildPropagationClusters(store, investigationId, sortedEvents, isDemo);

  // 7. Propagation Graph ("Spread Analysis Graph")
  const graph = buildPropagationGraph(store, investigationId, sortedEvents, relationships, isDemo);

  // 8. Filtered Timeline
  let filteredEvents = [...sortedEvents];
  if (options.platform) {
    filteredEvents = filteredEvents.filter(e => e.platform.toLowerCase() === options.platform.toLowerCase());
  }
  if (options.sourceId) {
    filteredEvents = filteredEvents.filter(e => e.sourceId === options.sourceId);
  }
  if (options.accountId) {
    filteredEvents = filteredEvents.filter(e => e.accountId === options.accountId);
  }
  if (options.evidenceStatus) {
    filteredEvents = filteredEvents.filter(e => e.epistemicStatus === options.evidenceStatus);
  }

  // Compile What We Know & What Remains Unknown for Propagation
  const whatWeKnow = [];
  const whatRemainsUnknown = [];

  if (sortedEvents.length > 0) {
    const platforms = Array.from(new Set(sortedEvents.map(e => e.platform).filter(Boolean)));
    const indGroups = Array.from(new Set(sortedEvents.map(e => e.independenceGroup).filter(Boolean)));
    whatWeKnow.push(`Observed ${sortedEvents.length} media appearance event(s) across ${platforms.length} platform(s) (${platforms.join(', ')}).`);
    whatWeKnow.push(`Identified ${indGroups.length} distinct independence group(s) across distribution channels.`);
  }

  if (earliestObservedAppearance) {
    const e = earliestObservedAppearance;
    whatWeKnow.push(`Earliest observed appearance in evidence occurred on ${e.publishedAt || e.observedAt} via ${e.platform} (${e.metadata?.sourceName || e.sourceId}).`);
  }

  whatRemainsUnknown.push('The initial creation and publication moment and creator device cannot be determined from public platform observations alone.');
  whatRemainsUnknown.push('Preceding appearances on private, unindexed, or deleted channels remain unobserved.');

  return {
    investigationId,
    totalEvents: sortedEvents.length,
    events: filteredEvents,
    allEvents: sortedEvents,
    earliestObservedAppearance,
    relationships,
    clusters,
    graph,
    whatWeKnow,
    whatRemainsUnknown,
    isDemo,
    epistemicBoundaries: [
      'OBSERVED APPEARANCE: Directly verified appearance on a specific platform at a specific timestamp.',
      'TEMPORAL PRECEDENCE: A observed before B does not establish that B copied A or that A is the creator.',
      'SYNDICATION: Shared wire or aggregator metadata indicates non-independent copies.',
      'DEMO ISOLATION: Demo scenarios remain strictly isolated from real investigations.'
    ]
  };
}

/**
 * Builds analytical propagation clusters based on common signals.
 */
function buildPropagationClusters(store, investigationId, events, isDemo) {
  const clusters = [];

  // Group 1: By Artifact ID (Exact Hash / Identity Cluster)
  const byArtifact = new Map();
  for (const evt of events) {
    if (!byArtifact.has(evt.artifactId)) byArtifact.set(evt.artifactId, []);
    byArtifact.get(evt.artifactId).push(evt);
  }

  for (const [artId, artEvents] of byArtifact.entries()) {
    const art = store.getArtifact(artId);
    clusters.push({
      id: `CLUST-ART-${artId}`,
      clusterType: 'MEDIA_IDENTITY_CLUSTER',
      title: `Identical Media Cluster: ${art?.filename || artId}`,
      description: `Observed appearances sharing exact SHA-256 hash (${art?.sha256 ? art.sha256.substring(0, 12) + '...' : 'N/A'}).`,
      eventIds: artEvents.map(e => e.id),
      eventCount: artEvents.length,
      platforms: Array.from(new Set(artEvents.map(e => e.platform))),
      limitations: [
        'Identical hash verifies bitwise equivalence, not the original publishing author.',
        'Analytical cluster groups shared technical properties; does not prove coordinated action.'
      ],
      isDemo
    });
  }

  // Group 2: By Independence Group (Syndication / Shared Distribution Cluster)
  const byIndGroup = new Map();
  for (const evt of events) {
    if (evt.independenceGroup) {
      if (!byIndGroup.has(evt.independenceGroup)) byIndGroup.set(evt.independenceGroup, []);
      byIndGroup.get(evt.independenceGroup).push(evt);
    }
  }

  for (const [indGroup, grpEvents] of byIndGroup.entries()) {
    if (grpEvents.length > 1) {
      clusters.push({
        id: `CLUST-IND-${indGroup}`,
        clusterType: 'SYNDICATION_AND_DUPLICATION_CLUSTER',
        title: `Shared Distribution Cluster (${indGroup})`,
        description: `${grpEvents.length} appearances belong to the same underlying independence group (syndicated network or mirror). Several sources contain the same underlying evidence.`,
        eventIds: grpEvents.map(e => e.id),
        eventCount: grpEvents.length,
        platforms: Array.from(new Set(grpEvents.map(e => e.platform))),
        limitations: [
          'Appearances within this cluster share underlying source dependencies and do not constitute independent confirmations.',
          'Syndication reflects distribution agreements or mirroring, not separate original investigations.'
        ],
        isDemo
      });
    }
  }

  // Group 3: By Platform (Platform Distribution Cluster)
  const byPlatform = new Map();
  for (const evt of events) {
    if (evt.platform) {
      if (!byPlatform.has(evt.platform)) byPlatform.set(evt.platform, []);
      byPlatform.get(evt.platform).push(evt);
    }
  }

  for (const [platform, platEvents] of byPlatform.entries()) {
    clusters.push({
      id: `CLUST-PLAT-${platform.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`,
      clusterType: 'COMMUNITY_PLATFORM_CLUSTER',
      title: `Platform Distribution: ${platform}`,
      description: `Observed ${platEvents.length} appearance(s) hosted on ${platform}.`,
      eventIds: platEvents.map(e => e.id),
      eventCount: platEvents.length,
      platforms: [platform],
      limitations: [
        'Analytical cluster groups appearances on the same hosting platform.',
        'Platform clustering does not prove common ownership or coordinated action.'
      ],
      isDemo
    });
  }

  return clusters;
}

/**
 * Builds the Spread Analysis Graph with typed nodes and edges.
 */
function buildPropagationGraph(store, investigationId, events, relationships, isDemo) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Set();

  function addNode(node) {
    if (!nodeMap.has(node.id)) {
      nodeMap.add(node.id);
      nodes.push(node);
    }
  }

  // 1. Create Event Nodes
  for (const evt of events) {
    addNode({
      id: evt.id,
      type: 'PROPAGATION_EVENT',
      label: `${evt.platform} - ${evt.eventType}`,
      eventType: evt.eventType,
      platform: evt.platform,
      url: evt.url,
      observedAt: evt.observedAt,
      publishedAt: evt.publishedAt,
      artifactId: evt.artifactId,
      sourceId: evt.sourceId,
      accountId: evt.accountId,
      independenceGroup: evt.independenceGroup,
      confidence: evt.confidence,
      epistemicStatus: evt.epistemicStatus
    });

    // Platform node
    if (evt.platform) {
      const platId = `NODE-PLAT-${evt.platform.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      addNode({
        id: platId,
        type: 'PLATFORM',
        label: evt.platform,
        name: evt.platform
      });

      edges.push({
        id: `EDGE-${evt.id}-${platId}`,
        from: evt.id,
        to: platId,
        edgeType: 'PUBLISHED_ON_PLATFORM',
        label: 'Platform Host'
      });
    }

    // Source node
    if (evt.sourceId && evt.sourceId !== 'UNKNOWN') {
      const src = store.getSource(evt.sourceId);
      const srcNodeId = `NODE-SRC-${evt.sourceId}`;
      addNode({
        id: srcNodeId,
        type: 'SOURCE',
        label: src?.name || evt.sourceId,
        domain: src?.domain,
        url: src?.url,
        isFirstParty: src?.quality?.isFirstParty || false
      });

      edges.push({
        id: `EDGE-${evt.id}-${srcNodeId}`,
        from: evt.id,
        to: srcNodeId,
        edgeType: 'OBSERVED_AT_SOURCE',
        label: 'Observed Source'
      });
    }

    // Account node (where available)
    if (evt.accountId) {
      const accNodeId = `NODE-ACC-${evt.accountId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      addNode({
        id: accNodeId,
        type: 'ACCOUNT',
        label: evt.accountId,
        platform: evt.platform
      });

      edges.push({
        id: `EDGE-${evt.id}-${accNodeId}`,
        from: evt.id,
        to: accNodeId,
        edgeType: 'POSTED_BY_ACCOUNT',
        label: 'Account Attribution'
      });
    }

    // Artifact node
    if (evt.artifactId) {
      const art = store.getArtifact(evt.artifactId);
      const artNodeId = `NODE-ART-${evt.artifactId}`;
      addNode({
        id: artNodeId,
        type: 'MEDIA_ARTIFACT',
        label: art?.filename || evt.artifactId,
        mimeType: art?.mimeType,
        dimensions: art?.dimensions
      });

      edges.push({
        id: `EDGE-${evt.id}-${artNodeId}`,
        from: evt.id,
        to: artNodeId,
        edgeType: 'DISPLAYS_ARTIFACT',
        label: 'Media Content'
      });
    }
  }

  // 2. Create Relationship Edges
  for (const rel of relationships) {
    edges.push({
      id: `EDGE-REL-${rel.id}`,
      from: rel.fromEventId,
      to: rel.toEventId,
      edgeType: rel.relationshipType,
      label: rel.relationshipType.replace(/_/g, ' '),
      confidence: rel.confidence,
      epistemicStatus: rel.epistemicStatus,
      independenceGroup: rel.independenceGroup,
      evidenceIds: rel.evidenceIds || [],
      limitations: rel.limitations || []
    });
  }

  return {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    isDemo
  };
}

/**
 * Traces a Propagation Event backwards through the evidence graph:
 * PropagationEvent -> Evidence -> Observation -> Source/Artifact -> AnalysisRun -> AnalysisMethod.
 */
export function tracePropagationEvent(store, eventId) {
  const event = store.getPropagationEvent(eventId);
  if (!event) {
    throw new Error(`Propagation event not found: ${eventId}`);
  }

  const linkedEvidence = (event.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);
  const observations = [];
  const analysisRuns = [];
  const methods = [];

  for (const ev of linkedEvidence) {
    for (const obsId of ev.observationIds || []) {
      const obs = store.getObservation(obsId);
      if (obs) {
        observations.push(obs);
        if (obs.runId) {
          const run = store.getAnalysisRun(obs.runId);
          if (run && !analysisRuns.some(r => r.id === run.id)) {
            analysisRuns.push(run);
            methods.push({
              runId: run.id,
              method: run.method,
              status: run.status
            });
          }
        }
      }
    }
  }

  const source = event.sourceId ? store.getSource(event.sourceId) : null;
  const artifact = event.artifactId ? store.getArtifact(event.artifactId) : null;

  return {
    event,
    evidence: linkedEvidence,
    observations,
    analysisRuns,
    analysisMethods: methods,
    source,
    artifact,
    traceabilityChain: {
      event: event.id,
      evidenceIds: linkedEvidence.map(e => e.id),
      observationIds: observations.map(o => o.id),
      analysisRunIds: analysisRuns.map(r => r.id),
      sourceId: source?.id || null,
      artifactId: artifact?.id || null
    }
  };
}
