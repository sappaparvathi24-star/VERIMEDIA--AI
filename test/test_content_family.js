// test/test_content_family.js
// VeriMedia AI — Content Family Clustering & Sybil Defense Tests

import assert from 'assert';
import {
  groupIntoContentFamilies,
  computeMemberSimilarity,
  extractMemberHashes,
  generateFamilyId
} from '../src/provenance/contentFamily.js';
import { ProvenanceStore } from '../src/provenance/core.js';
import { ProvenanceService } from '../src/provenance/service.js';
import { analyzePropagation } from '../src/provenance/propagation.js';
import { countIndependentEvidenceGroups } from '../src/provenance/claims.js';
import { fuseEvidenceAndReasoning } from '../src/provenance/reasoning.js';

console.log('── Running VeriMedia AI Content Family Clustering & Sybil Defense Tests ──');
let passed = 0;

async function run(name, fn) {
  await fn();
  passed++;
  console.log(`✔ [PASS] Test ${passed}: ${name}`);
}

// 1. 10 reposts across 4 platforms with hashes differing by <= 4 bits -> 1 family
await run('10 reposts across 4 platforms with hash distance <= 4 bits collapse to 1 family', () => {
  const baseHash = 'a0f0a0f0a0f0a0f0';
  const platforms = ['Twitter', 'Reddit', 'YouTube', 'TikTok'];
  
  // Create 10 events with small 1-2 bit mutations of the base hash
  const mutations = [
    'a0f0a0f0a0f0a0f0', // 0 bits
    'a0f0a0f0a0f0a0f1', // 1 bit
    'a0f0a0f0a0f0a0f3', // 2 bits
    'a0f0a0f0a0f0a0f2', // 1 bit
    'a0f0a0f0a0f0a0e0', // 1 bit
    'a0f0a0f0a0f0a0b0', // 1 bit
    'a0f0a0f0a0f0b0f0', // 1 bit
    'a0f0a0f0a0f080f0', // 1 bit
    'a0f0a0f0a0f0a1f0', // 1 bit
    'a0f0a0f0a0f0a0f4'  // 2 bits
  ];

  const events = mutations.map((hash, idx) => ({
    id: `EVT-REPOST-${idx + 1}`,
    platform: platforms[idx % platforms.length],
    sourceId: platforms[idx % platforms.length],
    hash,
    publishedAt: `2026-06-01T10:0${idx}:00Z`,
    observedAt: `2026-06-01T10:0${idx}:00Z`
  }));

  const families = groupIntoContentFamilies(events, { threshold: 0.88 });

  assert.strictEqual(families.length, 1, 'All 10 reposts should collapse into 1 content family');
  assert.strictEqual(families[0].appearanceCount, 10, 'Family must have 10 appearances');
  assert.strictEqual(families[0].memberIds.length, 10, 'Family must contain all 10 member IDs');
  assert.strictEqual(families[0].distinctSourceCount, 4, 'Must reflect 4 distinct platforms');
  assert.ok(families[0].familyId.startsWith('CF-'), 'Family ID must follow CF- format');
  assert.strictEqual(families[0].representativeId, 'EVT-REPOST-1', 'Earliest event should be representative');
});

// 2. 3 genuinely distinct images (hash distance > 20) -> 3 families
await run('3 genuinely distinct images (hash distance > 20) produce 3 families', () => {
  const events = [
    { id: 'EVT-A', platform: 'Web', hash: '0000000000000000', publishedAt: '2026-06-01T08:00:00Z' },
    { id: 'EVT-B', platform: 'Web', hash: '00000000ffffffff', publishedAt: '2026-06-01T09:00:00Z' }, // 32 bits away
    { id: 'EVT-C', platform: 'Web', hash: 'ffffffff00000000', publishedAt: '2026-06-01T10:00:00Z' }  // 32 bits from A, 64 from B
  ];

  const families = groupIntoContentFamilies(events, { threshold: 0.88 });
  assert.strictEqual(families.length, 3, 'Must produce 3 distinct content families');
  families.forEach(f => {
    assert.strictEqual(f.appearanceCount, 1);
  });
});

// 3. Mixed scenario: 5 reposts of image A across 3 platforms + 2 reposts of image B -> 2 families
await run('Mixed scenario: 5 reposts of image A + 2 reposts of image B produce 2 families', () => {
  const events = [
    // Image A cluster
    { id: 'EVT-A1', platform: 'Twitter', hash: '1111222233334444', publishedAt: '2026-06-01T10:00:00Z' },
    { id: 'EVT-A2', platform: 'Twitter', hash: '1111222233334445', publishedAt: '2026-06-01T10:01:00Z' },
    { id: 'EVT-A3', platform: 'Reddit', hash: '1111222233334446', publishedAt: '2026-06-01T10:02:00Z' },
    { id: 'EVT-A4', platform: 'Reddit', hash: '1111222233334440', publishedAt: '2026-06-01T10:03:00Z' },
    { id: 'EVT-A5', platform: 'YouTube', hash: '1111222233334444', publishedAt: '2026-06-01T10:04:00Z' },

    // Image B cluster (far from Image A)
    { id: 'EVT-B1', platform: 'TikTok', hash: 'eeeeffffaaaabbbb', publishedAt: '2026-06-01T11:00:00Z' },
    { id: 'EVT-B2', platform: 'Instagram', hash: 'eeeeffffaaaabbbc', publishedAt: '2026-06-01T11:01:00Z' }
  ];

  const families = groupIntoContentFamilies(events, { threshold: 0.88 });
  assert.strictEqual(families.length, 2, 'Should group into exactly 2 content families');

  const famA = families.find(f => f.memberIds.includes('EVT-A1'));
  const famB = families.find(f => f.memberIds.includes('EVT-B1'));

  assert.ok(famA, 'Family A must exist');
  assert.ok(famB, 'Family B must exist');
  assert.strictEqual(famA.appearanceCount, 5, 'Family A must have 5 appearances');
  assert.strictEqual(famA.distinctSourceCount, 3, 'Family A spans 3 platforms');
  assert.strictEqual(famB.appearanceCount, 2, 'Family B must have 2 appearances');
  assert.strictEqual(famB.distinctSourceCount, 2, 'Family B spans 2 platforms');
});

// 4. Missing hash scenario: 3 events, one has no hash -> 3 families (stays singleton, doesn't crash or drop)
await run('Missing hash scenario: unhashed event stays singleton without throwing or dropping', () => {
  const events = [
    { id: 'EVT-1', platform: 'Web', hash: '0000111122223333' },
    { id: 'EVT-2', platform: 'Web', hash: 'ffff111122223333' }, // Distance 16 -> similarity 0.75 < 0.88
    { id: 'EVT-3', platform: 'Web', hash: null } // No hash
  ];

  const families = groupIntoContentFamilies(events, { threshold: 0.88 });
  assert.strictEqual(families.length, 3, 'Must produce 3 families (none dropped)');
  
  const unhashedFam = families.find(f => f.memberIds.includes('EVT-3'));
  assert.ok(unhashedFam, 'Unhashed event must be represented in its own family');
  assert.strictEqual(unhashedFam.appearanceCount, 1);
  assert.strictEqual(unhashedFam.representativeId, 'EVT-3');
});

// 5. Transitive clustering: A close to B, B close to C, A and C distance > threshold -> all 3 in one family (single linkage)
await run('Transitive single-linkage clustering connects chained mutations (A~B, B~C => {A,B,C})', () => {
  // 64-bit hex hashes:
  // A: 0 bits set
  const hashA = '0000000000000000';
  // B: 5 bits set (bits 0..4) -> dist(A,B) = 5, similarity = (64 - 5)/64 = 59/64 = 0.921875 > 0.88
  const hashB = '000000000000001f';
  // C: 10 bits set (bits 0..9) -> dist(B,C) = 5 (bits 5..9 flipped), similarity = 0.921875 > 0.88
  // dist(A,C) = 10 -> similarity = (64 - 10)/64 = 54/64 = 0.84375 < 0.88
  const hashC = '00000000000003ff';

  const events = [
    { id: 'A', hash: hashA },
    { id: 'B', hash: hashB },
    { id: 'C', hash: hashC }
  ];

  const simAB = computeMemberSimilarity(events[0], events[1]);
  const simBC = computeMemberSimilarity(events[1], events[2]);
  const simAC = computeMemberSimilarity(events[0], events[2]);

  assert.ok(simAB > 0.88, `A and B similarity (${simAB}) must exceed threshold 0.88`);
  assert.ok(simBC > 0.88, `B and C similarity (${simBC}) must exceed threshold 0.88`);
  assert.ok(simAC < 0.88, `A and C similarity (${simAC}) must be below threshold 0.88`);

  const families = groupIntoContentFamilies(events, { threshold: 0.88 });
  assert.strictEqual(families.length, 1, 'Single linkage must group A, B, and C transitively into 1 family');
  assert.strictEqual(families[0].memberIds.length, 3);
});

// 6. Empty input -> empty array, no throw
await run('Empty input returns empty array without throwing', () => {
  assert.deepStrictEqual(groupIntoContentFamilies([]), []);
  assert.deepStrictEqual(groupIntoContentFamilies(null), []);
  assert.deepStrictEqual(groupIntoContentFamilies(undefined), []);
});

// 7. Integration with propagation.js: analyzePropagation returns contentFamilies with correct shape
await run('Integration with propagation.js: analyzePropagation returns contentFamilies and updated whatWeKnow', () => {
  const store = new ProvenanceStore();
  const inv = store.createInvestigation({ title: 'Propagation Clustering Test' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'test_image.jpg',
    sha256: 'a'.repeat(64),
    mimeType: 'image/jpeg',
    perceptualHash: '1234567812345678'
  });

  // 3 events for image A, 1 event for image B
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Twitter',
    sourceId: 'Twitter',
    hash: '1234567812345678',
    observedAt: '2026-06-01T10:00:00Z'
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Reddit',
    sourceId: 'Reddit',
    hash: '1234567812345679', // 1 bit mutation
    observedAt: '2026-06-01T10:05:00Z'
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'Telegram',
    sourceId: 'Telegram',
    hash: '123456781234567a', // 1 bit mutation
    observedAt: '2026-06-01T10:10:00Z'
  });
  store.createPropagationEvent({
    investigationId: inv.id,
    artifactId: art.id,
    platform: 'YouTube',
    sourceId: 'YouTube',
    hash: '8765432187654321', // Completely distinct image
    observedAt: '2026-06-01T10:15:00Z'
  });

  const analysis = analyzePropagation(store, inv.id);

  assert.ok(Array.isArray(analysis.contentFamilies), 'contentFamilies must be an array');
  assert.strictEqual(analysis.contentFamilies.length, 2, 'Should collapse 4 events into 2 content families');
  
  // Verify shape
  const fam1 = analysis.contentFamilies[0];
  assert.ok(fam1.familyId, 'Family must have familyId');
  assert.ok(fam1.representativeId, 'Family must have representativeId');
  assert.ok(typeof fam1.appearanceCount === 'number', 'Family must have appearanceCount');
  assert.ok(typeof fam1.distinctSourceCount === 'number', 'Family must have distinctSourceCount');
  assert.ok(Array.isArray(fam1.memberIds), 'Family must have memberIds array');

  // Verify platform clusters are preserved unchanged
  assert.ok(Array.isArray(analysis.clusters), 'clusters must remain present');
  assert.strictEqual(analysis.clusters.length, 4, 'Must have 4 platform clusters');

  // Verify whatWeKnow mentions collapsing
  const collapseNotice = analysis.whatWeKnow.find(w => w.includes('collapsing to 2 distinct content family'));
  assert.ok(collapseNotice, 'whatWeKnow must include collapsing notice when family count < total events');
});

// 8. Integration with claims.js / reasoning.js: 10 reposts of same image produce 1 independent group, not 10
await run('Integration with claims & reasoning: Sybil attack with 10 reposts collapses to 1 independent evidence group', () => {
  const store = new ProvenanceStore();
  const service = new ProvenanceService(store);
  const inv = store.createInvestigation({ title: 'Sybil Defense End-to-End' });
  const art = store.createArtifact({
    investigationId: inv.id,
    filename: 'viral_claim_photo.png',
    sha256: 'c'.repeat(64),
    mimeType: 'image/png',
    perceptualHash: 'aabbccddeeff0011'
  });

  const platforms = ['Twitter', 'Facebook', 'Reddit', 'Telegram'];
  const baseHash = 'aabbccddeeff0011';
  const evidenceIds = [];

  // Analyst logs 10 reposts across 4 platforms using service.createPropagationEvent
  for (let i = 0; i < 10; i++) {
    // Small mutation <= 2 bits from base
    const mutatedHash = i === 0 ? baseHash : `aabbccddeeff001${(i % 8).toString(16)}`;
    const res = service.createPropagationEvent({
      investigationId: inv.id,
      artifactId: art.id,
      platform: platforms[i % platforms.length],
      sourceId: platforms[i % platforms.length],
      url: `https://${platforms[i % platforms.length].toLowerCase()}.com/post/${i + 1}`,
      hash: mutatedHash,
      publishedAt: `2026-06-01T12:0${i}:00Z`,
      observedAt: `2026-06-01T12:0${i}:00Z`
    });

    evidenceIds.push(res.evidence.id);
  }

  // Link evidence items to an investigation finding for reasoning fusion
  store.createFinding({
    investigationId: inv.id,
    artifactId: art.id,
    title: 'Dissemination Observation Finding',
    claim: 'Viral dissemination observed across multiple platforms',
    evidenceIds
  });

  // Verify evidence records now share the single content family independenceGroupId
  const independenceGroups = countIndependentEvidenceGroups(store, evidenceIds);
  assert.strictEqual(independenceGroups.groupCount, 1, '10 reposts must produce exactly 1 independent evidence group');
  assert.strictEqual(independenceGroups.groups[0].count, 10, 'All 10 evidence items must be in the single group');

  // Verify reasoning fusion collapses channels and caps confidence
  const reasoning = fuseEvidenceAndReasoning(store, inv.id);
  assert.strictEqual(reasoning.distinctIndependenceChannels, 1, 'distinctIndependenceChannels must be 1, not 10');
  assert.strictEqual(reasoning.calibratedConfidence, 0.85, 'Confidence must be capped at 0.85 for single-channel corroboration');
});

console.log(`\nAll ${passed} Content Family tests passed successfully!`);
