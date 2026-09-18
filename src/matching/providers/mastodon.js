// VeriMedia AI — Mastodon Provider (Phase 15)
import { searchMastodon } from '../../proxy/searchProxy.js';

export class MastodonDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'mastodon';
    this.name = 'Mastodon Federated Timeline';
    this.kind = 'EXTERNAL_API';
    this.defaultInstance = config.instance || 'mastodon.social';
    this.authRequired = false;
  }

  isConfigured() {
    return true;
  }

  status() {
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const query = typeof signals === 'string' ? signals : signals?.query || signals?.[0]?.term;
    const instance = opts.instance || this.defaultInstance;

    if (!query) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No search query or signal provided',
        candidates: []
      };
    }

    try {
      const rawResults = await searchMastodon(query, instance);
      const candidates = rawResults.map(item => ({
        url: item.url,
        title: item.content ? item.content.slice(0, 120) : `Mastodon Post (${item.id})`,
        platform: `Mastodon@${item.instance}`,
        author: item.account ? `@${item.account.username}` : null,
        sourceType: 'EXTERNAL_API_VERIFIED',
        publishedAt: item.publishedAt,
        timestampType: 'PUBLICATION_OBSERVED',
        timestampQuality: 'HIGH',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: item.mediaAttachments?.[0]?.previewUrl || null,
        mediaUrl: item.mediaAttachments?.[0]?.url || null,
        similarityStatus: item.mediaAttachments?.length > 0 ? 'PERCEPTUAL_UNMEASURED' : 'TEXT_MATCH_ONLY',
        metadata: {
          statusId: item.id,
          instance: item.instance,
          attachmentCount: item.mediaAttachments?.length || 0
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

export default MastodonDiscoveryProvider;
