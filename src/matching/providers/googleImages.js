// VeriMedia AI — Google Programmable Search (Images) Provider (Phase 15)
import { searchGoogleImages } from '../../proxy/searchProxy.js';

export class GoogleImagesDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'googleImages';
    this.name = 'Google Programmable Search (Images)';
    this.kind = 'EXTERNAL_API';
    // Canonical: GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX; legacy fallbacks supported
    this.apiKey = config.apiKey || process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || null;
    this.cx = config.cx || process.env.GOOGLE_CSE_CX || process.env.GOOGLE_SEARCH_ENGINE_ID || null;
    this.authRequired = true;
  }

  getCredentials() {
    const apiKey = this.apiKey || process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || null;
    const cx = this.cx || process.env.GOOGLE_CSE_CX || process.env.GOOGLE_SEARCH_ENGINE_ID || null;
    return { apiKey, cx };
  }

  isConfigured() {
    const { apiKey, cx } = this.getCredentials();
    return Boolean(apiKey && cx);
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        confidence: 'UNAVAILABLE',
        source: this.name,
        reason: 'Google Programmable Search key/cx not configured on this deployment',
        isSystemAnalysisOnly: true
      };
    }
    return {
      status: 'AVAILABLE',
      confidence: 'LIVE',
      source: this.name,
      reason: null,
      isSystemAnalysisOnly: false
    };
  }

  async search(signals, opts = {}) {
    let query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    if (!query && opts.bestGuessLabels && opts.bestGuessLabels.length > 0) {
      query = opts.bestGuessLabels[0];
    } else if (!query && opts.caption) {
      query = opts.caption;
    }

    const { apiKey, cx } = this.getCredentials();
    if (!apiKey || !cx) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        confidence: 'UNAVAILABLE',
        source: this.name,
        reason: 'Google Programmable Search key/cx not configured on this deployment',
        isSystemAnalysisOnly: true,
        candidates: []
      };
    }

    if (!query) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        confidence: 'INSUFFICIENT_DATA',
        source: this.name,
        reason: 'No search query or visual signal provided',
        isSystemAnalysisOnly: true,
        candidates: []
      };
    }

    try {
      const response = await searchGoogleImages(query, apiKey, cx);
      if (!response.available) {
        return {
          providerId: this.id,
          status: 'UNAVAILABLE',
          confidence: response.quotaReached ? 'DEGRADED' : 'UNAVAILABLE',
          source: this.name,
          reason: response.reason || 'Google Programmable Search unavailable',
          quotaReached: response.quotaReached,
          isSystemAnalysisOnly: true,
          candidates: []
        };
      }

      const candidates = (response.results || []).map(item => ({
        url: item.contextLink || item.link,
        mediaUrl: item.imageUrl,
        title: item.title,
        platform: `Web (${item.displayLink})`,
        author: item.displayLink,
        source: 'googleImages',
        sourceType: 'EXTERNAL_API_VERIFIED',
        matchType: opts.imageUri ? 'visual_match' : 'text_inferred',
        publishedAt: null, // Google CSE images does not guarantee exact publication date
        timestampType: 'UNKNOWN',
        timestampQuality: 'MODERATE',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: item.thumbnailUrl,
        snippet: item.snippet,
        similarityStatus: item.thumbnailUrl ? 'PERCEPTUAL_UNMEASURED' : 'TEXT_MATCH_ONLY',
        metadata: {
          width: item.width,
          height: item.height,
          byteSize: item.byteSize
        }
      }));

      return {
        providerId: this.id,
        status: 'AVAILABLE',
        confidence: candidates.length > 0 ? 'LIVE' : 'INSUFFICIENT_DATA',
        source: this.name,
        reason: candidates.length === 0 ? '0 matching images found via Google Programmable Search' : null,
        isSystemAnalysisOnly: false,
        count: candidates.length,
        candidates
      };
    } catch (err) {
      return {
        providerId: this.id,
        status: 'ERROR',
        confidence: 'UNAVAILABLE',
        source: this.name,
        reason: err.message,
        isSystemAnalysisOnly: true,
        candidates: []
      };
    }
  }
}

export default GoogleImagesDiscoveryProvider;
