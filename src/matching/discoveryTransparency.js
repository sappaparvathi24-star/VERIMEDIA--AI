// VeriMedia AI — Discovery Transparency Matrix (Phase 15)

export const DISCOVERY_SOURCE_DEFINITIONS = [
  {
    id: 'localIndex',
    name: 'Local Device Index',
    category: 'Local Storage',
    description: 'Searches cryptographic SHA-256 and 64-bit pHash against all previously evaluated media artifacts in this instance.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'urlFetch',
    name: 'User-Supplied URL Comparison',
    category: 'Direct URL Retrieval',
    description: 'Fetches user-provided web/media target through SSRF-protected gateway to compare bitstream & metadata.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'reddit',
    name: 'Reddit Public Search',
    category: 'Social / Discussion',
    description: 'Public unauthenticated JSON search across Reddit submissions with post metadata, authors, and timestamps.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'youtube',
    name: 'YouTube Data API v3',
    category: 'Video Hosting',
    description: 'Video search with official upload timestamps, channel attribution, and high-res video thumbnails.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'mastodon',
    name: 'Mastodon Federated Timeline',
    category: 'Decentralized Social',
    description: 'Federated search across public Mastodon timelines (e.g., mastodon.social, mstdn.social) with media attachments.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'archiveOrg',
    name: 'Wayback Machine (archive.org)',
    category: 'Web Archive',
    description: 'Historical URL snapshot indexing via CDX API providing verifiable historical sighting timestamps.',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  {
    id: 'googleImages',
    name: 'Google Programmable Search (Images)',
    category: 'Web Index',
    description: 'Custom Search JSON API query with image filtering and thumbnail extraction (100 free queries/day limit).',
    isPermanentUnavailable: false,
    publicApiExists: true
  },
  // Permanent explicit notice items (Standing Rule 9)
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'Closed Social Platform',
    description: 'No public API exists for reverse-media or appearance discovery. Scraping violates ToS and is blocked.',
    isPermanentUnavailable: true,
    publicApiExists: false,
    permanentStatus: 'UNAVAILABLE — no public API exists'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Closed Social Platform',
    description: 'No public API exists for reverse-media or appearance discovery. Scraping violates ToS and is blocked.',
    isPermanentUnavailable: true,
    publicApiExists: false,
    permanentStatus: 'UNAVAILABLE — no public API exists'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'Closed Social Platform',
    description: 'No public API exists for reverse-media or appearance discovery. Scraping violates ToS and is blocked.',
    isPermanentUnavailable: true,
    publicApiExists: false,
    permanentStatus: 'UNAVAILABLE — no public API exists'
  },
  {
    id: 'x',
    name: 'X (formerly Twitter)',
    category: 'Closed Social Platform',
    description: 'No public API exists for reverse-media or appearance discovery. Scraping violates ToS and is blocked.',
    isPermanentUnavailable: true,
    publicApiExists: false,
    permanentStatus: 'UNAVAILABLE — no public API exists'
  }
];

export function getFullDiscoveryTransparency(providerStatuses = {}) {
  return DISCOVERY_SOURCE_DEFINITIONS.map(def => {
    if (def.isPermanentUnavailable) {
      return {
        ...def,
        status: 'UNAVAILABLE',
        reason: def.permanentStatus,
        resultCount: 0
      };
    }

    const current = providerStatuses[def.id] || {};
    return {
      ...def,
      status: current.status || (def.id === 'localIndex' || def.id === 'urlFetch' ? 'AVAILABLE' : 'UNCONFIGURED'),
      reason: current.reason || null,
      resultCount: current.count || 0
    };
  });
}
