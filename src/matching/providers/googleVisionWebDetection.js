// VeriMedia AI — Google Cloud Vision Web Detection Discovery Provider
// Genuine image-bytes reverse search provider via Google Vision API (WEB_DETECTION)
// Protected by free-tier monthly quota guard to prevent accidental overages.

import {
  canUseVisionApi,
  incrementVisionCallCount,
  getMonthlyVisionCallCount,
  DEFAULT_MONTHLY_LIMIT
} from '../visionQuotaGuard.js';
import { CandidateRelationshipType } from '../../provenance/core.js';

export class GoogleVisionWebDetectionProvider {
  constructor(config = {}) {
    this.id = 'googleVisionWebDetection';
    this.name = 'Google Cloud Vision — Web Detection';
    this.kind = 'EXTERNAL_API';
    this.apiKey = config.apiKey ||
      process.env.GOOGLE_VISION_API_KEY ||
      process.env.GOOGLE_SEARCH_API_KEY ||
      process.env.GOOGLE_CSE_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      null;
    this.authRequired = true;
    this.permanentUnavailable = false;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim());
  }

  status() {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        reason: 'GOOGLE_VISION_API_KEY not configured on this deployment'
      };
    }
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  /**
   * Performs reverse image web detection search using raw image bytes.
   * @param {object|string} signalsOrPayload - Can be an object with { imageBase64 } or options
   * @param {object} [opts] - Additional options
   */
  async search(signalsOrPayload = {}, opts = {}) {
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        reason: 'GOOGLE_VISION_API_KEY not configured on this deployment',
        candidates: []
      };
    }

    // Free-tier Quota Check: Prevent exceeding monthly free requests allowance
    const limit = Number(process.env.GOOGLE_VISION_MONTHLY_LIMIT || DEFAULT_MONTHLY_LIMIT);
    if (!canUseVisionApi()) {
      return {
        providerId: this.id,
        status: 'QUOTA_EXCEEDED',
        reason: `Monthly free-tier limit (${limit} requests) reached — Vision API disabled to avoid charges. Resets next calendar month, or raise GOOGLE_VISION_MONTHLY_LIMIT if you want to allow paid usage.`,
        candidates: []
      };
    }

    // Extract raw base64 image data
    let imageBase64 = null;
    let imageUri = null;

    if (typeof signalsOrPayload === 'string') {
      if (signalsOrPayload.startsWith('data:') || /^[A-Za-z0-9+/=]{100,}$/.test(signalsOrPayload.trim())) {
        imageBase64 = signalsOrPayload;
      }
    } else if (typeof signalsOrPayload === 'object' && signalsOrPayload !== null) {
      imageBase64 = signalsOrPayload.imageBase64 ||
        signalsOrPayload.imageContent ||
        signalsOrPayload.content ||
        signalsOrPayload.previewDataUrl ||
        null;
      imageUri = signalsOrPayload.mediaUrl || signalsOrPayload.imageUri || signalsOrPayload.url || null;
    }

    if (!imageBase64 && opts) {
      imageBase64 = opts.imageBase64 || opts.imageContent || opts.content || opts.previewDataUrl || null;
      if (!imageUri) {
        imageUri = opts.mediaUrl || opts.imageUri || opts.url || null;
      }
    }

    // Clean data URI prefix if present
    if (imageBase64 && typeof imageBase64 === 'string') {
      const commaIdx = imageBase64.indexOf(',');
      if (imageBase64.startsWith('data:') && commaIdx !== -1) {
        imageBase64 = imageBase64.slice(commaIdx + 1);
      }
    }

    if (imageUri && typeof imageUri === 'string' && imageUri.startsWith('data:')) {
      const commaIdx = imageUri.indexOf(',');
      if (commaIdx !== -1) {
        imageBase64 = imageUri.slice(commaIdx + 1);
        imageUri = null;
      }
    }

    if (!imageBase64 && !imageUri) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'No image bytes or image URI provided for reverse image search',
        candidates: []
      };
    }

    const imagePayload = imageBase64
      ? { content: imageBase64 }
      : { source: { imageUri } };

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(this.apiKey)}`;
    const requestBody = {
      requests: [
        {
          image: imagePayload,
          features: [
            {
              type: 'WEB_DETECTION',
              maxResults: 20
            }
          ]
        }
      ]
    };

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      throw new Error(`Google Cloud Vision API network failure: ${netErr.message}`);
    }

    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch (_) {
        errBody = { error: { message: `HTTP ${res.status} ${res.statusText}` } };
      }
      const errMsg = errBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`Google Cloud Vision API error (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const annotation = data?.responses?.[0];

    if (annotation?.error) {
      throw new Error(annotation.error.message || 'Google Vision annotation error');
    }

    // Increment and log usage after successful API call
    const currentCount = incrementVisionCallCount();
    console.log(`[VisionAPI] ${currentCount}/${limit} free-tier requests used this month`);

    const webDetection = annotation?.webDetection || {};
    const fullMatchingImages = webDetection.fullMatchingImages || [];
    const partialMatchingImages = webDetection.partialMatchingImages || [];
    const pagesWithMatchingImages = webDetection.pagesWithMatchingImages || [];
    const visuallySimilarImages = webDetection.visuallySimilarImages || [];
    const bestGuessLabels = (webDetection.bestGuessLabels || []).map(b => b.label).filter(Boolean);
    const defaultTitle = bestGuessLabels[0] || 'Discovered Web Image Match';

    const candidates = [];
    const seenUrls = new Set();

    // 1. Ingest Pages with Matching Images (relationship: LIKELY_RELATED)
    for (const page of pagesWithMatchingImages) {
      const pageUrl = page.url;
      if (!pageUrl || seenUrls.has(pageUrl)) continue;
      seenUrls.add(pageUrl);

      let domain = 'web';
      try {
        domain = new URL(pageUrl).hostname.replace(/^www\./, '');
      } catch (_) {}

      const hasFull = page.fullMatchingImages && page.fullMatchingImages.length > 0;
      const hasPartial = page.partialMatchingImages && page.partialMatchingImages.length > 0;
      const relType = hasFull
        ? 'EXACT_OR_NEAR_MATCH'
        : (hasPartial ? 'TRANSFORMED_VERSION' : 'LIKELY_RELATED');
      const canonicalRel = hasFull
        ? (CandidateRelationshipType.EXACT_MATCH || 'EXACT_MATCH')
        : (hasPartial ? (CandidateRelationshipType.TRANSFORMED_VERSION || 'TRANSFORMED_VERSION') : (CandidateRelationshipType.RELATED_MEDIA || 'RELATED_MEDIA'));
      const similarity = hasFull ? 0.99 : (hasPartial ? 0.85 : 0.78);
      const similarityStatus = hasFull || hasPartial ? 'PIXEL_MATCH' : 'PERCEPTUAL_SIMILARITY';
      const thumbUrl = (page.fullMatchingImages?.[0]?.url || page.partialMatchingImages?.[0]?.url || null);

      candidates.push({
        id: `VISION-PAGE-${Date.now()}-${candidates.length}`,
        url: pageUrl,
        title: page.pageTitle || defaultTitle,
        platform: domain,
        source: domain,
        domain,
        author: domain,
        publishedAt: null,
        timestampType: 'UNKNOWN',
        timestampQuality: 'MODERATE',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: thumbUrl,
        similarity,
        matchScore: Math.round(similarity * 100),
        relationship: relType,
        canonicalRelationship: canonicalRel,
        matchType: relType,
        sourceType: 'EXTERNAL_API_VERIFIED',
        similarityStatus,
        snippet: `Discovered on ${domain} containing ${hasFull ? 'exact full image match' : hasPartial ? 'partial/cropped image match' : 'correlated web media'}.`
      });
    }

    // 2. Ingest Direct Full Matching Images (relationship: EXACT_OR_NEAR_MATCH)
    for (const img of fullMatchingImages) {
      if (!img.url || seenUrls.has(img.url)) continue;
      seenUrls.add(img.url);

      let domain = 'web';
      try {
        domain = new URL(img.url).hostname.replace(/^www\./, '');
      } catch (_) {}

      candidates.push({
        id: `VISION-FULL-${Date.now()}-${candidates.length}`,
        url: img.url,
        title: `${defaultTitle} (Exact Match)`,
        platform: domain,
        source: domain,
        domain,
        author: domain,
        publishedAt: null,
        timestampType: 'UNKNOWN',
        timestampQuality: 'MODERATE',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: img.url,
        similarity: 0.99,
        matchScore: 99,
        relationship: 'EXACT_OR_NEAR_MATCH',
        canonicalRelationship: CandidateRelationshipType.EXACT_MATCH || 'EXACT_MATCH',
        matchType: 'EXACT_OR_NEAR_MATCH',
        sourceType: 'EXTERNAL_API_VERIFIED',
        similarityStatus: 'PIXEL_MATCH',
        snippet: `Direct pixel-identical match indexed across public web host (${domain}).`
      });
    }

    // 3. Ingest Partial Matching Images (relationship: TRANSFORMED_VERSION)
    for (const img of partialMatchingImages) {
      if (!img.url || seenUrls.has(img.url)) continue;
      seenUrls.add(img.url);

      let domain = 'web';
      try {
        domain = new URL(img.url).hostname.replace(/^www\./, '');
      } catch (_) {}

      candidates.push({
        id: `VISION-PARTIAL-${Date.now()}-${candidates.length}`,
        url: img.url,
        title: `${defaultTitle} (Partial / Crop Match)`,
        platform: domain,
        source: domain,
        domain,
        author: domain,
        publishedAt: null,
        timestampType: 'UNKNOWN',
        timestampQuality: 'MODERATE',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: img.url,
        similarity: 0.85,
        matchScore: 85,
        relationship: 'TRANSFORMED_VERSION',
        canonicalRelationship: CandidateRelationshipType.TRANSFORMED_VERSION || 'TRANSFORMED_VERSION',
        matchType: 'TRANSFORMED_VERSION',
        sourceType: 'EXTERNAL_API_VERIFIED',
        similarityStatus: 'PIXEL_MATCH',
        snippet: `Partial crop or altered derivative match discovered on ${domain}.`
      });
    }

    // 4. Ingest Visually Similar Images (relationship: LIKELY_RELATED)
    for (const img of visuallySimilarImages) {
      if (!img.url || seenUrls.has(img.url)) continue;
      seenUrls.add(img.url);

      let domain = 'web';
      try {
        domain = new URL(img.url).hostname.replace(/^www\./, '');
      } catch (_) {}

      candidates.push({
        id: `VISION-SIMILAR-${Date.now()}-${candidates.length}`,
        url: img.url,
        title: `${defaultTitle} (Visually Similar)`,
        platform: domain,
        source: domain,
        domain,
        author: domain,
        publishedAt: null,
        timestampType: 'UNKNOWN',
        timestampQuality: 'LOW',
        retrievedAt: new Date().toISOString(),
        thumbnailUrl: img.url,
        similarity: 0.70,
        matchScore: 70,
        relationship: 'LIKELY_RELATED',
        canonicalRelationship: CandidateRelationshipType.RELATED_MEDIA || 'RELATED_MEDIA',
        matchType: 'LIKELY_RELATED',
        sourceType: 'EXTERNAL_API_VERIFIED',
        similarityStatus: 'PERCEPTUAL_SIMILARITY',
        snippet: `Visually similar contextual candidate discovered on ${domain}.`
      });
    }

    return {
      providerId: this.id,
      status: 'AVAILABLE',
      count: candidates.length,
      bestGuessLabels,
      webEntities: webDetection.webEntities || [],
      candidates
    };
  }
}
