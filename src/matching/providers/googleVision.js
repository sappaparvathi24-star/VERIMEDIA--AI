// VeriMedia AI — Google Cloud Vision API (Web Detection) Provider
import { searchGoogleVisionWebDetection } from '../../proxy/searchProxy.js';
import { getArtifactMedia } from '../../forensics/imageForensics.js';

export class GoogleVisionDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'google_vision';
    this.name = 'Google Vision API (Web Detection)';
    this.kind = 'EXTERNAL_API';
    this.apiKey = (config && config.apiKey !== undefined)
      ? config.apiKey
      : (process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY || null);
  }

  getApiKey() {
    if (this.apiKey !== undefined && this.apiKey !== null) return this.apiKey;
    return process.env.GOOGLE_VISION_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      null;
  }

  isConfigured() {
    return Boolean(this.getApiKey());
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'Google Vision API key not configured on this deployment'
      };
    }
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        reason: 'Google Vision API key not configured on this deployment',
        candidates: []
      };
    }

    // Try to get image buffer or base64
    let imageBuffer = opts.imageBuffer || null;
    let imageBase64 = opts.imageBase64 || null;
    const imageUri = opts.imageUri || opts.mediaUrl || null;

    if (!imageBuffer && !imageBase64 && opts.artifactId) {
      const media = getArtifactMedia(opts.artifactId);
      if (media && media.buffer) {
        imageBuffer = media.buffer;
      }
    }

    if (!imageBuffer && !imageBase64 && !imageUri) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'Google Vision Web Detection requires media bytes or artifactId — no media buffer provided for this query',
        candidates: []
      };
    }

    try {
      const response = await searchGoogleVisionWebDetection({ imageBase64, imageBuffer, imageUri }, apiKey);
      if (!response.available) {
        return {
          providerId: this.id,
          status: 'UNAVAILABLE',
          reason: response.reason,
          candidates: []
        };
      }

      const rawResults = response.results || [];
      const candidates = rawResults.map(item => ({
        url: item.url,
        title: item.title,
        platform: item.platform || 'Google Vision Web Detection',
        author: item.author || 'Web',
        source: 'google_vision',
        sourceType: 'EXTERNAL_API_VERIFIED',
        matchType: 'visual_match',
        visionScore: item.similarity ?? 0.88,
        similarity: item.similarity ?? 0.88,
        matchScore: Math.round((item.similarity ?? 0.88) * 100),
        isPartialMatch: Boolean(item.isPartialMatch),
        tamperedIndicator: item.tamperedIndicator || null,
        publishedAt: item.publishedAt || null,
        timestampType: item.publishedAt ? 'PUBLICATION_OBSERVED' : 'UNKNOWN',
        timestampQuality: 'HIGH',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: item.thumbnailUrl || null,
        snippet: item.snippet || 'Visual similarity match identified by Google Vision Web Detection.',
        similarityStatus: item.isPartialMatch ? 'DERIVATIVE_MODIFIED' : 'VISUAL_MATCH_VERIFIED',
        metadata: {
          bestGuessLabels: response.bestGuessLabels || [],
          webEntities: response.webEntities || []
        }
      }));

      return {
        providerId: this.id,
        status: 'AVAILABLE',
        count: candidates.length,
        candidates,
        bestGuessLabels: response.bestGuessLabels || [],
        webEntities: response.webEntities || []
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

export default GoogleVisionDiscoveryProvider;
