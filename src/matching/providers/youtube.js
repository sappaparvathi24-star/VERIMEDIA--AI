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

  getApiKey() {
    return this.apiKey || process.env.YOUTUBE_API_KEY || null;
  }

  isConfigured() {
    return Boolean(this.getApiKey());
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        confidence: 'UNAVAILABLE',
        source: this.name,
        reason: 'API key not configured on this deployment',
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

    // Fall back to extracted visual signals: Vision API best-guess labels, OCR text, or caption
    if (!query || opts.isVisualSearch) {
      if (Array.isArray(opts.bestGuessLabels) && opts.bestGuessLabels.length > 0) {
        query = opts.bestGuessLabels[0];
      } else if (opts.ocrText) {
        query = opts.ocrText.slice(0, 100);
      } else if (opts.caption) {
        query = opts.caption;
      }
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        confidence: 'UNAVAILABLE',
        source: this.name,
        reason: 'API key not configured on this deployment',
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
        reason: 'No search query or extracted visual signal provided',
        isSystemAnalysisOnly: true,
        candidates: []
      };
    }

    try {
      const response = await searchYouTube(query, apiKey);
      if (!response.available) {
        return {
          providerId: this.id,
          status: 'UNAVAILABLE',
          confidence: 'UNAVAILABLE',
          source: this.name,
          reason: response.reason || 'YouTube API quota or service unavailable',
          isSystemAnalysisOnly: true,
          candidates: []
        };
      }

      const candidates = (response.results || []).map(item => ({
        url: item.url,
        title: item.title,
        platform: 'YouTube',
        author: item.channelTitle,
        source: 'youtube',
        sourceType: 'EXTERNAL_API_VERIFIED',
        matchType: 'text_inferred',
        matchTypeDetail: 'YouTube Data API lacks reverse-image search; searched via extracted visual signal / label fallback',
        inferredQueryUsed: query,
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
        confidence: candidates.length > 0 ? 'LIVE' : 'INSUFFICIENT_DATA',
        source: this.name,
        reason: candidates.length === 0 ? '0 matching candidates found on YouTube for this item' : null,
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

export default YouTubeDiscoveryProvider;
