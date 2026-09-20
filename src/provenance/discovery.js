// VeriMedia AI — Source Discovery & Candidate Matching Engine (Phase H)
import { 
  DiscoveryJobStatus, 
  CandidateStatus, 
  CandidateRelationshipType, 
  DiscoveryStrategy,
  FindingStatus,
  EvidencePolarity,
  SourceTypes,
  AppearanceStatus
} from './core.js';
import { validateSourceUrl } from './claims.js';
import { MultiSourceDiscoveryManager } from '../matching/providers/index.js';
import { buildQuerySignals } from '../matching/querySignals.js';

/**
 * Calculates hex Hamming distance between two perceptual hash hex strings.
 */
export function hammingDistanceHex(a, b) {
  if (!a || !b) return 64;
  let distance = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    let n = x;
    while (n > 0) {
      distance += n & 1;
      n >>= 1;
    }
  }
  distance += Math.abs(a.length - b.length) * 4;
  return distance;
}

/**
 * Detects potential transformations between two media descriptors.
 */
export function analyzeTransformations(targetArt, candidateArt) {
  const indicators = [];
  if (!targetArt || !candidateArt) return indicators;

  // 1. Resolution / Scaling
  if (targetArt.dimensions && candidateArt.dimensions) {
    const tw = targetArt.dimensions.width;
    const th = targetArt.dimensions.height;
    const cw = candidateArt.dimensions.width;
    const ch = candidateArt.dimensions.height;

    if (tw !== cw || th !== ch) {
      indicators.push(`Dimension transformation observed: ${tw}x${th} vs ${cw}x${ch}`);
      const targetAspect = (tw / th).toFixed(3);
      const candAspect = (cw / ch).toFixed(3);
      if (Math.abs(targetAspect - candAspect) > 0.05) {
        indicators.push(`Aspect ratio discrepancy: ${targetAspect} vs ${candAspect} (probable crop or letterbox)`);
      }
    }
  }

  // 2. Duration differences (video/audio)
  if (targetArt.duration && candidateArt.duration) {
    const diff = Math.abs(targetArt.duration - candidateArt.duration);
    if (diff > 0.3) {
      indicators.push(`Duration variance of ${diff.toFixed(1)}s observed (probable trimming or re-encoding drift)`);
    }
  }

  // 3. Container / Format / Compression
  if (targetArt.mimeType && candidateArt.mimeType && targetArt.mimeType !== candidateArt.mimeType) {
    indicators.push(`Container format conversion: ${targetArt.mimeType} to ${candidateArt.mimeType}`);
  }

  if (targetArt.byteSize && candidateArt.byteSize) {
    const ratio = candidateArt.byteSize / targetArt.byteSize;
    if (ratio < 0.7) {
      indicators.push(`Significant bitrate reduction (${Math.round((1 - ratio) * 100)}% smaller payload; aggressive recompression)`);
    } else if (ratio > 1.5) {
      indicators.push(`Significant bitrate expansion (${Math.round((ratio - 1) * 100)}% larger payload; potential transcoder padding)`);
    }
  }

  return indicators;
}

/**
 * Adapter interface for external discovery providers (Phase 15).
 * Connects to the 5 honest providers (Reddit, YouTube, Mastodon, Wayback Machine, Google Images).
 * Permanently declares Instagram, TikTok, Facebook, and X as UNAVAILABLE.
 */
export class ExternalDiscoveryAdapter {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || null;
    this.enabled = config.enabled !== undefined ? config.enabled : Boolean(config.apiUrl);
    this.manager = new MultiSourceDiscoveryManager(config);
  }

  async discover(artifact, strategy, options = {}) {
    const opts = {
      ...options,
      imageBase64: options.imageBase64 || artifact?.imageBase64 || artifact?.content || artifact?.previewDataUrl || null,
      mediaUrl: options.mediaUrl || artifact?.url || artifact?.mediaUrl || null
    };

    if (!this.enabled && !options.enableExternal && !options.query && !options.signals && !opts.imageBase64 && !opts.mediaUrl) {
      return {
        available: false,
        reason: 'External discovery unavailable — showing indexed evidence only.',
        providerStatuses: this.manager.getTransparencyReport(),
        candidates: []
      };
    }

    const signals = buildQuerySignals(artifact, opts);
    if (signals.length === 0 && !opts.query && !opts.url && !opts.imageBase64 && !opts.mediaUrl) {
      return {
        available: false,
        providerStatuses: this.manager.getTransparencyReport(),
        reason: 'External discovery unavailable — showing indexed evidence only.',
        candidates: []
      };
    }

    try {
      const searchResult = await this.manager.searchAll(signals, opts);
      return {
        available: true,
        providerStatuses: searchResult.providerStatuses,
        candidates: searchResult.candidates || [],
        count: searchResult.totalCount || 0
      };
    } catch (err) {
      return {
        available: false,
        reason: `External discovery search failed: ${err.message}`,
        candidates: []
      };
    }
  }
}

/**
 * Local / Indexed Discovery Provider.
 * Works 100% locally with zero external API calls or paid dependencies.
 */
export class LocalIndexedDiscoveryProvider {
  constructor(store) {
    this.store = store;
  }

  /**
   * Evaluates target artifact against all indexed artifacts, sources, and appearances.
   */
  async discover(targetArtifact, strategy = DiscoveryStrategy.ALL, options = {}) {
    const candidates = [];
    const isDemo = Boolean(targetArtifact.isDemo);

    // Retrieve all artifacts in store matching the isolation mode (demo vs real)
    const allArtifacts = Array.from(this.store.artifacts.values()).filter(
      a => a.id !== targetArtifact.id && Boolean(a.isDemo) === isDemo
    );

    for (const other of allArtifacts) {
      // 1. Exact SHA-256 Match
      const isExactSha = targetArtifact.sha256 && other.sha256 && targetArtifact.sha256 === other.sha256;

      // 2. Perceptual Similarity Match
      let pDist = 64;
      let visualSim = 0.0;
      let isVisuallyRelated = false;

      if (targetArtifact.perceptualHash && other.perceptualHash) {
        pDist = hammingDistanceHex(targetArtifact.perceptualHash, other.perceptualHash);
        visualSim = Math.max(0, Math.min(1.0, 1.0 - (pDist / 32.0)));
        isVisuallyRelated = pDist <= 12; // High/Moderate perceptual similarity threshold
      }

      // Check if match qualifies under selected strategy
      let qualifies = false;
      let relType = CandidateRelationshipType.UNKNOWN;
      let status = CandidateStatus.OBSERVED;

      if (isExactSha) {
        qualifies = true;
        relType = CandidateRelationshipType.EXACT_MATCH;
        status = CandidateStatus.SUPPORTED;
      } else if (isVisuallyRelated) {
        qualifies = true;
        if (pDist <= 4) {
          relType = CandidateRelationshipType.SAME_CONTENT;
          status = CandidateStatus.SUPPORTED;
        } else if (pDist <= 10) {
          relType = CandidateRelationshipType.TRANSFORMED_VERSION;
          status = CandidateStatus.SUPPORTED;
        } else {
          relType = CandidateRelationshipType.POSSIBLY_DERIVED;
          status = CandidateStatus.INCONCLUSIVE;
        }
      } else if (pDist <= 18) {
        qualifies = true;
        relType = CandidateRelationshipType.RELATED_MEDIA;
        status = CandidateStatus.INCONCLUSIVE;
      }

      if (!qualifies) {
        continue;
      }

      // Find associated sources and appearances for `other` artifact
      const appearances = Array.from(this.store.appearances.values()).filter(
        app => app.artifactId === other.id
      );

      // Analyze potential transformations
      const transformations = analyzeTransformations(targetArtifact, other);

      // Look up primary source
      const primaryApp = appearances[0] || null;
      const source = primaryApp ? this.store.getSource(primaryApp.sourceId) : null;

      // Build source characteristics
      const sourceCharacteristics = {
        directMediaHost: source?.containsMediaDirectly ?? false,
        primaryPublisherClaim: source?.isFirstParty ?? false,
        repost: !source?.isFirstParty && (source?.platform === 'TikTok' || source?.platform === 'Social Media' || source?.type === SourceTypes.SOCIAL_POST),
        syndication: source?.type === SourceTypes.WEB_PAGE && source?.independentlyObserved === false,
        archive: source?.type === SourceTypes.ARCHIVE,
        socialPlatform: source?.type === SourceTypes.SOCIAL_POST,
        unknownHost: !source,
        publicationTimestampAvailable: Boolean(primaryApp?.observedAt || source?.observedAt),
        mediaBytesRetrievable: source?.canDownload ?? Boolean(other.byteSize),
        attributionPresent: Boolean(source?.name),
        independentlyObserved: source?.independentlyObserved ?? false
      };

      // Limitations specific to candidate
      const limitations = [
        'Candidate discovery establishes matching or transformed content across indexed sources; it does not determine capture hardware, earliest recording moment, or legal provenance ownership.',
        'Visual similarity indicates consistent perceptual features, not identical bitstreams or verified authorship.',
        'Earlier observed publication timestamps represent observed sightings, not historical moment of initial recording.'
      ];

      if (isExactSha) {
        limitations.push('Exact SHA-256 confirms identical byte content across files, but does not determine which file was generated first.');
      }

      if (sourceCharacteristics.syndication || !sourceCharacteristics.independentlyObserved) {
        limitations.push('Syndicated or mirrored platform candidate: does not count as an independent corroboration confirmation.');
      }

      candidates.push({
        matchedArtifact: other,
        source,
        appearance: primaryApp,
        relationshipType: relType,
        status,
        similarityMeasurements: {
          exactMatch: isExactSha,
          hammingDistance: pDist,
          visualSimilarity: parseFloat(visualSim.toFixed(4)),
          comparisonMethod: 'pHash_64bit_hex'
        },
        transformations,
        sourceCharacteristics,
        limitations
      });
    }

    return {
      available: true,
      reason: null,
      candidates
    };
  }
}

/**
 * Main Discovery Service Controller.
 */
export class DiscoveryService {
  constructor(store) {
    this.store = store;
    this.localProvider = new LocalIndexedDiscoveryProvider(store);
    this.externalAdapter = new ExternalDiscoveryAdapter();
  }

  /**
   * Executes a structured source discovery job for an investigated artifact.
   */
  async runDiscovery({
    investigationId,
    artifactId,
    queryStrategy = DiscoveryStrategy.ALL,
    candidateUrls = [],
    isDemo = false,
    options = {}
  }) {
    const investigation = this.store.getInvestigation(investigationId);
    if (!investigation) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    const artifact = this.store.getArtifact(artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // Create the DiscoveryJob record
    const job = this.store.createDiscoveryJob({
      investigationId,
      artifactId,
      status: DiscoveryJobStatus.RUNNING,
      queryStrategy,
      startedAt: new Date().toISOString(),
      isDemo: Boolean(isDemo || artifact.isDemo),
      metadata: {
        artifactFilename: artifact.filename,
        artifactSha256: artifact.sha256
      }
    });

    try {
      const createdCandidates = [];

      // 1. Run Local Indexed Discovery
      const localResult = await this.localProvider.discover(artifact, queryStrategy, options);

      // Create an AnalysisRun for this discovery execution
      const run = this.store.createAnalysisRun({
        investigationId,
        artifactId,
        method: 'SOURCE_DISCOVERY_ENGINE',
        status: 'COMPLETED',
        metadata: {
          jobId: job.id,
          strategy: queryStrategy,
          timestamp: new Date().toISOString()
        }
      });

      for (const item of localResult.candidates) {
        const otherArt = item.matchedArtifact;
        const src = item.source;
        const app = item.appearance;

        // Create Observations
        const obsSim = this.store.createObservation({
          runId: run.id,
          artifactId: artifact.id,
          observationType: 'CANDIDATE_SIMILARITY',
          target: otherArt.id,
          value: item.similarityMeasurements,
          confidence: item.similarityMeasurements.exactMatch ? 1.0 : item.similarityMeasurements.visualSimilarity
        });

        const obsTrans = this.store.createObservation({
          runId: run.id,
          artifactId: artifact.id,
          observationType: 'TRANSFORMATION_ANALYSIS',
          target: otherArt.id,
          value: { indicators: item.transformations },
          confidence: 0.9
        });

        // Determine Independence Group
        let indepGroup = 'UNKNOWN';
        if (src) {
          indepGroup = src.isFirstParty
            ? `IG-SRC-${src.id}`
            : (src.independentlyObserved ? `IG-INDEP-${src.id}` : `IG-SYNDICATED-${src.domain || 'AGGREGATOR'}`);
        } else {
          indepGroup = `IG-INDEXED-${otherArt.id}`;
        }

        // Create Evidence
        const evDesc = item.similarityMeasurements.exactMatch
          ? `Exact bitstream match (SHA-256) discovered between artifact ${artifact.id} and candidate artifact ${otherArt.id}.`
          : `Perceptual fingerprint similarity (${(item.similarityMeasurements.visualSimilarity * 100).toFixed(1)}%, Hamming distance ${item.similarityMeasurements.hammingDistance}) observed with candidate ${otherArt.id}.`;

        const evidence = this.store.createEvidence({
          observationIds: [obsSim.id, obsTrans.id],
          independenceGroupId: indepGroup,
          evidenceType: item.similarityMeasurements.exactMatch ? 'EXACT_HASH_MATCH' : 'PERCEPTUAL_FINGERPRINT_MATCH',
          description: evDesc,
          confidence: item.similarityMeasurements.exactMatch ? 1.0 : item.similarityMeasurements.visualSimilarity,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: {
            candidateArtifactId: otherArt.id,
            relationshipType: item.relationshipType,
            similarity: item.similarityMeasurements
          }
        });

        // Create Finding for the candidate
        const finding = this.store.createFinding({
          investigationId,
          title: `Candidate Appearance Evaluated: ${otherArt.filename || otherArt.id}`,
          summary: `Evaluated relationship '${item.relationshipType}' for candidate media at ${src?.url || 'indexed repository'}.`,
          status: item.status === CandidateStatus.SUPPORTED ? FindingStatus.SUPPORTED : FindingStatus.INCONCLUSIVE,
          confidence: evidence.confidence,
          evidenceIds: [evidence.id],
          limitations: item.limitations
        });

        // Create DiscoveryCandidate entity
        const candidateRecord = this.store.createDiscoveryCandidate({
          discoveryJobId: job.id,
          investigationId,
          artifactId: artifact.id,
          matchedArtifactId: otherArt.id,
          sourceId: src?.id || 'UNKNOWN',
          url: src?.url || null,
          title: src?.name || otherArt.filename,
          platform: src?.platform || 'Indexed Store',
          discoveredAt: new Date().toISOString(),
          publishedAt: app?.observedAt || src?.observedAt || null,
          retrievedAt: app?.retrievedAt || new Date().toISOString(),
          contentHash: otherArt.sha256,
          perceptualFingerprint: otherArt.perceptualHash,
          similarityMeasurements: item.similarityMeasurements,
          relationshipType: item.relationshipType,
          evidenceIds: [evidence.id],
          independenceGroup: indepGroup,
          status: item.status,
          sourceCharacteristics: item.sourceCharacteristics,
          limitations: item.limitations,
          transformationIndicators: item.transformations,
          isDemo: Boolean(isDemo || artifact.isDemo),
          metadata: {
            findingId: finding.id,
            observationIds: [obsSim.id, obsTrans.id],
            matchedArtifactFilename: otherArt.filename
          }
        });

        createdCandidates.push(candidateRecord);
      }

      // 2. Handle User-Supplied Candidate URLs (with strict SSRF Protection)
      if (Array.isArray(candidateUrls) && candidateUrls.length > 0) {
        for (const rawUrl of candidateUrls) {
          if (!rawUrl || typeof rawUrl !== 'string') continue;
          
          // SSRF validation: throws if unsafe scheme, loopback, private IP, localhost, etc.
          validateSourceUrl(rawUrl);

          const parsed = new URL(rawUrl.trim());
          const domain = parsed.hostname;

          // Register or retrieve source
          let candidateSource = Array.from(this.store.sources.values()).find(s => s.url === rawUrl.trim());
          if (!candidateSource) {
            candidateSource = this.store.createSource({
              url: rawUrl.trim(),
              name: `Web Appearance (${domain})`,
              domain,
              platform: domain.includes('tiktok') ? 'TikTok' : (domain.includes('youtube') ? 'YouTube' : 'Web Media Host'),
              type: SourceTypes.WEB_PAGE,
              isFirstParty: false,
              independentlyObserved: true,
              containsMediaDirectly: true,
              canDownload: true
            });
          }

          const indepGroup = `IG-EXT-${candidateSource.id}`;

          // Create an inconclusive/observed candidate record for un-analyzed external URL
          const extCandidate = this.store.createDiscoveryCandidate({
            discoveryJobId: job.id,
            investigationId,
            artifactId: artifact.id,
            matchedArtifactId: null,
            sourceId: candidateSource.id,
            url: candidateSource.url,
            title: `External Candidate: ${domain}`,
            platform: candidateSource.platform,
            discoveredAt: new Date().toISOString(),
            publishedAt: null, // Unknown publication date until verified
            retrievedAt: new Date().toISOString(),
            contentHash: null,
            perceptualFingerprint: null,
            similarityMeasurements: {
              comparisonMethod: 'URL_REGISTRATION_AWAITING_INGESTION'
            },
            relationshipType: CandidateRelationshipType.UNKNOWN,
            evidenceIds: [],
            independenceGroup: indepGroup,
            status: CandidateStatus.OBSERVED,
            sourceCharacteristics: {
              directMediaHost: true,
              primaryPublisherClaim: false,
              repost: false,
              syndication: false,
              archive: false,
              socialPlatform: candidateSource.platform !== 'Web Media Host',
              unknownHost: false,
              publicationTimestampAvailable: false,
              mediaBytesRetrievable: true,
              attributionPresent: false,
              independentlyObserved: true
            },
            limitations: [
              'External candidate URL registered and validated against SSRF restrictions.',
              'Candidate media content hash and visual similarity have not yet been evaluated via bitstream ingestion.',
              'Status remains UNKNOWN/OBSERVED until verified observations are acquired.'
            ],
            transformationIndicators: [],
            isDemo: Boolean(isDemo || artifact.isDemo)
          });

          createdCandidates.push(extCandidate);
        }
      }

      // 3. Process candidates returned by External Multi-Source Discovery Adapter (Phase 15)
      const extResult = await this.externalAdapter.discover(artifact, queryStrategy, options);

      if (extResult && Array.isArray(extResult.candidates) && extResult.candidates.length > 0) {
        for (const extItem of extResult.candidates) {
          if (!extItem.url) continue;

          let candidateSource = Array.from(this.store.sources.values()).find(s => s.url === extItem.url);
          if (!candidateSource) {
            let domain = 'external-web';
            try {
              domain = new URL(extItem.url).hostname;
            } catch (_) {}

            candidateSource = this.store.createSource({
              url: extItem.url,
              name: extItem.title || `${extItem.platform} Appearance`,
              domain,
              platform: extItem.platform || 'External Web',
              type: SourceTypes.SOCIAL_POST,
              isFirstParty: false,
              independentlyObserved: true,
              containsMediaDirectly: Boolean(extItem.mediaUrl || extItem.thumbnailUrl),
              canDownload: Boolean(extItem.mediaUrl),
              observedAt: extItem.publishedAt || null
            });
          }

          // Compute independence group
          const indepGroup = extItem.platform?.startsWith('Reddit')
            ? `IG-REDDIT-${extItem.subreddit || 'COMMUNITY'}`
            : (extItem.platform?.startsWith('YouTube')
              ? `IG-YOUTUBE-${extItem.author || 'CHANNEL'}`
              : (extItem.platform?.startsWith('Mastodon')
                ? `IG-MASTODON-${extItem.metadata?.instance || 'FEDIVERSE'}`
                : `IG-EXT-${candidateSource.domain || candidateSource.id}`));

          // Create Observation
          const obsExt = this.store.createObservation({
            runId: run.id,
            artifactId: artifact.id,
            observationType: 'EXTERNAL_API_MATCH',
            target: extItem.url,
            value: {
              platform: extItem.platform,
              title: extItem.title,
              author: extItem.author,
              publishedAt: extItem.publishedAt,
              similarityStatus: extItem.similarityStatus || 'TEXT_MATCH_ONLY',
              metadata: extItem.metadata || {}
            },
            confidence: 0.85
          });

          // Create Evidence
          const evExt = this.store.createEvidence({
            observationIds: [obsExt.id],
            independenceGroupId: indepGroup,
            evidenceType: 'EXTERNAL_API_SIGHTING',
            description: `Live sighting discovered on ${extItem.platform} (${extItem.title || extItem.url}) with publication timestamp ${extItem.publishedAt || 'UNREPORTED'}.`,
            confidence: 0.85,
            polarity: EvidencePolarity.SUPPORTING,
            metadata: {
              platform: extItem.platform,
              url: extItem.url,
              author: extItem.author,
              publishedAt: extItem.publishedAt
            }
          });

          const extCandidateRecord = this.store.createDiscoveryCandidate({
            discoveryJobId: job.id,
            investigationId,
            artifactId: artifact.id,
            matchedArtifactId: null,
            sourceId: candidateSource.id,
            url: extItem.url,
            title: extItem.title || `${extItem.platform} Candidate`,
            platform: extItem.platform,
            author: extItem.author || null,
            discoveredAt: new Date().toISOString(),
            publishedAt: extItem.publishedAt || null,
            retrievedAt: extItem.retrievedAt || new Date().toISOString(),
            contentHash: null,
            perceptualFingerprint: null,
            similarityMeasurements: {
              comparisonMethod: extItem.similarityStatus || 'EXTERNAL_API_METADATA_SEARCH',
              similarityStatus: extItem.similarityStatus || 'TEXT_MATCH_ONLY',
              thumbnailUrl: extItem.thumbnailUrl || null
            },
            relationshipType: CandidateRelationshipType.RELATED_MEDIA,
            evidenceIds: [evExt.id],
            independenceGroup: indepGroup,
            status: CandidateStatus.OBSERVED,
            sourceCharacteristics: {
              directMediaHost: Boolean(extItem.mediaUrl),
              primaryPublisherClaim: false,
              repost: false,
              syndication: false,
              archive: extItem.platform === 'Wayback Machine',
              socialPlatform: true,
              unknownHost: false,
              publicationTimestampAvailable: Boolean(extItem.publishedAt),
              mediaBytesRetrievable: Boolean(extItem.mediaUrl),
              attributionPresent: Boolean(extItem.author),
              independentlyObserved: true
            },
            limitations: [
              'External candidate discovered via live API query on public endpoint.',
              'Presence on platform establishes public appearance, not original physical capture authorship.',
              'No public API exists for Instagram, TikTok, Facebook, or X; these closed networks are not indexed.'
            ],
            transformationIndicators: [],
            isDemo: Boolean(isDemo || artifact.isDemo),
            metadata: {
              observationId: obsExt.id,
              evidenceId: evExt.id,
              sourceType: 'EXTERNAL_API_VERIFIED',
              thumbnailUrl: extItem.thumbnailUrl || null,
              mediaUrl: extItem.mediaUrl || null
            }
          });

          createdCandidates.push(extCandidateRecord);
        }
      }

      const completedStatus = DiscoveryJobStatus.COMPLETED;

      this.store.updateDiscoveryJob(job.id, {
        status: completedStatus,
        completedAt: new Date().toISOString(),
        candidateCount: createdCandidates.length,
        metadata: {
          ...job.metadata,
          externalProviderStatus: extResult.available ? 'AVAILABLE' : 'UNAVAILABLE',
          externalProviderNotice: extResult.reason,
          providerStatuses: extResult.providerStatuses || {}
        }
      });

      return {
        job: this.store.getDiscoveryJob(job.id),
        candidates: createdCandidates,
        externalProviderNotice: extResult.reason,
        providerStatuses: extResult.providerStatuses || {},
        candidateCount: createdCandidates.length
      };
    } catch (err) {
      this.store.updateDiscoveryJob(job.id, {
        status: DiscoveryJobStatus.FAILED,
        completedAt: new Date().toISOString(),
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Integrates a discovered candidate into the investigation's active timeline & ledger.
   */
  integrateCandidateIntoInvestigation(candidateId, investigationId, options = {}) {
    const candidate = this.store.getDiscoveryCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    const investigation = this.store.getInvestigation(investigationId);
    if (!investigation) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    // Associate matched artifact if not already in investigation
    if (candidate.matchedArtifactId && !investigation.artifactIds.includes(candidate.matchedArtifactId)) {
      investigation.artifactIds.push(candidate.matchedArtifactId);
    }

    // Create an Appearance on the timeline if source exists
    let appearance = null;
    if (candidate.sourceId && candidate.sourceId !== 'UNKNOWN') {
      const existingApp = Array.from(this.store.appearances.values()).find(
        a => a.sourceId === candidate.sourceId && a.artifactId === (candidate.matchedArtifactId || candidate.artifactId)
      );

      if (existingApp) {
        appearance = existingApp;
      } else {
        appearance = this.store.createAppearance({
          artifactId: candidate.matchedArtifactId || candidate.artifactId,
          sourceId: candidate.sourceId,
          observedAt: candidate.publishedAt || candidate.discoveredAt,
          retrievedAt: candidate.retrievedAt,
          status: AppearanceStatus.OBSERVED,
          notes: `Integrated candidate appearance from Discovery Job ${candidate.discoveryJobId}. Relationship: ${candidate.relationshipType}`,
          evidenceIds: candidate.evidenceIds || []
        });
      }
    }

    // Update candidate status to SUPPORTED if it was OBSERVED and verified
    if (candidate.status === CandidateStatus.OBSERVED && candidate.evidenceIds.length > 0) {
      this.store.updateDiscoveryCandidate(candidate.id, {
        status: CandidateStatus.SUPPORTED
      });
    }

    return {
      success: true,
      candidate: this.store.getDiscoveryCandidate(candidate.id),
      appearance,
      investigation: this.store.getInvestigation(investigationId)
    };
  }

  /**
   * Traceability for a candidate:
   * Candidate → Evidence → Observation → AnalysisRun → AnalysisMethod → MediaArtifact
   */
  traceCandidate(candidateId) {
    const candidate = this.store.getDiscoveryCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    const source = candidate.sourceId ? this.store.getSource(candidate.sourceId) : null;
    const targetArtifact = candidate.artifactId ? this.store.getArtifact(candidate.artifactId) : null;
    const matchedArtifact = candidate.matchedArtifactId ? this.store.getArtifact(candidate.matchedArtifactId) : null;

    const evidenceChain = (candidate.evidenceIds || []).map(eid => {
      const ev = this.store.getEvidence(eid);
      if (!ev) return null;

      const observationChain = (ev.observationIds || []).map(oid => {
        const obs = this.store.getObservation(oid);
        if (!obs) return null;

        const run = obs.runId ? this.store.getAnalysisRun(obs.runId) : null;
        return {
          observation: obs,
          analysisRun: run,
          analysisMethod: run?.method || 'SOURCE_DISCOVERY_ENGINE'
        };
      }).filter(Boolean);

      return {
        evidence: ev,
        observations: observationChain
      };
    }).filter(Boolean);

    return {
      candidate,
      source,
      targetArtifact,
      matchedArtifact,
      evidenceChain,
      traceable: evidenceChain.length > 0
    };
  }
}
