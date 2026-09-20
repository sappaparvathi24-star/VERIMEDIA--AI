// VeriMedia AI — Provider Registry & Discovery Manager
import { YouTubeDiscoveryProvider } from './youtube.js';
import { GoogleImagesDiscoveryProvider } from './googleImages.js';
import { RedditDiscoveryProvider } from './reddit.js';
import { MastodonDiscoveryProvider } from './mastodon.js';
import { ArchiveOrgDiscoveryProvider } from './archiveOrg.js';
import { XDiscoveryProvider } from './x.js';
import { InstagramDiscoveryProvider } from './instagram.js';
import { getDiscoveryHealth } from '../../proxy/searchProxy.js';

export class MultiSourceDiscoveryManager {
  constructor(config = {}) {
    this.providers = new Map();
    
    // Register the 5 primary discovery platforms
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

  getTransparencyReport() {
    const health = getDiscoveryHealth();
    return health.providers;
  }

  /**
   * Searches across selected or all active providers in parallel.
   */
  async searchAll(signals, opts = {}) {
    const results = [];
    const providerStatuses = {
      instagram: { status: 'UNAVAILABLE', count: 0, reason: 'Closed platform' },
      tiktok: { status: 'UNAVAILABLE', count: 0, reason: 'Closed platform' },
      facebook: { status: 'UNAVAILABLE', count: 0, reason: 'Closed platform' },
      x: { status: 'UNAVAILABLE', count: 0, reason: 'Closed platform' }
    };

    let targetProviders = this.getAllProviders();
    if (opts.platforms && Array.isArray(opts.platforms) && opts.platforms.length > 0) {
      targetProviders = targetProviders.filter(p => 
        opts.platforms.includes(p.id) || 
        opts.platforms.includes(p.name) || 
        (opts.platforms.includes('google-search-api') && (p.id === 'googleImages' || p.id === 'googleSearch'))
      );
    } else if (opts.provider) {
      targetProviders = targetProviders.filter(p => p.id === opts.provider || p.name === opts.provider);
    }

    const searchPromises = targetProviders.map(async (provider) => {
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

    return {
      candidates: results,
      totalCount: results.length,
      providerStatuses,
      retrievedAt: new Date().toISOString()
    };
  }
}

export {
  YouTubeDiscoveryProvider,
  GoogleImagesDiscoveryProvider,
  RedditDiscoveryProvider,
  MastodonDiscoveryProvider,
  ArchiveOrgDiscoveryProvider,
  XDiscoveryProvider,
  InstagramDiscoveryProvider
};
