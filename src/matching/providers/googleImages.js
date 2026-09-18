// VeriMedia AI — Google Programmable Search (Images) Provider (Phase 15)
import { searchGoogleImages } from '../../proxy/searchProxy.js';

export class GoogleImagesDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'googleImages';
    this.name = 'Google Programmable Search (Images)';
    this.kind = 'EXTERNAL_API';
    this.apiKey = config.apiKey || process.env.GOOGLE_CSE_API_KEY || null;
    this.cx = config.cx || process.env.GOOGLE_CSE_CX || null;
    this.authRequired = true;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.cx);
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'Google Programmable Search key/cx not configured on this deployment'
      };
    }
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        reason: 'Google Programmable Search key/cx not configured on this deployment',
        candidates: []
      };
    }

    if (!query) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No search query or signal provided',
        candidates: []
      };
    }

    try {
      const response = await searchGoogleImages(query, this.apiKey, this.cx);
      if (!response.available) {
        return {
          providerId: this.id,
          status: 'UNAVAILABLE',
          reason: response.reason,
          quotaReached: response.quotaReached,
          candidates: []
        };
      }

      const candidates = (response.results || []).map(item => ({
        url: item.contextLink || item.link,
        mediaUrl: item.imageUrl,
        title: item.title,
        platform: `Web (${item.displayLink})`,
        author: item.displayLink,
        sourceType: 'EXTERNAL_API_VERIFIED',
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
        count: candidates.length,
        candidates
      };
    } catch (err) {
      return {
        providerId: this.id,
        status: 'ERROR',
        reason: err.message,
        candidates: []
      };
    }
  }
}

export default GoogleImagesDiscoveryProvider;
