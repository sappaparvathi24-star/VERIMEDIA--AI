// VeriMedia AI — YouTube Provider (Phase 15)
import { searchYouTube } from '../../proxy/searchProxy.js';

export class YouTubeDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'youtube';
    this.name = 'YouTube Data API v3';
    this.kind = 'EXTERNAL_API';
    this.apiKey = config.apiKey || process.env.YOUTUBE_API_KEY || null;
    this.authRequired = true;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'API key not configured on this deployment'
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
        reason: 'API key not configured on this deployment',
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
      const response = await searchYouTube(query, this.apiKey);
      if (!response.available) {
        return {
          providerId: this.id,
          status: 'UNAVAILABLE',
          reason: response.reason,
          candidates: []
        };
      }

      const candidates = (response.results || []).map(item => ({
        url: item.url,
        title: item.title,
        platform: 'YouTube',
        author: item.channelTitle,
        sourceType: 'EXTERNAL_API_VERIFIED',
        publishedAt: item.publishedAt,
        timestampType: 'PUBLICATION_OBSERVED',
        timestampQuality: 'HIGH',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: item.thumbnailUrl,
        description: item.description,
        similarityStatus: item.thumbnailUrl ? 'PERCEPTUAL_UNMEASURED' : 'TEXT_MATCH_ONLY',
        metadata: {
          videoId: item.videoId
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

export default YouTubeDiscoveryProvider;
