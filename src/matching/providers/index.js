// VeriMedia AI — Provider Registry & Discovery Manager (Phase 15)
import { RedditDiscoveryProvider } from './reddit.js';
import { YouTubeDiscoveryProvider } from './youtube.js';
import { MastodonDiscoveryProvider } from './mastodon.js';
import { ArchiveOrgDiscoveryProvider } from './archiveOrg.js';
import { GoogleImagesDiscoveryProvider } from './googleImages.js';
import { getDiscoveryHealth } from '../../proxy/searchProxy.js';

export class MultiSourceDiscoveryManager {
  constructor(config = {}) {
    this.providers = new Map();
    
    // Register the 5 honest providers
    this.registerProvider(new RedditDiscoveryProvider(config.reddit));
    this.registerProvider(new YouTubeDiscoveryProvider(config.youtube));
    this.registerProvider(new MastodonDiscoveryProvider(config.mastodon));
    this.registerProvider(new ArchiveOrgDiscoveryProvider(config.archiveOrg));
    this.registerProvider(new GoogleImagesDiscoveryProvider(config.googleImages));
  }

  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id) {
    return this.providers.get(id);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Returns complete Discovery Transparency matrix.
   * NOTE: Instagram, TikTok, Facebook, X are PERMANENTLY marked UNAVAILABLE.
   */
  getTransparencyReport() {
    const health = getDiscoveryHealth();
    return health.providers;
  }

  /**
   * Searches across all active/available providers in parallel.
   */
  async searchAll(signals, opts = {}) {
    const results = [];
    const providerStatuses = {};

    const searchPromises = this.getAllProviders().map(async (provider) => {
      try {
        const res = await provider.search(signals, opts);
        providerStatuses[provider.id] = {
          status: res.status,
          count: res.count || 0,
          reason: res.reason || null
        };
        if (res.candidates && res.candidates.length > 0) {
          results.push(...res.candidates);
        }
      } catch (err) {
        providerStatuses[provider.id] = {
          status: 'ERROR',
          count: 0,
          reason: err.message
        };
      }
    });

    await Promise.all(searchPromises);

    // Also include the permanent unavailable platforms in the status report
    providerStatuses.instagram = { status: 'UNAVAILABLE', count: 0, reason: 'No public media-search API exists' };
    providerStatuses.tiktok = { status: 'UNAVAILABLE', count: 0, reason: 'No public media-search API exists' };
    providerStatuses.facebook = { status: 'UNAVAILABLE', count: 0, reason: 'No public media-search API exists' };
    providerStatuses.x = { status: 'UNAVAILABLE', count: 0, reason: 'No public media-search API exists' };

    return {
      candidates: results,
      totalCount: results.length,
      providerStatuses,
      retrievedAt: new Date().toISOString()
    };
  }
}

export {
  RedditDiscoveryProvider,
  YouTubeDiscoveryProvider,
  MastodonDiscoveryProvider,
  ArchiveOrgDiscoveryProvider,
  GoogleImagesDiscoveryProvider
};

export default MultiSourceDiscoveryManager;
