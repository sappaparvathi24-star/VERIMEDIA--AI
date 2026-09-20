// test/test_phase_17_discovery_independence.js
// VeriMedia AI — Phase 17 Tests: Independence Group Deduplication & Sybil Defense

import assert from 'assert';
import { ProvenanceStore, EvidencePolarity, ClaimTypes } from '../src/provenance/core.js';
import { assessClaim, countIndependentEvidenceGroups } from '../src/provenance/claims.js';
import { MultiSourceDiscoveryManager } from '../src/matching/providers/index.js';
import { checkRateLimit } from '../src/proxy/searchProxy.js';

console.log('── Running VeriMedia AI Phase 17 Tests: Independence Group Deduplication & Sybil Defense ──');
let passed = 0;

function run(name, fn) {
  fn();
  passed++;
  console.log(`✔ [PASS] Test ${passed}: ${name}`);
}

// 1. Sybil / Repost Collapsing (100 Reposts = 1 Independent Group)
run('Sybil Defense: 100 syndicated reposts collapse to 1 independent evidence channel', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Sybil Amplification Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'viral_clip.mp4',
    sha256: 'b'.repeat(64),
    mimeType: 'video/mp4'
  });

  const evidenceIds = [];
  const sharedGroupId = 'IG-SYNDICATED-NETWORK-NEWSWIRE-01';

  // Create 100 separate observation and evidence items sharing the SAME independence group
  for (let i = 1; i <= 100; i++) {
    const obs = store.createObservation({
      observationType: 'SOCIAL_REPOST_OBSERVED',
      target: `https://aggregator-site-${i}.net/video/123`,
      value: { platform: 'Aggregator', viewCount: i * 100 }
    });

    const ev = store.createEvidence({
      observationIds: [obs.id],
      independenceGroupId: sharedGroupId,
      evidenceType: 'EXTERNAL_PUBLICATION_CLAIM',
      description: `Syndicated repost appearance #${i} on aggregator network`,
      confidence: 0.90,
      polarity: EvidencePolarity.SUPPORTING
    });
    evidenceIds.push(ev.id);
  }

  assert.strictEqual(evidenceIds.length, 100);

  // Assert countIndependentEvidenceGroups collapses them
  const groupAssessment = countIndependentEvidenceGroups(store, evidenceIds);
  assert.strictEqual(groupAssessment.groupCount, 1, '100 syndicated evidence items must collapse to exactly 1 group');
  assert.strictEqual(groupAssessment.groups[0].count, 100);
  assert.strictEqual(groupAssessment.groups[0].groupId, sharedGroupId);

  // Assert Claim Assessment caps confidence and discloses duplication limitation
  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    claimType: ClaimTypes.CONTEXT,
    statement: 'The video represents a natural viral grassroots event.',
    evidenceIds: evidenceIds
  });

  const assessment = assessClaim(store, claim.id);
  assert.strictEqual(assessment.claim.status, 'SUPPORTED');
  // Since only 1 independent group exists, confidence must NOT exceed single-source threshold (0.85)
  assert.strictEqual(assessment.claim.confidence, 0.85);

  // Assert limitation disclaimer is present
  const hasDeduplicationNotice = assessment.limitations.some(lim =>
    lim.includes('Multiple supporting sources share the same independence group') &&
    lim.includes('do not multiply independent confirmation')
  );
  assert.strictEqual(hasDeduplicationNotice, true, 'Must include explicit limitation regarding syndicated sources');
});

run('Sybil Defense: Multi-source corroboration (3 distinct independent groups) reaches multi-group confidence', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Multi-Source Independence Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'official_event.mp4',
    sha256: 'c'.repeat(64),
    mimeType: 'video/mp4'
  });

  const ev1 = store.createEvidence({
    independenceGroupId: 'IG-PRIMARY-BROADCAST-STATION',
    evidenceType: 'AUTHENTICATED_PRIMARY_BROADCAST',
    description: 'First-party uncompressed SDI broadcast master',
    confidence: 0.98,
    polarity: EvidencePolarity.SUPPORTING
  });

  const ev2 = store.createEvidence({
    independenceGroupId: 'IG-INDEPENDENT-JOURNALIST-CAM',
    evidenceType: 'PHYSICAL_WITNESS_RECORDING',
    description: 'Independent eyewitness side-angle recording',
    confidence: 0.90,
    polarity: EvidencePolarity.SUPPORTING
  });

  const ev3 = store.createEvidence({
    independenceGroupId: 'IG-ACCREDITED-PRESS-AGENCY',
    evidenceType: 'METADATA_C2PA_VERIFICATION',
    description: 'Signed C2PA provenance manifest from accredited press',
    confidence: 0.95,
    polarity: EvidencePolarity.SUPPORTING
  });

  const claim = store.createClaim({
    investigationId: inv.id,
    artifactId: art.id,
    claimType: ClaimTypes.CONTEXT,
    statement: 'Press conference took place at Main Stadium Hall at 14:00 UTC.',
    evidenceIds: [ev1.id, ev2.id, ev3.id]
  });

  const assessment = assessClaim(store, claim.id);
  assert.strictEqual(assessment.claim.status, 'SUPPORTED');
  assert.strictEqual(assessment.claim.confidence, 0.94, 'Multi-group independent corroboration reaches 0.94 confidence');
});

// 2. Mocked Connector Registration & Discovery Rate Limiting
run('Discovery: MultiSourceDiscoveryManager registers all 6 honest discovery providers', () => {
  const manager = new MultiSourceDiscoveryManager();
  const providers = manager.getAllProviders();
  assert.strictEqual(providers.length, 6);
  assert.ok(manager.getProvider('reddit'));
  assert.ok(manager.getProvider('youtube'));
  assert.ok(manager.getProvider('mastodon'));
  assert.ok(manager.getProvider('archiveOrg'));
  assert.ok(manager.getProvider('googleImages'));
  assert.ok(manager.getProvider('googleVisionWebDetection'));
});

run('Discovery: Search proxy rate limiter enforces sliding-window thresholds', () => {
  const ip = '198.51.100.42';
  for (let i = 0; i < 60; i++) {
    assert.strictEqual(checkRateLimit(ip), true);
  }
  // 61st request in the same window must be rejected
  assert.strictEqual(checkRateLimit(ip), false);
});

console.log(`🎉 All ${passed}/${passed} Phase 17 Discovery & Independence Tests Passed Successfully!`);
