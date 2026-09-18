// test/test_phase_j.js
// VeriMedia AI — Phase J Test Suite: Propagation Intelligence & Spread Analysis
import assert from 'assert';
import {
  ProvenanceStore,
  PropagationEventType,
  PropagationRelationshipType,
  PropagationEpistemicStatus,
  AppearanceStatus,
  EvidencePolarity,
  PROHIBITED_CERTAINTY_TERMS
} from '../src/provenance/core.js';
import {
  analyzePropagation,
  tracePropagationEvent,
  validatePropagationUrl
} from '../src/provenance/propagation.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase J Tests: Propagation Intelligence & Spread Analysis ──\n');

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// TEST 1: PropagationEvent Creation with Full Schema
// ---------------------------------------------------------------------------
runTest('Test 1: PropagationEvent creation stores all required structured fields', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Propagation Schema Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'video.mp4' });

  const evt = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: 'SRC-TEST-01',
    accountId: '@sports_fan_99',
    platform: 'TikTok',
    url: 'https://tiktok.com/@sports_fan_99/video/12345',
    eventType: PropagationEventType.REPOST,
    observedAt: '2026-08-15T10:00:00Z',
    publishedAt: '2026-08-15T09:30:00Z',
    retrievedAt: '2026-08-15T10:05:00Z',
    confidence: 0.90,
    epistemicStatus: PropagationEpistemicStatus.OBSERVED
  });

  assert.strictEqual(evt.investigationId, inv.id);
  assert.strictEqual(evt.artifactId, art.id);
  assert.strictEqual(evt.accountId, '@sports_fan_99');
  assert.strictEqual(evt.platform, 'TikTok');
  assert.strictEqual(evt.eventType, PropagationEventType.REPOST);
  assert.strictEqual(evt.publishedAt, '2026-08-15T09:30:00Z');
  assert(evt.independenceGroup.startsWith('IG-'), 'Must assign independence group');
  assert(Array.isArray(evt.limitations), 'Must contain limitations array');
  assert(evt.limitations.length > 0, 'Limitations must not be empty');
});

// ---------------------------------------------------------------------------
// TEST 2: PropagationEvent Default Limitations Enforce Epistemic Humility
// ---------------------------------------------------------------------------
runTest('Test 2: PropagationEvent default limitations avoid authorial origin claims', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Limitation Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  const evt = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'YouTube'
  });

  const limStr = evt.limitations.join(' ');
  assert(limStr.includes('does not establish authorial origin'), 'Must declare origin limitation');
  assert(limStr.includes('does not demonstrate causation'), 'Must declare causation limitation');
});

// ---------------------------------------------------------------------------
// TEST 3: PropagationRelationship Links Events with Direction and Limitations
// ---------------------------------------------------------------------------
runTest('Test 3: PropagationRelationship links events with explicit epistemic limitations', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Relationship Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'test.mp4' });

  const e1 = store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'Broadcast' });
  const e2 = store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'Twitter' });

  const rel = store.createPropagationRelationship({
    investigationId: inv.id,
    fromEventId: e1.id,
    toEventId: e2.id,
    relationshipType: PropagationRelationshipType.OBSERVED_BEFORE,
    confidence: 0.85
  });

  assert.strictEqual(rel.fromEventId, e1.id);
  assert.strictEqual(rel.toEventId, e2.id);
  assert.strictEqual(rel.relationshipType, PropagationRelationshipType.OBSERVED_BEFORE);
  assert(rel.limitations.some(l => l.includes('does not prove direct causation or copying')));
});

// ---------------------------------------------------------------------------
// TEST 4: analyzePropagation Ingests and Synthesizes Appearances
// ---------------------------------------------------------------------------
runTest('Test 4: analyzePropagation synthesizes appearances and discovery candidates into events', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Ingestion Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'match.mp4' });
  const src = store.createSource({ name: 'News Corp', platform: 'Web', url: 'https://newscorp.example.com/item' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    observedAt: '2026-08-12T14:00:00Z',
    publishedAt: '2026-08-12T13:30:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  assert.strictEqual(prop.totalEvents, 1);
  assert.strictEqual(prop.events[0].sourceId, src.id);
  assert.strictEqual(prop.events[0].platform, 'Web');
});

// ---------------------------------------------------------------------------
// TEST 5: Fallback to OBSERVED_APPEARANCE or UNKNOWN when evidence is missing
// ---------------------------------------------------------------------------
runTest('Test 5: Ingested events default to OBSERVED_APPEARANCE without assuming repost or syndication without evidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Fallback Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'raw.mp4' });
  const src = store.createSource({ name: 'Generic Portal', platform: 'Portal' });

  store.createAppearance({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    observedAt: '2026-08-13T10:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  assert.strictEqual(prop.events[0].eventType, PropagationEventType.OBSERVED_APPEARANCE);
});

// ---------------------------------------------------------------------------
// TEST 6: Temporal Analysis Correctly Identifies Earliest Observed Appearance
// ---------------------------------------------------------------------------
runTest('Test 6: Temporal analysis identifies the earliest observed appearance on record', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Earliest Appearance Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'feed.mp4' });

  const eLate = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Instagram',
    publishedAt: '2026-08-15T12:00:00Z'
  });
  const eEarly = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Broadcaster TV',
    publishedAt: '2026-08-11T18:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  assert.strictEqual(prop.earliestObservedAppearance.id, eEarly.id);
  assert.strictEqual(prop.earliestObservedAppearance.publishedAt, '2026-08-11T18:00:00Z');
});

// ---------------------------------------------------------------------------
// TEST 7: Chronological Ordering Creates OBSERVED_BEFORE Relationships
// ---------------------------------------------------------------------------
runTest('Test 7: Chronological ordering creates OBSERVED_BEFORE relationships between observed sightings', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Chronological Ordering Test' });
  const artA = store.createArtifact({ investigationId: inv.id, filename: 'master.mp4' });
  const artB = store.createArtifact({ investigationId: inv.id, filename: 'reencode.mp4' });

  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: artA.id,
    platform: 'Broadcast',
    publishedAt: '2026-08-11T18:00:00Z'
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: artB.id,
    platform: 'Broadcast Web Portal',
    publishedAt: '2026-08-14T10:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  assert(prop.relationships.length > 0, 'Must generate pairwise relationships');
  const rel = prop.relationships.find(r => r.relationshipType === PropagationRelationshipType.OBSERVED_BEFORE);
  assert(rel, 'Must find OBSERVED_BEFORE relationship');
  assert.strictEqual(rel.epistemicStatus, PropagationEpistemicStatus.SUPPORTED);
});

// ---------------------------------------------------------------------------
// TEST 8: Explicit Causation Limitation is Attached to Precedence
// ---------------------------------------------------------------------------
runTest('Test 8: Explicit causation limitation is attached to temporal precedence relationships', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Causation Boundary Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'media.mp4' });

  const e1 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    publishedAt: '2026-08-10T00:00:00Z'
  });
  const e2 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    publishedAt: '2026-08-12T00:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const rel = prop.relationships.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
  assert(rel, 'Relationship must exist');
  assert(rel.limitations.some(l => l.includes('not authorial creation or causal copying')));
});

// ---------------------------------------------------------------------------
// TEST 9: Conflicting Publication Timestamps Result in INCONCLUSIVE Status
// ---------------------------------------------------------------------------
runTest('Test 9: Conflicting timestamps result in INCONCLUSIVE relationship without silent resolution', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Conflict Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'conflict.mp4' });

  const e1 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    publishedAt: '2026-08-10T00:00:00Z',
    epistemicStatus: PropagationEpistemicStatus.INCONCLUSIVE
  });
  const e2 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    publishedAt: '2026-08-12T00:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const rel = prop.relationships.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
  assert.strictEqual(rel.epistemicStatus, PropagationEpistemicStatus.INCONCLUSIVE);
});

// ---------------------------------------------------------------------------
// TEST 10: Missing Timestamps Yield UNKNOWN Relationship
// ---------------------------------------------------------------------------
runTest('Test 10: Missing publication timestamps yield UNKNOWN relationship status', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Missing Timestamps' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'unknown.mp4' });

  const e1 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    observedAt: null,
    publishedAt: null
  });
  const e2 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    observedAt: null,
    publishedAt: null
  });

  // Force null observedAt to test complete absence
  e1.observedAt = null;
  e2.observedAt = null;

  const prop = analyzePropagation(store, inv.id);
  const rel = prop.relationships.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
  assert.strictEqual(rel.relationshipType, PropagationRelationshipType.UNKNOWN);
  assert.strictEqual(rel.epistemicStatus, PropagationEpistemicStatus.UNKNOWN);
});

// ---------------------------------------------------------------------------
// TEST 11: Shared Independence Group Creates POSSIBLE_SYNDICATION Relationship
// ---------------------------------------------------------------------------
runTest('Test 11: Shared independence group creates POSSIBLE_SYNDICATION relationship', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Syndication Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'wire.mp4' });

  const e1 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Site A',
    independenceGroup: 'IG-WIRE-GLOBAL',
    publishedAt: '2026-08-11T12:00:00Z'
  });
  const e2 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Site B',
    independenceGroup: 'IG-WIRE-GLOBAL',
    publishedAt: '2026-08-11T12:05:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const rel = prop.relationships.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
  assert.strictEqual(rel.relationshipType, PropagationRelationshipType.POSSIBLE_SYNDICATION);
  assert.strictEqual(rel.independenceGroup, 'IG-WIRE-GLOBAL');
});

// ---------------------------------------------------------------------------
// TEST 12: Shared Independence Group Note Declares Common Underlying Evidence
// ---------------------------------------------------------------------------
runTest('Test 12: Propagation clusters explain that shared independence sources contain the same underlying evidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Syndication Explanatory Note' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Portal 1',
    independenceGroup: 'IG-SYND-NETWORK',
    publishedAt: '2026-08-10T10:00:00Z'
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Portal 2',
    independenceGroup: 'IG-SYND-NETWORK',
    publishedAt: '2026-08-10T10:02:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const syndClust = prop.clusters.find(c => c.clusterType === 'SYNDICATION_AND_DUPLICATION_CLUSTER');
  assert(syndClust, 'Syndication cluster must be present');
  assert(syndClust.description.includes('Several sources contain the same underlying evidence.'));
  assert(syndClust.limitations.some(l => l.includes('do not constitute independent confirmations')));
});

// ---------------------------------------------------------------------------
// TEST 13: Identical Media SHA-256 Hash Forms Identity Cluster
// ---------------------------------------------------------------------------
runTest('Test 13: Identical SHA-256 hash forms a media identity cluster', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Hash Cluster Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'exact.mp4',
    sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  });

  store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'Platform 1' });
  store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'Platform 2' });

  const prop = analyzePropagation(store, inv.id);
  const idClust = prop.clusters.find(c => c.clusterType === 'MEDIA_IDENTITY_CLUSTER');
  assert(idClust, 'Identity cluster must exist');
  assert.strictEqual(idClust.eventCount, 2);
  assert(idClust.description.includes('abcdef123456...'));
});

// ---------------------------------------------------------------------------
// TEST 14: Cross-Platform Appearance Creates POSSIBLE_REPOST
// ---------------------------------------------------------------------------
runTest('Test 14: Same artifact across different platforms creates POSSIBLE_REPOST relationship', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Repost Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'viral.mp4' });

  const e1 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Original Web',
    publishedAt: '2026-08-11T12:00:00Z'
  });
  const e2 = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'TikTok',
    publishedAt: '2026-08-14T12:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const rel = prop.relationships.find(r => r.fromEventId === e1.id && r.toEventId === e2.id);
  assert.strictEqual(rel.relationshipType, PropagationRelationshipType.POSSIBLE_REPOST);
});

// ---------------------------------------------------------------------------
// TEST 15: Spread Analysis Graph Contains Typed Nodes and Edges
// ---------------------------------------------------------------------------
runTest('Test 15: Propagation Graph contains typed nodes (Event, Platform, Source, Account, Artifact) and edges', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Graph Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'doc.mp4' });
  const src = store.createSource({ name: 'Broadcaster', domain: 'broadcaster.com', platform: 'Broadcast Network' });

  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    accountId: '@official_broadcaster',
    platform: 'Broadcast Network',
    publishedAt: '2026-08-11T18:00:00Z'
  });

  const prop = analyzePropagation(store, inv.id);
  const g = prop.graph;
  assert(g.nodeCount >= 4, 'Must contain at least 4 nodes');
  assert(g.nodes.some(n => n.type === 'PROPAGATION_EVENT'));
  assert(g.nodes.some(n => n.type === 'PLATFORM'));
  assert(g.nodes.some(n => n.type === 'SOURCE'));
  assert(g.nodes.some(n => n.type === 'ACCOUNT'));
  assert(g.nodes.some(n => n.type === 'MEDIA_ARTIFACT'));
  assert(g.edges.some(e => e.edgeType === 'POSTED_BY_ACCOUNT'));
  assert(g.edges.some(e => e.edgeType === 'OBSERVED_AT_SOURCE'));
});

// ---------------------------------------------------------------------------
// TEST 16: Propagation Timeline Filtering by Platform, Source, and Status
// ---------------------------------------------------------------------------
runTest('Test 16: Propagation Timeline filters by platform, sourceId, and epistemicStatus', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Timeline Filter Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'vid.mp4' });

  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'TikTok',
    sourceId: 'SRC-TK-01',
    epistemicStatus: PropagationEpistemicStatus.OBSERVED
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Twitter',
    sourceId: 'SRC-TW-01',
    epistemicStatus: PropagationEpistemicStatus.INCONCLUSIVE
  });

  const filteredByPlat = analyzePropagation(store, inv.id, { platform: 'TikTok' });
  assert.strictEqual(filteredByPlat.events.length, 1);
  assert.strictEqual(filteredByPlat.events[0].platform, 'TikTok');

  const filteredByStatus = analyzePropagation(store, inv.id, { evidenceStatus: PropagationEpistemicStatus.INCONCLUSIVE });
  assert.strictEqual(filteredByStatus.events.length, 1);
  assert.strictEqual(filteredByStatus.events[0].platform, 'Twitter');
});

// ---------------------------------------------------------------------------
// TEST 17: Cluster Disclaimers Enforce Epistemic Limits on Authorship
// ---------------------------------------------------------------------------
runTest('Test 17: Cluster limitations declare that clustering does not prove common authorship or coordinated action', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Cluster Disclaimer Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'clip.mp4' });

  store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'P1' });
  store.createPropagationEvent({ investigationId: inv.id, artifactId: art.id, platform: 'P2' });

  const prop = analyzePropagation(store, inv.id);
  const clust = prop.clusters[0];
  assert(clust.limitations.some(l => l.includes('does not prove coordinated action') || l.includes('does not prove common authorship')));
});

// ---------------------------------------------------------------------------
// TEST 18: Demo Scenario Isolation
// ---------------------------------------------------------------------------
runTest('Test 18: Real investigations strictly exclude demo propagation entities and demo disclaimers are preserved', () => {
  const store = new ProvenanceStore();
  const realInv = store.createInvestigation({ title: 'Real Inv', isDemo: false });
  const demoInv = store.createInvestigation({ title: 'Demo Inv', isDemo: true });

  const realArt = store.createArtifact({ investigationId: realInv.id, filename: 'real.mp4', isDemo: false });
  const demoArt = store.createArtifact({ investigationId: demoInv.id, filename: 'demo.mp4', isDemo: true });

  store.createPropagationEvent({
    investigationId: realInv.id,
    artifactId: realArt.id,
    platform: 'Real News',
    isDemo: false
  });
  store.createPropagationEvent({
    investigationId: demoInv.id,
    artifactId: demoArt.id,
    platform: 'Demo Simulated Platform',
    isDemo: true
  });

  const realProp = analyzePropagation(store, realInv.id);
  assert.strictEqual(realProp.isDemo, false);
  assert.strictEqual(realProp.events.length, 1);
  assert.strictEqual(realProp.events[0].isDemo, false);

  const demoProp = analyzePropagation(store, demoInv.id);
  assert.strictEqual(demoProp.isDemo, true);
  assert(demoProp.events[0].limitations.some(l => l.includes('DEMO SCENARIO')));
});

// ---------------------------------------------------------------------------
// TEST 19: Traceability Chain for Propagation Events
// ---------------------------------------------------------------------------
runTest('Test 19: tracePropagationEvent traces event -> evidence -> observation -> analysis run -> method', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Traceability Test' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'trace.mp4' });
  const src = store.createSource({ name: 'Verified Broadcaster', platform: 'Broadcast Network' });

  const run = store.createAnalysisRun({
    investigationId: inv.id,
    artifactId: art.id,
    method: 'BROADCAST_METADATA_EXTRACTOR'
  });

  const obs = store.createObservation({
    runId: run.id,
    artifactId: art.id,
    observationType: 'BROADCAST_AIR_TIMESTAMP',
    value: '2026-08-11T18:00:00Z'
  });

  const ev = store.createEvidence({
    observationIds: [obs.id],
    independenceGroupId: 'IG-SRC-BROADCASTER',
    evidenceType: 'AUTHENTICATED_PROGRAM_LOG',
    confidence: 0.95
  });

  const evt = store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    sourceId: src.id,
    platform: 'Broadcast Network',
    evidenceIds: [ev.id]
  });

  const trace = tracePropagationEvent(store, evt.id);
  assert.strictEqual(trace.event.id, evt.id);
  assert.strictEqual(trace.evidence[0].id, ev.id);
  assert.strictEqual(trace.observations[0].id, obs.id);
  assert.strictEqual(trace.analysisRuns[0].id, run.id);
  assert.strictEqual(trace.analysisMethods[0].method, 'BROADCAST_METADATA_EXTRACTOR');
  assert.strictEqual(trace.source.id, src.id);
  assert.strictEqual(trace.artifact.id, art.id);
});

// ---------------------------------------------------------------------------
// TEST 20: SSRF and Security URL Validation
// ---------------------------------------------------------------------------
runTest('Test 20: validatePropagationUrl blocks SSRF, private IPs, and link-local addresses', () => {
  const badUrls = [
    'http://localhost:3000/leak',
    'http://127.0.0.1/admin',
    'http://10.0.0.1/internal',
    'http://172.16.0.5/api',
    'http://192.168.1.1/router',
    'http://169.254.169.254/latest/meta-data',
    'http://metadata.google.internal/computeMetadata',
    'ftp://public.com/file'
  ];

  for (const url of badUrls) {
    const res = validatePropagationUrl(url);
    assert.strictEqual(res.valid, false, `Must block insecure URL: ${url}`);
  }

  const goodUrl = 'https://news.example.com/world/2026/broadcast-item';
  const goodRes = validatePropagationUrl(goodUrl);
  assert.strictEqual(goodRes.valid, true);
  assert.strictEqual(goodRes.hostname, 'news.example.com');
});

// ---------------------------------------------------------------------------
// TEST 21: Prohibited Certainty Terms Audit for Propagation
// ---------------------------------------------------------------------------
runTest('Test 21: Propagation outputs strictly avoid prohibited certainty terms', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Prohibited Words Audit' });
  const art = store.createArtifact({ investigationId: inv.id, filename: 'audit.mp4' });

  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Web'
  });

  const prop = analyzePropagation(store, inv.id);
  const fullText = JSON.stringify(prop).toUpperCase();

  for (const prohibited of PROHIBITED_CERTAINTY_TERMS) {
    assert(
      !fullText.includes(prohibited.toUpperCase()),
      `Found prohibited certainty term "${prohibited}" in propagation output`
    );
  }
});

// ---------------------------------------------------------------------------
// TEST 22: Seeded Real Case CHAMP Verification
// ---------------------------------------------------------------------------
runTest('Test 22: ProvenanceService returns valid propagation intelligence for seeded INV-VM-2026-CHAMP', () => {
  const prop = provenanceService.getPropagation('INV-VM-2026-CHAMP');
  assert(prop.totalEvents >= 2, 'Must have at least 2 propagation events');
  assert(prop.earliestObservedAppearance, 'Must identify earliest observed appearance');
  assert(prop.graph.nodeCount >= 4, 'Graph must contain platform, source, account, event nodes');
  assert(prop.clusters.length >= 1, 'Must synthesize clusters');
  assert.strictEqual(prop.isDemo, false);
});

console.log(`\n🎉 All ${passed}/22 Phase J Tests Passed Successfully!\n`);
