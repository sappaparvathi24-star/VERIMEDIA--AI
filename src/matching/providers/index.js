// VeriMedia AI — Provider Registry & Discovery Manager
import { RedditDiscoveryProvider } from './reddit.js';
import { YouTubeDiscoveryProvider } from './youtube.js';
import { MastodonDiscoveryProvider } from './mastodon.js';
import { ArchiveOrgDiscoveryProvider } from './archiveOrg.js';
import { GoogleImagesDiscoveryProvider } from './googleImages.js';
import { GoogleVisionWebDetectionProvider } from './googleVisionWebDetection.js';
import { XDiscoveryProvider } from './x.js';
import { InstagramDiscoveryProvider } from './instagram.js';
import { GoogleVisionDiscoveryProvider } from './googleVision.js';
import { getDiscoveryHealth } from '../../proxy/searchProxy.js';
import { getArtifactMedia } from '../../forensics/imageForensics.js';
import { computeAverageHash } from '../../forensics/perceptualHash.js';
import { 
  evaluateCandidateVisualSimilarity, 
  SIMILARITY_THRESHOLDS, 
  MATCH_CLASSIFICATIONS 
} from '../visualComparison.js';

function getForensicRelevanceScore(cand) {
  const sim = typeof cand.similarity === 'number' ? cand.similarity : (cand.matchScore ? cand.matchScore / 100 : 0.85);
  const isExact = cand.classification === MATCH_CLASSIFICATIONS.EXACT_MATCH || sim >= 0.98;
  const isDerivative = cand.classification === MATCH_CLASSIFICATIONS.MODIFIED_DERIVATIVE || cand.isPartialMatch;
  const isNear = cand.classification === MATCH_CLASSIFICATIONS.NEAR_DUPLICATE || (sim >= 0.88 && sim < 0.98);

  if (isDerivative) {
    // Highest forensic priority: modified, cropped, tampered, or partial match derivative
    return 1.5 + sim;
  } else if (isExact) {
    // Exact match: original publication or direct mirror
    return 1.2 + sim;
  } else if (isNear) {
    return 1.0 + sim;
  } else {
    return sim;
  }
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  const deduped = [];

  for (const cand of candidates) {
    if (!cand) continue;
    let normUrl = cand.url || '';
    try {
      const parsed = new URL(normUrl);
      normUrl = `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch (_) {
      normUrl = normUrl.trim().toLowerCase();
    }

    const key = normUrl || cand.id || cand.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(cand);
  }

  return deduped;
}

export class MultiSourceDiscoveryManager {
  constructor(config = {}) {
    this.providers = new Map();
    
    // Register the discovery platforms
    this.registerProvider(new RedditDiscoveryProvider(config.reddit));
    this.registerProvider(new YouTubeDiscoveryProvider(config.youtube));
    this.registerProvider(new MastodonDiscoveryProvider(config.mastodon));
    this.registerProvider(new ArchiveOrgDiscoveryProvider(config.archiveOrg));
    this.registerProvider(new GoogleImagesDiscoveryProvider(config.googleImages));
    this.registerProvider(new GoogleVisionWebDetectionProvider(config.googleVision || config.googleVisionWebDetection));
    this.registerProvider(new InstagramDiscoveryProvider(config.instagram));
    this.registerProvider(new XDiscoveryProvider(config.x));

    if (config.includeAll || config.enableVisionAndSocial) {
      this.registerProvider(new GoogleVisionDiscoveryProvider(config.googleVision));
    }
  }

  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id) {
    return this.providers.get(id);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  getTransparencyReport() {
    const health = getDiscoveryHealth();
    return health.providers;
  }

  /**
   * Searches across selected or all active providers in parallel.
   * Prioritizes image-first visual discovery when media bytes are available,
   * evaluates candidate perceptual hash similarity against the uploaded file,
   * filters out UNRELATED candidates, and logs forensic audit metrics.
   */
  async searchAll(signals, opts = {}) {
    const rawResults = [];
    const providerStatuses = {};
    const startTime = Date.now();

    // 1. Resolve uploaded media buffer and perceptual fingerprint
    let imageBuffer = opts.imageBuffer || null;
    if (!imageBuffer && opts.artifactId) {
      try {
        const media = getArtifactMedia(opts.artifactId);
        if (media && media.buffer) {
          imageBuffer = media.buffer;
        }
      } catch (_) {}
    }

    const isVisualSearch = Boolean(imageBuffer || opts.isVisualSearch) && !opts.isManualTextSearch;
    let uploadedHash = opts.perceptualHash || null;
    if (!uploadedHash && imageBuffer) {
      try {
        uploadedHash = await computeAverageHash(imageBuffer);
      } catch (_) {}
    }

    const queryStr = typeof signals === 'string' 
      ? signals 
      : (signals?.query || signals?.[0]?.term || opts.query || (isVisualSearch ? 'visual-reverse-search' : 'visual-asset'));

    let targetProviders = this.getAllProviders();
    if (opts.platforms && Array.isArray(opts.platforms) && opts.platforms.length > 0) {
      targetProviders = targetProviders.filter(p => 
        opts.platforms.includes(p.id) || 
        opts.platforms.includes(p.name) || 
        (opts.platforms.includes('google-search-api') && (p.id === 'googleImages' || p.id === 'googleSearch')) ||
        (opts.platforms.includes('google_vision') && p.id === 'google_vision')
      );
    } else if (opts.provider) {
      targetProviders = targetProviders.filter(p => p.id === opts.provider || p.name === opts.provider);
    }

    let extractedBestGuessLabels = opts.bestGuessLabels || [];

    // 2. Primary Provider Execution: If Google Vision is active and media is present,
    // execute it first to extract native visual web detection matches and entity/best-guess labels
    const visionProvider = targetProviders.find(p => p.id === 'googleVisionWebDetection' || p.id === 'google_vision');
    const otherProviders = targetProviders.filter(p => p.id !== 'googleVisionWebDetection' && p.id !== 'google_vision');

    if (visionProvider && isVisualSearch) {
      const vStart = Date.now();
      try {
        const imageBase64 = imageBuffer ? imageBuffer.toString('base64') : (opts.imageBase64 || null);
        const vRes = await visionProvider.search(signals, {
          ...opts,
          imageBuffer,
          imageBase64,
          uploadedHash,
          isVisualSearch: true
        });
        const vLatency = Date.now() - vStart;
        providerStatuses[visionProvider.id] = {
          providerId: visionProvider.id,
          name: visionProvider.name,
          status: vRes.status,
          count: vRes.count || (vRes.candidates ? vRes.candidates.length : 0),
          latencyMs: vLatency,
          reason: vRes.reason || null,
          queryType: 'REAL_VISUAL_QUERY'
        };

        if (Array.isArray(vRes.bestGuessLabels) && vRes.bestGuessLabels.length > 0) {
          extractedBestGuessLabels = vRes.bestGuessLabels;
        }

        if (vRes.candidates && vRes.candidates.length > 0) {
          const normalized = vRes.candidates.map(cand => ({
            ...cand,
            source: visionProvider.id,
            sourceType: 'EXTERNAL_API_VERIFIED',
            matchType: 'visual_match',
            platform: cand.platform || visionProvider.name
          }));
          rawResults.push(...normalized);
        }

        console.log(`[Discovery Provider Audit] Provider: ${visionProvider.id} (${visionProvider.name}) | Status: ${vRes.status} | Query Type: REAL_VISUAL_QUERY | Count: ${providerStatuses[visionProvider.id].count} | Latency: ${vLatency}ms`);
      } catch (vErr) {
        const vLatency = Date.now() - vStart;
        providerStatuses[visionProvider.id] = {
          providerId: visionProvider.id,
          name: visionProvider.name,
          status: 'ERROR',
          count: 0,
          latencyMs: vLatency,
          reason: vErr.message,
          queryType: 'REAL_VISUAL_QUERY'
        };
        console.warn(`[Discovery Provider Audit Error] Provider: ${visionProvider.id} | Error: ${vErr.message}`);
      }
    }

    // 3. Execute remaining providers concurrently with propagated visual labels
    const searchPromises = otherProviders.map(async (provider) => {
      const pStart = Date.now();
      const isVisualCapability = provider.id === 'google_vision' || provider.id === 'googleVisionWebDetection';
      const providerQueryType = isVisualCapability 
        ? 'REAL_VISUAL_QUERY' 
        : (isVisualSearch ? 'TEXT_FALLBACK' : 'MANUAL_TEXT_QUERY');

      try {
        const imageBase64 = imageBuffer ? imageBuffer.toString('base64') : (opts.imageBase64 || null);
        const providerOpts = {
          ...opts,
          imageBuffer,
          imageBase64,
          uploadedHash,
          isVisualSearch,
          bestGuessLabels: extractedBestGuessLabels
        };

        const res = await provider.search(signals, providerOpts);
        const pLatency = Date.now() - pStart;
        providerStatuses[provider.id] = {
          providerId: provider.id,
          name: provider.name,
          status: res.status,
          count: res.count || (res.candidates ? res.candidates.length : 0),
          latencyMs: pLatency,
          reason: res.reason || null,
          queryType: providerQueryType
        };

        console.log(`[Discovery Provider Audit] Query: "${queryStr}" | Provider: ${provider.id} (${provider.name}) | Status: ${res.status} | Query Type: ${providerQueryType} | Count: ${providerStatuses[provider.id].count} | Latency: ${pLatency}ms`);

        if (res.candidates && res.candidates.length > 0) {
          const normalized = res.candidates.map(cand => ({
            ...cand,
            source: cand.source || (provider.id === 'googleImages' ? 'google_search' : provider.id),
            sourceType: cand.sourceType || 'EXTERNAL_API_VERIFIED',
            matchType: cand.matchType || (isVisualCapability ? 'visual_match' : 'text_inferred'),
            platform: cand.platform || provider.name
          }));
          rawResults.push(...normalized);
        }
      } catch (err) {
        const pLatency = Date.now() - pStart;
        providerStatuses[provider.id] = {
          providerId: provider.id,
          name: provider.name,
          status: 'ERROR',
          count: 0,
          latencyMs: pLatency,
          reason: err.message,
          queryType: providerQueryType
        };
        console.warn(`[Discovery Provider Audit Error] Provider: ${provider.id} (${provider.name}) | Error: ${err.message}`);
      }
    });

    await Promise.all(searchPromises);

    // If Google Vision was in target providers but not run above (e.g. non-visual query)
    if (visionProvider && !providerStatuses[visionProvider.id]) {
      const vStart = Date.now();
      try {
        const vRes = await visionProvider.search(signals, opts);
        const vLatency = Date.now() - vStart;
        providerStatuses[visionProvider.id] = {
          providerId: visionProvider.id,
          name: visionProvider.name,
          status: vRes.status,
          count: vRes.count || (vRes.candidates ? vRes.candidates.length : 0),
          latencyMs: vLatency,
          reason: vRes.reason || null,
          queryType: 'REAL_VISUAL_QUERY'
        };
        if (vRes.candidates && vRes.candidates.length > 0) {
          rawResults.push(...vRes.candidates);
        }
      } catch (err) {
        providerStatuses[visionProvider.id] = {
          providerId: visionProvider.id,
          name: visionProvider.name,
          status: 'ERROR',
          count: 0,
          latencyMs: 0,
          reason: err.message,
          queryType: 'REAL_VISUAL_QUERY'
        };
      }
    }

    // Include closed or unconfigured platforms in status report
    const transparency = this.getTransparencyReport();
    for (const [key, p] of Object.entries(transparency)) {
      if (!providerStatuses[key]) {
        providerStatuses[key] = {
          providerId: key,
          name: p.name,
          status: p.status || (p.permanentUnavailable ? 'UNAVAILABLE' : 'NOT_CONFIGURED'),
          count: 0,
          reason: p.reason || 'Closed platform - no public reverse-media search API'
        };
      }
    }

    // 4. Real Visual Comparison on Candidates
    // If uploaded media is available, compute real pHash distance, cross-check with vision scores,
    // assign forensic classifications, and filter out UNRELATED candidates.
    let evaluatedCandidates = rawResults;
    let survivedCandidates = [];

    if (imageBuffer || uploadedHash) {
      evaluatedCandidates = await Promise.all(
        rawResults.map(cand => evaluateCandidateVisualSimilarity(cand, { uploadedHash, uploadedBuffer: imageBuffer }))
      );

      // Filter out UNRELATED candidates (< 0.70 similarity)
      for (const cand of evaluatedCandidates) {
        if (cand.classification !== MATCH_CLASSIFICATIONS.UNRELATED) {
          survivedCandidates.push(cand);
        }
      }
    } else {
      // Non-visual manual search with no media active: retain results with text-only status
      survivedCandidates = evaluatedCandidates;
    }

    // Server-side audit logging per provider
    for (const provider of targetProviders) {
      const pRaw = rawResults.filter(c => c.source === provider.id || c.source === 'google_search' && provider.id === 'googleImages');
      const pSurvived = survivedCandidates.filter(c => c.source === provider.id || c.source === 'google_search' && provider.id === 'googleImages');
      const isVisual = provider.id === 'google_vision';
      console.log(`[Forensic Audit Log] Provider: ${provider.id} (${provider.name}) | Query Type: ${isVisual ? 'REAL_VISUAL_QUERY' : 'TEXT_FALLBACK'} | Raw Results: ${pRaw.length} | Survived Similarity Threshold: ${pSurvived.length}`);
    }

    // Deduplicate candidates across providers by URL
    const deduped = deduplicateCandidates(survivedCandidates);

    // Forensically sort: prioritize derivatives/tampered matches over exact mirrors
    deduped.sort((a, b) => getForensicRelevanceScore(b) - getForensicRelevanceScore(a));

    // Pagination: 10 items per batch, up to 50 items max
    const page = Math.max(1, parseInt(opts.page, 10) || 1);
    const pageSize = Math.min(10, Math.max(1, parseInt(opts.pageSize, 10) || 10));
    const startIndex = (page - 1) * pageSize;
    const paginatedCandidates = deduped.slice(startIndex, startIndex + pageSize);
    const maxTotalAllowed = 50;
    const hasMore = deduped.length > (startIndex + pageSize) && (startIndex + pageSize) < maxTotalAllowed;

    const totalLatency = Date.now() - startTime;
    console.log(`[Discovery Audit Summary] Queried ${targetProviders.length} providers in ${totalLatency}ms. Raw candidates: ${rawResults.length}, Survived: ${deduped.length}, Page: ${page}. Zero fabricated fallbacks.`);

    return {
      candidates: paginatedCandidates,
      totalCount: deduped.length,
      page,
      pageSize,
      hasMore,
      maxReached: (startIndex + paginatedCandidates.length) >= maxTotalAllowed,
      providerStatuses,
      visualSummary: {
        isVisualSearch: Boolean(isVisualSearch),
        referenceHash: uploadedHash,
        rawCount: rawResults.length,
        survivedCount: deduped.length,
        filteredCount: Math.max(0, rawResults.length - deduped.length)
      },
      retrievedAt: new Date().toISOString()
    };
  }
}

export {
  RedditDiscoveryProvider,
  YouTubeDiscoveryProvider,
  MastodonDiscoveryProvider,
  ArchiveOrgDiscoveryProvider,
  GoogleImagesDiscoveryProvider,
  XDiscoveryProvider,
  InstagramDiscoveryProvider,
  GoogleVisionDiscoveryProvider
};
