// VeriMedia AI — X (Twitter) Discovery Provider
import { searchX, searchGoogleWeb } from '../../proxy/searchProxy.js';

export class XDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'x';
    this.name = 'X (Twitter)';
    this.kind = 'EXTERNAL_API';
    this.apiKey = config.apiKey || process.env.X_API_KEY || null;
    this.accessToken = config.accessToken || process.env.X_ACCESS_TOKEN || null;
    this.googleCseKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || null;
    this.googleCseCx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_SEARCH_ENGINE_ID || null;
    this.authRequired = false;
  }

  isConfigured() {
    return Boolean(
      this.accessToken ||
      this.apiKey ||
      (this.googleCseKey && this.googleCseCx)
    );
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'X credentials or Google CSE (site:x.com) not configured'
      };
    }
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    if (!query || !query.trim()) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No search query provided',
        candidates: []
      };
    }

    // 1. If direct X API credentials are present
    if (this.accessToken || this.apiKey) {
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
        console.warn('Direct X API query failed, falling back to Google site:x.com search:', e.message);
      }
    }

    // 2. Query via Google Search CSE targeted to X / Twitter
    if (this.googleCseKey && this.googleCseCx) {
      try {
        const siteQuery = `site:x.com OR site:twitter.com ${query.trim()}`;
        const webRes = await searchGoogleWeb(siteQuery, this.googleCseKey, this.googleCseCx);
        if (webRes && webRes.results && webRes.results.length > 0) {
          const candidates = webRes.results
            .filter(r => (r.link && (r.link.includes('x.com') || r.link.includes('twitter.com'))))
            .map(item => ({
              url: item.link,
              title: item.title || 'X Post',
              platform: 'X (Twitter)',
              author: item.displayLink || 'x.com',
              sourceType: 'EXTERNAL_API_VERIFIED',
              publishedAt: null,
              timestampType: 'UNKNOWN',
              timestampQuality: 'MODERATE',
              retrievedAt: new Date().toISOString(),
              snippet: item.snippet || '',
              similarityStatus: 'TEXT_MATCH_ONLY'
            }));

          return {
            providerId: this.id,
            status: 'AVAILABLE',
            count: candidates.length,
            candidates
          };
        }
      } catch (err) {
        return {
          providerId: this.id,
          status: 'ERROR',
          reason: err.message,
          candidates: []
        };
      }
    }

    return {
      providerId: this.id,
      status: 'UNAVAILABLE',
      reason: 'X credentials or Google CSE not configured',
      candidates: []
    };
  }
}
