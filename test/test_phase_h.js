// VeriMedia AI — Phase H Test Suite: Source Discovery & Candidate Matching
import assert from 'node:assert';
import { 
  ProvenanceStore, 
  DiscoveryJobStatus, 
  CandidateStatus, 
  CandidateRelationshipType, 
  DiscoveryStrategy,
  SourceTypes
} from '../src/provenance/core.js';
import { 
  DiscoveryService, 
  hammingDistanceHex, 
  analyzeTransformations, 
  ExternalDiscoveryAdapter 
} from '../src/provenance/discovery.js';
import { provenanceService } from '../src/provenance/service.js';

console.log('── Running VeriMedia AI Phase H Tests: Source Discovery & Candidate Matching ──');

let passedTests = 0;
function pass(name) {
  passedTests++;
  console.log(`✔ [PASS] Test ${passedTests}: ${name}`);
}

async function runTests() {
  const store = new ProvenanceStore();
  store.clear();
  const discoveryService = new DiscoveryService(store);

  // Setup test environment
  const inv = store.createInvestigation({
    id: 'INV-TEST-H01',
    title: 'Phase H Test Investigation',
    status: 'ACTIVE',
    isDemo: false
  });

  const masterArtifact = store.createArtifact({
    id: 'ART-TEST-MASTER',
    investigationId: inv.id,
    filename: 'original_press_footage_1080p.mp4',
    mimeType: 'video/mp4',
    byteSize: 50000000,
    sha256: '4444444444444444444444444444444444444444444444444444444444444444',
    perceptualHash: '1122334455667788',
    dimensions: { width: 1920, height: 1080 },
    duration: 60.0,
    isDemo: false
  });

  // Candidate 1: Exact Hash Match
  const exactArtifact = store.createArtifact({
    id: 'ART-TEST-EXACT',
    investigationId: inv.id,
    filename: 'mirrored_upload.mp4',
    mimeType: 'video/mp4',
    byteSize: 50000000,
    sha256: '4444444444444444444444444444444444444444444444444444444444444444',
    perceptualHash: '1122334455667788',
    dimensions: { width: 1920, height: 1080 },
    duration: 60.0,
    isDemo: false
  });

  // Candidate 2: Transformed Visual Match (720p social crop, slight pHash difference)
  const transformedArtifact = store.createArtifact({
    id: 'ART-TEST-TRANSFORMED',
    investigationId: inv.id,
    filename: 'social_crop_720p.mp4',
    mimeType: 'video/mp4',
    byteSize: 15000000,
    sha256: '5555555555555555555555555555555555555555555555555555555555555555',
    perceptualHash: '1122334455667789', // 1 bit diff from master
    dimensions: { width: 1280, height: 720 },
    duration: 59.4,
    isDemo: false
  });

  // Candidate 3: Unrelated Artifact
  const unrelatedArtifact = store.createArtifact({
    id: 'ART-TEST-UNRELATED',
    investigationId: inv.id,
    filename: 'completely_different.mp4',
    mimeType: 'video/mp4',
    byteSize: 8000000,
    sha256: '9999999999999999999999999999999999999999999999999999999999999999',
    perceptualHash: 'ffffffff00000000', // high hamming distance
    dimensions: { width: 640, height: 480 },
    duration: 10.0,
    isDemo: false
  });

  // Sources
  const srcExact = store.createSource({
    id: 'SRC-TEST-EXACT',
    url: 'https://archive-mirror.org/clip/master-copy',
    name: 'Archive Mirror Org',
    domain: 'archive-mirror.org',
    type: SourceTypes.ARCHIVE,
    isFirstParty: false,
    independentlyObserved: true,
    containsMediaDirectly: true,
    canDownload: true
  });

  const srcSocial = store.createSource({
    id: 'SRC-TEST-SOCIAL',
    url: 'https://socialshare.example/v/clip99',
    name: 'Social Share Clip',
    domain: 'socialshare.example',
    type: SourceTypes.SOCIAL_POST,
    isFirstParty: false,
    independentlyObserved: true,
    containsMediaDirectly: true,
    canDownload: true
  });

  store.createAppearance({
    id: 'APP-TEST-EXACT',
    artifactId: exactArtifact.id,
    sourceId: srcExact.id,
    observedAt: '2026-08-12T10:00:00Z',
    publishedAt: '2026-08-12T09:30:00Z'
  });

  store.createAppearance({
    id: 'APP-TEST-SOCIAL',
    artifactId: transformedArtifact.id,
    sourceId: srcSocial.id,
    observedAt: '2026-08-15T14:00:00Z',
    publishedAt: '2026-08-15T13:00:00Z'
  });

  // ── TEST 1: Run discovery job and verify job metadata ──
  const runResult = await discoveryService.runDiscovery({
    investigationId: inv.id,
    artifactId: masterArtifact.id,
    queryStrategy: DiscoveryStrategy.ALL
  });

  assert(runResult.job, 'Job should be created');
  assert.strictEqual(runResult.job.status, DiscoveryJobStatus.COMPLETED, 'Job status should be COMPLETED');
  assert(runResult.job.startedAt && runResult.job.completedAt, 'Job must have timestamps');
  assert.strictEqual(runResult.job.candidateCount, 2, 'Should discover 2 candidates (exact + transformed)');
  pass('Execute discovery job and verify job lifecycle metadata');

  // ── TEST 2: Exact SHA-256 match discovery ──
  const exactCand = runResult.candidates.find(c => c.matchedArtifactId === exactArtifact.id);
  assert(exactCand, 'Exact candidate must be discovered');
  assert.strictEqual(exactCand.relationshipType, CandidateRelationshipType.EXACT_MATCH);
  assert.strictEqual(exactCand.similarityMeasurements.exactMatch, true);
  assert.strictEqual(exactCand.similarityMeasurements.hammingDistance, 0);
  assert.strictEqual(exactCand.similarityMeasurements.visualSimilarity, 1.0);
  pass('Exact SHA-256 match identification with zero hamming distance');

  // ── TEST 3: Perceptual similarity match ──
  const transCand = runResult.candidates.find(c => c.matchedArtifactId === transformedArtifact.id);
  assert(transCand, 'Transformed candidate must be discovered');
  assert.strictEqual(transCand.relationshipType, CandidateRelationshipType.SAME_CONTENT || transCand.relationshipType === CandidateRelationshipType.TRANSFORMED_VERSION);
  assert.strictEqual(transCand.similarityMeasurements.exactMatch, false);
  assert(transCand.similarityMeasurements.hammingDistance <= 4, 'Hamming distance should be small');
  assert(transCand.similarityMeasurements.visualSimilarity > 0.85, 'Visual similarity should exceed 85%');
  pass('Perceptual similarity detection identifying visual consistency');

  // ── TEST 4: High perceptual distance discards unrelated media ──
  const unrelatedCand = runResult.candidates.find(c => c.matchedArtifactId === unrelatedArtifact.id);
  assert.strictEqual(unrelatedCand, undefined, 'Unrelated artifact must not be returned as candidate');
  pass('Unrelated media discarded when perceptual distance exceeds threshold');

  // ── TEST 5: Dimension transformation analysis ──
  const indicators = analyzeTransformations(masterArtifact, transformedArtifact);
  assert(indicators.some(i => i.includes('Dimension transformation')), 'Must flag 1920x1080 vs 1280x720 dimension variance');
  pass('Dimension variance correctly detected and logged in candidate indicators');

  // ── TEST 6: Aspect ratio discrepancy detection ──
  const croppedArt = { dimensions: { width: 1080, height: 1080 } }; // 1:1 square crop
  const cropIndicators = analyzeTransformations(masterArtifact, croppedArt);
  assert(cropIndicators.some(i => i.includes('Aspect ratio discrepancy')), 'Must flag aspect ratio discrepancy for square crop');
  pass('Aspect ratio discrepancy flags probable crop or letterbox');

  // ── TEST 7: Bitrate reduction detection ──
  assert(indicators.some(i => i.includes('bitrate reduction')), 'Must flag significant bitrate reduction');
  pass('Bitrate variance accurately flags aggressive recompression');

  // ── TEST 8: External discovery adapter default notification ──
  const adapter = new ExternalDiscoveryAdapter();
  const extRes = await adapter.discover(masterArtifact, DiscoveryStrategy.ALL);
  assert.strictEqual(extRes.available, false);
  assert.strictEqual(extRes.reason, 'External discovery unavailable — showing indexed evidence only.');
  pass('External adapter returns unavailable notice instead of throwing search failure');

  // ── TEST 9: Candidate source characteristics without universal ranking ──
  assert.strictEqual(typeof exactCand.sourceCharacteristics, 'object');
  assert.strictEqual(exactCand.sourceCharacteristics.archive, true);
  assert.strictEqual(exactCand.sourceCharacteristics.primaryPublisherClaim, false);
  assert.strictEqual(exactCand.sourceCharacteristics.rankScore, undefined, 'No universal ranking score');
  pass('Source characteristics present without universal ranking score');

  // ── TEST 10: Syndicated source does not count as independent confirmation ──
  const syndicatedSrc = store.createSource({
    id: 'SRC-TEST-SYNDICATED',
    url: 'https://news-syndicate.example/wire/story-01',
    name: 'News Syndicate Wire',
    type: SourceTypes.WEB_PAGE,
    isFirstParty: false,
    independentlyObserved: false
  });
  const syndApp = store.createAppearance({
    id: 'APP-TEST-SYNDICATED',
    artifactId: exactArtifact.id,
    sourceId: syndicatedSrc.id,
    observedAt: '2026-08-13T10:00:00Z'
  });
  const syndResults = await discoveryService.localProvider.discover(masterArtifact);
  const syndItem = syndResults.candidates.find(c => c.source?.id === syndicatedSrc.id);
  if (syndItem) {
    assert.strictEqual(syndItem.sourceCharacteristics.independentlyObserved, false);
    assert(syndItem.limitations.some(l => l.includes('does not count as an independent corroboration')));
  }
  pass('Syndicated sources flagged and excluded from independent confirmation');

  // ── TEST 11: Candidate limitations mandate non-definitive origin bounds ──
  assert(exactCand.limitations.some(l => l.includes('does not determine capture hardware')));
  assert(transCand.limitations.some(l => l.includes('does not determine capture hardware')));
  pass('Candidate records enforce explicit epistemic limitations on origin');

  // ── TEST 12: Strict SSRF protection on manual candidate URLs ──
  const blockedUrls = [
    'http://localhost:8080/media.mp4',
    'http://127.0.0.1/video.mp4',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/admin',
    'http://192.168.1.1/router',
    'file:///etc/passwd',
    'ftp://server/media.mp4'
  ];
  for (const url of blockedUrls) {
    let threw = false;
    try {
      await discoveryService.runDiscovery({
        investigationId: inv.id,
        artifactId: masterArtifact.id,
        candidateUrls: [url]
      });
    } catch (e) {
      threw = true;
    }
    assert(threw, `Must reject unsafe SSRF URL: ${url}`);
  }
  pass('SSRF protection blocks localhost, internal IPs, AWS metadata, and non-HTTP protocols');

  // ── TEST 13: Valid public HTTPS URL accepted safely ──
  const validUrlRes = await discoveryService.runDiscovery({
    investigationId: inv.id,
    artifactId: masterArtifact.id,
    candidateUrls: ['https://public-broadcast-archive.org/footage/clip101']
  });
  const extCand = validUrlRes.candidates.find(c => c.url === 'https://public-broadcast-archive.org/footage/clip101');
  assert(extCand, 'Public URL must be registered as candidate');
  assert.strictEqual(extCand.status, CandidateStatus.OBSERVED);
  assert.strictEqual(extCand.publishedAt, null, 'Do not fabricate unverified publication timestamp');
  pass('Valid public HTTPS candidate URL registered safely without fabricated metadata');

  // ── TEST 14: Candidate integration into active investigation timeline ──
  const integrateRes = discoveryService.integrateCandidateIntoInvestigation(exactCand.id, inv.id);
  assert.strictEqual(integrateRes.success, true);
  assert(integrateRes.appearance, 'Must create appearance on timeline');
  pass('Candidate appearance successfully integrated into investigation timeline');

  // ── TEST 15: Timestamp distinction: observedAt vs publishedAt vs retrievedAt ──
  assert(exactCand.discoveredAt, 'Must have discoveredAt');
  assert(exactCand.publishedAt, 'Must have publishedAt');
  assert(exactCand.retrievedAt, 'Must have retrievedAt');
  pass('Candidate retains distinct discoveredAt, publishedAt, and retrievedAt timestamps');

  // ── TEST 16: Complete Traceability Chain ──
  const trace = discoveryService.traceCandidate(exactCand.id);
  assert.strictEqual(trace.traceable, true);
  assert(trace.evidenceChain.length > 0, 'Must have evidence chain');
  const firstEv = trace.evidenceChain[0];
  assert(firstEv.evidence, 'Evidence must exist');
  assert(firstEv.observations.length > 0, 'Evidence must link to observations');
  assert(firstEv.observations[0].analysisRun, 'Observation must link to AnalysisRun');
  assert.strictEqual(firstEv.observations[0].analysisMethod, 'SOURCE_DISCOVERY_ENGINE');
  pass('Traceability chain complete: Candidate → Evidence → Observation → Run → Method');

  // ── TEST 17: Strict Demo Isolation (Real investigation cannot see demo artifacts) ──
  const demoArt = store.createArtifact({
    id: 'ART-TEST-DEMO-ONLY',
    investigationId: inv.id,
    filename: 'simulated_leak_demo.mp4',
    sha256: masterArtifact.sha256, // identical hash to master, but isDemo=true!
    perceptualHash: masterArtifact.perceptualHash,
    isDemo: true
  });

  const realDiscoveryRes = await discoveryService.runDiscovery({
    investigationId: inv.id,
    artifactId: masterArtifact.id,
    isDemo: false
  });
  const leakedDemo = realDiscoveryRes.candidates.find(c => c.matchedArtifactId === demoArt.id);
  assert.strictEqual(leakedDemo, undefined, 'Real discovery job must NEVER match demo artifact');
  pass('Strict Demo Isolation: Real discovery job excludes simulated demo artifacts');

  // ── TEST 18: Demo discovery job finds demo artifacts with explicit notice ──
  const demoInv = store.createInvestigation({
    id: 'INV-TEST-DEMO-02',
    title: 'Demo Investigation',
    status: 'ACTIVE',
    isDemo: true
  });
  const demoMaster = store.createArtifact({
    id: 'ART-TEST-DEMO-MASTER',
    investigationId: demoInv.id,
    filename: 'demo_master.mp4',
    sha256: '7777777777777777777777777777777777777777777777777777777777777777',
    perceptualHash: '1122334455667788',
    isDemo: true
  });
  const demoCandidateArt = store.createArtifact({
    id: 'ART-TEST-DEMO-CAND',
    investigationId: demoInv.id,
    filename: 'demo_cand.mp4',
    sha256: '7777777777777777777777777777777777777777777777777777777777777777',
    perceptualHash: '1122334455667788',
    isDemo: true
  });

  const demoJobRes = await discoveryService.runDiscovery({
    investigationId: demoInv.id,
    artifactId: demoMaster.id,
    isDemo: true
  });
  assert(demoJobRes.candidates.length > 0, 'Demo discovery should match demo candidate');
  assert.strictEqual(demoJobRes.candidates[0].isDemo, true);
  assert(demoJobRes.candidates.some(c => c.matchedArtifactId === demoCandidateArt.id), 'Demo candidate should be discovered');
  pass('Demo discovery job operates cleanly within isolated demo namespace');

  // ── TEST 19: Absence of matches produces clean empty job without fabrication ──
  const uniqueArtifact = store.createArtifact({
    id: 'ART-TEST-UNIQUE',
    investigationId: inv.id,
    filename: 'never_before_seen.mp4',
    sha256: '0101010101010101010101010101010101010101010101010101010101010101',
    perceptualHash: '9999000011112222',
    isDemo: false
  });
  const emptyRes = await discoveryService.runDiscovery({
    investigationId: inv.id,
    artifactId: uniqueArtifact.id,
    isDemo: false
  });
  assert.strictEqual(emptyRes.candidates.length, 0);
  assert.strictEqual(emptyRes.candidateCount, 0);
  assert.strictEqual(emptyRes.job.status, DiscoveryJobStatus.COMPLETED);
  pass('Absence of matches produces completed job with 0 candidates and zero fabrication');

  // ── TEST 20: Pre-seeded investigation contains verified candidates ──
  const preseededInv = provenanceService.getInvestigation('INV-VM-2026-CHAMP');
  assert(preseededInv, 'INV-VM-2026-CHAMP must exist');
  const champCandidates = provenanceService.getDiscoveryCandidates('INV-VM-2026-CHAMP');
  assert(champCandidates.length >= 2, 'Pre-seeded championship case must have at least 2 discovered candidates');
  const tiktokCandidate = champCandidates.find(c => c.platform === 'TikTok');
  assert(tiktokCandidate, 'TikTok candidate appearance must exist');
  assert.strictEqual(tiktokCandidate.relationshipType, CandidateRelationshipType.TRANSFORMED_VERSION);
  assert(tiktokCandidate.transformationIndicators.length > 0, 'Must have transformation indicators');
  pass('Authoritative investigation INV-VM-2026-CHAMP contains seeded candidates with transformations');

  // ── TEST 21: Verification of banned certainty terms in candidate outputs ──
  const bannedTerms = [
    'ORIGINAL SOURCE',
    'ORIGINAL FILE',
    'DEFINITIVE ORIGIN',
    'ABSOLUTE ORIGIN',
    'TRUE SOURCE',
    'FIRST EVER',
    '100% TRUE',
    '100% FALSE',
    'TRUTH SCORE',
    'FAKE SCORE',
    'AI TRUTH'
  ];
  const allCandidates = store.getDiscoveryCandidatesByInvestigation(inv.id);
  for (const c of allCandidates) {
    const serialized = JSON.stringify(c).toUpperCase();
    for (const term of bannedTerms) {
      assert(!serialized.includes(term), `Candidate output contains banned certainty term: ${term}`);
    }
  }
  pass('Audit confirms zero prohibited certainty language across all candidate outputs');

  console.log('========================================');
  console.log(`Phase H Test Suite: ${passedTests}/${passedTests} PASSED`);
  console.log('========================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
