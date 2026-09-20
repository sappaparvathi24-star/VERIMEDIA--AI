// VeriMedia AI — Real Multi-Source Search Proxy (Phase 15)
// Stateless pass-through proxy with 10-min caching, rate limiting, and 0 fabrication.
import https from 'https';
import http from 'http';
import { checkRateLimit } from '../security/rateLimiter.js';

export { checkRateLimit };

// In-memory 10-minute cache
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Google CSE daily quota tracker (resets at UTC midnight)
let googleCseDailyCount = 0;
let googleCseLastResetDate = new Date().toISOString().slice(0, 10);

function checkGoogleQuota() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== googleCseLastResetDate) {
    googleCseDailyCount = 0;
    googleCseLastResetDate = today;
  }
  return googleCseDailyCount < 95; // Leave 5 queries buffer
}

function incrementGoogleQuota() {
  googleCseDailyCount++;
}

export function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

export function setCached(key, data) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

const DISCOVERY_TIMEOUT_MS = parseInt(process.env.DISCOVERY_TIMEOUT_MS, 10) || 15000;

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(urlObj, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || DISCOVERY_TIMEOUT_MS
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Upstream returned HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upstream request timed out'));
    });
    req.end();
  });
}

/**
 * 1. Reddit Search Provider
 * GET /search/reddit?q=<query>&after=<epoch>
 */
export async function searchReddit(query, options = {}) {
  if (!query || !query.trim()) return [];
  const cacheKey = `reddit:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query.trim())}&sort=new&limit=25`;
  const data = await fetchJson(url, {
    headers: {
      'User-Agent': 'VeriMediaAI-ProvenanceEngine/1.0 (Media Rights & Forensics Research)'
    }
  });

  const children = data?.data?.children || [];
  const results = children.map(child => {
    const post = child.data || {};
    const createdUtc = post.created_utc ? post.created_utc * 1000 : null;
    return {
      id: post.id,
      title: post.title,
      url: post.url,
      permalink: `https://reddit.com${post.permalink}`,
      author: post.author,
      subreddit: post.subreddit,
      createdUtc: createdUtc ? new Date(createdUtc).toISOString() : null,
      publishedAt: createdUtc ? new Date(createdUtc).toISOString() : null,
      thumbnailUrl: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : null,
      isVideo: Boolean(post.is_video),
      mediaUrl: post.media?.reddit_video?.fallback_url || post.url_overridden_by_dest || post.url || null
    };
  });

  setCached(cacheKey, results);
  return results;
}

/**
 * 2. YouTube Search Provider
 * GET /search/youtube?q=<query>
 */
export async function searchYouTube(query, apiKey = process.env.YOUTUBE_API_KEY) {
  if (!query || !query.trim()) return [];
  if (!apiKey) {
    return {
      available: false,
      reason: 'YouTube API key not configured on this deployment',
      results: []
    };
  }

  const cacheKey = `youtube:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(query.trim())}&key=${apiKey}`;
  const data = await fetchJson(url);

  const items = data?.items || [];
  const results = items.map(item => {
    const snippet = item.snippet || {};
    return {
      videoId: item.id?.videoId,
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      title: snippet.title,
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
      description: snippet.description
    };
  });

  const payload = {
    available: true,
    results
  };

  setCached(cacheKey, payload);
  return payload;
}

/**
 * 3. Mastodon Search Provider
 * GET /search/mastodon?q=<query>&instance=<hostname>
 */
const MASTODON_INSTANCE_ALLOWLIST = ['mastodon.social', 'mstdn.social', 'mastodon.world', 'fosstodon.org'];

export async function searchMastodon(query, instance = 'mastodon.social') {
  if (!query || !query.trim()) return [];
  const targetInstance = MASTODON_INSTANCE_ALLOWLIST.includes(instance) ? instance : 'mastodon.social';

  const cacheKey = `mastodon:${targetInstance}:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://${targetInstance}/api/v2/search?q=${encodeURIComponent(query.trim())}&type=statuses&limit=20`;
  const data = await fetchJson(url, {
    headers: {
      'User-Agent': 'VeriMediaAI-ProvenanceEngine/1.0'
    }
  });

  const statuses = data?.statuses || [];
  const results = statuses.map(status => ({
    id: status.id,
    url: status.url,
    createdAt: status.created_at,
    publishedAt: status.created_at,
    account: status.account ? {
      username: status.account.username,
      displayName: status.account.display_name,
      url: status.account.url,
      avatar: status.account.avatar
    } : null,
    content: status.content ? status.content.replace(/<[^>]+>/g, '') : '',
    mediaAttachments: (status.media_attachments || []).map(m => ({
      type: m.type,
      url: m.url,
      previewUrl: m.preview_url,
      description: m.description
    })),
    instance: targetInstance
  }));

  setCached(cacheKey, results);
  return results;
}

/**
 * 4. Wayback Machine Snapshot Provider
 * GET /archive/snapshots?url=<targetUrl>
 */
export async function searchArchiveOrg(targetUrl) {
  if (!targetUrl || !targetUrl.trim()) return [];
  const cacheKey = `archive:${targetUrl.trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(targetUrl.trim())}&output=json&limit=30`;
  const data = await fetchJson(url);

  if (!Array.isArray(data) || data.length <= 1) {
    setCached(cacheKey, []);
    return [];
  }

  // The first element is header: ["urlkey","timestamp","original","mimetype","statuscode","digest","length"]
  const headers = data[0];
  const rows = data.slice(1);

  const results = rows.map(row => {
    const ts = row[1]; // e.g. 20240315120000 -> YYYY-MM-DDTHH:mm:ssZ
    let formattedDate = null;
    if (ts && ts.length >= 14) {
      const year = ts.slice(0, 4);
      const month = ts.slice(4, 6);
      const day = ts.slice(6, 8);
      const hour = ts.slice(8, 10);
      const min = ts.slice(10, 12);
      const sec = ts.slice(12, 14);
      formattedDate = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    }

    return {
      timestamp: ts,
      publishedAt: formattedDate,
      originalUrl: row[2],
      archivedUrl: `https://web.archive.org/web/${ts}/${row[2]}`,
      mimeType: row[3],
      statusCode: row[4],
      digest: row[5]
    };
  });

  setCached(cacheKey, results);
  return results;
}

/**
 * 5. Google Programmable Search (Custom Search JSON API)
 * GET /search/google-images?q=<query>
 */
export async function searchGoogleImages(query, apiKey = process.env.GOOGLE_CSE_API_KEY, cx = process.env.GOOGLE_CSE_CX) {
  if (!query || !query.trim()) return [];
  if (!apiKey || !cx) {
    return {
      available: false,
      reason: 'Google Programmable Search key/cx not configured on this deployment',
      results: []
    };
  }

  if (!checkGoogleQuota()) {
    return {
      available: false,
      quotaReached: true,
      reason: 'Daily search quota reached (100 free queries/day limit)',
      results: []
    };
  }

  const cacheKey = `google:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://www.googleapis.com/customsearch/v1?searchType=image&num=10&q=${encodeURIComponent(query.trim())}&key=${apiKey}&cx=${cx}`;
  incrementGoogleQuota();

  const data = await fetchJson(url);
  const items = data?.items || [];
  const results = items.map(item => ({
    title: item.title,
    link: item.link,
    displayLink: item.displayLink,
    snippet: item.snippet,
    imageUrl: item.link,
    thumbnailUrl: item.image?.thumbnailLink || item.link,
    contextLink: item.image?.contextLink,
    byteSize: item.image?.byteSize || null,
    width: item.image?.width || null,
    height: item.image?.height || null
  }));

  const payload = {
    available: true,
    results
  };

  setCached(cacheKey, payload);
  return payload;
}

/**
 * Discovery Health Status
 */
export function getDiscoveryHealth() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: {
      reddit: {
        id: 'reddit',
        name: 'Reddit Search',
        available: true,
        authRequired: false,
        reason: null
      },
      youtube: {
        id: 'youtube',
        name: 'YouTube Data API v3',
        available: Boolean(process.env.YOUTUBE_API_KEY),
        authRequired: true,
        reason: process.env.YOUTUBE_API_KEY ? null : 'API key not configured on this deployment'
      },
      mastodon: {
        id: 'mastodon',
        name: 'Mastodon Federated Public Timeline',
        available: true,
        authRequired: false,
        instances: MASTODON_INSTANCE_ALLOWLIST,
        reason: null
      },
      archiveOrg: {
        id: 'archiveOrg',
        name: 'Wayback Machine (archive.org)',
        available: true,
        authRequired: false,
        reason: null
      },
      googleImages: {
        id: 'googleImages',
        name: 'Google Programmable Search (Images)',
        available: Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX),
        authRequired: true,
        reason: (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) ? null : 'API key/CX not configured on this deployment'
      },
      // Permanent explicit zero-fabrication markers
      instagram: {
        id: 'instagram',
        name: 'Instagram',
        available: false,
        permanentUnavailable: true,
        reason: 'No public media-search API exists'
      },
      tiktok: {
        id: 'tiktok',
        name: 'TikTok',
        available: false,
        permanentUnavailable: true,
        reason: 'No public media-search API exists'
      },
      facebook: {
        id: 'facebook',
        name: 'Facebook',
        available: false,
        permanentUnavailable: true,
        reason: 'No public media-search API exists'
      },
      x: {
        id: 'x',
        name: 'X (formerly Twitter)',
        available: false,
        permanentUnavailable: true,
        reason: 'No public media-search API exists'
      }
    }
  };
}
