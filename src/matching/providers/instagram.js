// VeriMedia AI — Instagram Discovery Provider
import { searchInstagram, searchGoogleWeb } from '../../proxy/searchProxy.js';

export class InstagramDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'instagram';
    this.name = 'Instagram';
    this.kind = 'EXTERNAL_API';
    this.accessToken = config.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || null;
    this.googleCseKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || null;
    this.googleCseCx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_SEARCH_ENGINE_ID || null;
    this.authRequired = false;
  }

  isConfigured() {
    return Boolean(
      this.accessToken ||
      (this.googleCseKey && this.googleCseCx)
    );
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'Instagram token or Google CSE (site:instagram.com) not configured'
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

    // 1. Direct Instagram Graph API if available
    if (this.accessToken) {
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
        console.warn('Direct Instagram query failed, falling back to Google site:instagram.com search:', e.message);
      }
    }

    // 2. Query via Google Search CSE targeted to Instagram
    if (this.googleCseKey && this.googleCseCx) {
      try {
        const siteQuery = `site:instagram.com ${query.trim()}`;
        const webRes = await searchGoogleWeb(siteQuery, this.googleCseKey, this.googleCseCx);
        if (webRes && webRes.results && webRes.results.length > 0) {
          const candidates = webRes.results
            .filter(r => (r.link && r.link.includes('instagram.com')))
            .map(item => ({
              url: item.link,
              title: item.title || 'Instagram Media / Post',
              platform: 'Instagram',
              author: item.displayLink || 'instagram.com',
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
      reason: 'Instagram token or Google CSE not configured',
      candidates: []
    };
  }
}
