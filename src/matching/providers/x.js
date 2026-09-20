// VeriMedia AI — X (Twitter) Discovery Provider
import { searchX } from '../../proxy/searchProxy.js';

export class XDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'x';
    this.name = 'X (Twitter)';
    this.kind = 'EXTERNAL_API';
    this.apiKey = config.apiKey || process.env.X_API_KEY || null;
    this.accessToken = config.accessToken || process.env.X_ACCESS_TOKEN || null;
    this.authRequired = true;
    this.permanentUnavailable = !this.accessToken && !this.apiKey;
  }

  isConfigured() {
    return Boolean(this.accessToken || this.apiKey);
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'Closed platform — Direct reverse search API requires paid enterprise credentials'
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
        reason: 'Closed platform — Direct reverse search API requires paid enterprise credentials',
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
      const directRes = await searchX(query.trim(), opts);
      if (directRes && directRes.results && directRes.results.length > 0) {
        const candidates = directRes.results.map(item => ({
          url: item.url || `https://x.com/i/web/status/${item.id}`,
          title: item.title || item.text?.slice(0, 80) || 'X (Twitter) Post',
          platform: 'X (Twitter)',
          author: item.author || 'X User',
          sourceType: 'EXTERNAL_API_VERIFIED',
          publishedAt: item.created_at || new Date().toISOString(),
          timestampType: 'PUBLICATION_OBSERVED',
          timestampQuality: 'HIGH',
          retrievedAt: new Date().toISOString(),
          snippet: item.text || item.title || '',
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

