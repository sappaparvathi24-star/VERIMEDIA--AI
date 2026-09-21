// VeriMedia AI — Instagram Discovery Provider
import { searchInstagram } from '../../proxy/searchProxy.js';

export class InstagramDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'instagram';
    this.name = 'Instagram';
    this.kind = 'EXTERNAL_API';
    this.accessToken = config.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || null;
    this.authRequired = true;
    this.permanentUnavailable = !this.accessToken;
  }

  isConfigured() {
    return Boolean(this.accessToken);
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'Closed platform — Direct reverse search API requires restricted Meta enterprise graph credentials'
      };
    }
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    // Instagram Graph API does not support reverse-image or visual-similarity searching.
    // For visual/image-driven discovery, honestly return UNSUPPORTED_BY_PLATFORM with zero candidates.
    if (opts.isVisualSearch || !opts.isManualTextSearch) {
      return {
        providerId: this.id,
        status: 'UNSUPPORTED_BY_PLATFORM',
        reason: 'Instagram Graph API does not provide a reverse-image or visual similarity search endpoint',
        matchType: 'unsupported_by_platform',
        candidates: []
      };
    }

    const query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        reason: 'Closed platform — Direct reverse search API requires restricted Meta enterprise graph credentials',
        candidates: []
      };
    }

    if (!query || !query.trim()) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No search query provided',
        candidates: []
      };
    }

    try {
      const directRes = await searchInstagram(query.trim(), opts);
      if (directRes && directRes.results && directRes.results.length > 0) {
        const candidates = directRes.results.map(item => ({
          url: item.url || `https://www.instagram.com/${item.author || ''}`,
          title: item.title || 'Instagram Post',
          platform: 'Instagram',
          author: item.author || 'Instagram User',
          sourceType: 'EXTERNAL_API_VERIFIED',
          publishedAt: new Date().toISOString(),
          timestampType: 'PUBLICATION_OBSERVED',
          timestampQuality: 'HIGH',
          retrievedAt: new Date().toISOString(),
          thumbnailUrl: item.thumbnailUrl || null,
          snippet: item.caption || item.title || '',
          similarityStatus: 'TEXT_MATCH_ONLY'
        }));
        return {
          providerId: this.id,
          status: 'AVAILABLE',
          count: candidates.length,
          candidates
        };
      }
    } catch (e) {
      return {
        providerId: this.id,
        status: 'ERROR',
        reason: e.message,
        candidates: []
      };
    }

    return {
      providerId: this.id,
      status: 'AVAILABLE',
      count: 0,
      candidates: []
    };
  }
}

