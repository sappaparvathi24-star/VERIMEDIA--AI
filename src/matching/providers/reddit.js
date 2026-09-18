// VeriMedia AI — Reddit Provider (Phase 15)
import { searchReddit } from '../../proxy/searchProxy.js';

export class RedditDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'reddit';
    this.name = 'Reddit Search';
    this.kind = 'EXTERNAL_API';
    this.authRequired = false;
  }

  isConfigured() {
    return true; // No key required for public read-only search
  }

  status() {
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    if (!query) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No search query or signal provided',
        candidates: []
      };
    }

    try {
      const rawResults = await searchReddit(query, opts);
      const candidates = rawResults.map(item => ({
        url: item.permalink,
        mediaUrl: item.mediaUrl || item.url,
        title: item.title,
        platform: 'Reddit',
        author: item.author ? `u/${item.author}` : null,
        subreddit: item.subreddit ? `r/${item.subreddit}` : null,
        sourceType: 'EXTERNAL_API_VERIFIED',
        publishedAt: item.publishedAt,
        timestampType: 'PUBLICATION_OBSERVED',
        timestampQuality: 'HIGH',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: item.thumbnailUrl,
        similarityStatus: item.thumbnailUrl ? 'PERCEPTUAL_UNMEASURED' : 'TEXT_MATCH_ONLY',
        metadata: {
          redditPostId: item.id,
          isVideo: item.isVideo
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

export default RedditDiscoveryProvider;
