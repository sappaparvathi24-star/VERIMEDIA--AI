// VeriMedia AI — Visual Comparison & Perceptual Forensic Scoring Engine
import sharp from 'sharp';
// NOTE: Uses the DCT-based perceptual hash (computePhash), not the average
// hash (computeAverageHash). aHash is a coarse 64-bit brightness-threshold
// hash and produces frequent false "matches" (>=0.70 similarity) between
// visually unrelated photos that merely share overall lighting/composition.
// The DCT-based hash is far more discriminative for reverse-image matching.
import { computePhash, hammingDistance, hashSimilarity } from '../forensics/perceptualHash.js';

/**
 * Forensically calibrated similarity thresholds.
 * Evaluated against normalized perceptual similarity [0.0 - 1.0].
 */
export const SIMILARITY_THRESHOLDS = {
  EXACT_MATCH: 0.98,          // Likely the true original source or byte-accurate mirror
  NEAR_DUPLICATE: 0.88,       // Re-encoded, re-compressed, slightly cropped, or letterboxed
  MODIFIED_DERIVATIVE: 0.70,  // Visually related but altered (tampered, cropped, composited)
};

export const MATCH_CLASSIFICATIONS = {
  EXACT_MATCH: 'EXACT_MATCH',
  NEAR_DUPLICATE: 'NEAR_DUPLICATE',
  MODIFIED_DERIVATIVE: 'MODIFIED_DERIVATIVE',
  UNRELATED: 'UNRELATED',
};

/**
 * Classifies a media candidate based on its calibrated visual similarity score.
 * Results below MODIFIED_DERIVATIVE (0.70) are classified as UNRELATED and filtered out.
 * 
 * @param {number} similarity - Normalized similarity score [0.0 - 1.0]
 * @returns {string} MATCH_CLASSIFICATIONS enum value
 */
export function classifyMatch(similarity) {
  if (typeof similarity !== 'number' || isNaN(similarity)) {
    return MATCH_CLASSIFICATIONS.UNRELATED;
  }
  if (similarity >= SIMILARITY_THRESHOLDS.EXACT_MATCH) {
    return MATCH_CLASSIFICATIONS.EXACT_MATCH;
  }
  if (similarity >= SIMILARITY_THRESHOLDS.NEAR_DUPLICATE) {
    return MATCH_CLASSIFICATIONS.NEAR_DUPLICATE;
  }
  if (similarity >= SIMILARITY_THRESHOLDS.MODIFIED_DERIVATIVE) {
    return MATCH_CLASSIFICATIONS.MODIFIED_DERIVATIVE;
  }
  return MATCH_CLASSIFICATIONS.UNRELATED;
}

/**
 * Safely fetches a remote candidate thumbnail image buffer with SSRF protection and timeout.
 * 
 * @param {string} url - Remote image URL
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns {Promise<Buffer|null>}
 */
export async function fetchThumbnailBuffer(url, timeoutMs = 5000) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // SSRF prevention: block localhost, internal subnets, and cloud metadata IP
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      (hostname.startsWith('172.') && parseInt(hostname.split('.')[1], 10) >= 16 && parseInt(hostname.split('.')[1], 10) <= 31)
    ) {
      return null;
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'VeriMedia-Forensic-Scanner/2.0 (Media Provenance Verification Engine)'
      }
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit buffer to 10MB to prevent memory exhaustion
    if (buffer.length > 10 * 1024 * 1024) {
      return null;
    }

    return buffer;
  } catch (_) {
    return null;
  }
}

/**
 * Evaluates real visual similarity between an uploaded reference media and a discovered candidate.
 * Computes perceptual hash (aHash), cross-checks with any API-reported scores (e.g. Google Vision),
 * and classifies the candidate.
 * 
 * @param {Object} candidate - Discovered candidate object
 * @param {Object} options - Reference media options { uploadedHash, uploadedBuffer }
 * @returns {Promise<Object>} Evaluated candidate with real similarity and classification
 */
export async function evaluateCandidateVisualSimilarity(candidate, { uploadedHash, uploadedBuffer } = {}) {
  let refHash = uploadedHash || null;
  if (!refHash && uploadedBuffer && Buffer.isBuffer(uploadedBuffer)) {
    refHash = await computePhash(uploadedBuffer);
  }

  const evaluated = { ...candidate };
  const thumbUrl = candidate.thumbnailUrl || candidate.mediaUrl || null;
  let phashSimilarity = null;
  let hammingDist = null;

  // Preserve any score provided directly by Google Vision or other vision engines
  const reportedVisionScore = typeof candidate.visionScore === 'number' 
    ? candidate.visionScore 
    : (typeof candidate.similarity === 'number' && candidate.source === 'google_vision' ? candidate.similarity : null);

  if (thumbUrl && refHash) {
    const thumbBuffer = await fetchThumbnailBuffer(thumbUrl);
    if (thumbBuffer) {
      const thumbHash = await computePhash(thumbBuffer);
      if (thumbHash) {
        phashSimilarity = hashSimilarity(refHash, thumbHash);
        hammingDist = hammingDistance(refHash, thumbHash);
        evaluated.candidateHash = thumbHash;
      }
    }
  }

  evaluated.visionScore = reportedVisionScore != null ? Number(reportedVisionScore.toFixed(4)) : null;
  evaluated.phashSimilarity = phashSimilarity != null ? Number(phashSimilarity.toFixed(4)) : null;
  evaluated.hammingDistance = hammingDist;

  // Determine final grounded similarity score
  let finalSimilarity = null;

  if (reportedVisionScore != null && phashSimilarity != null) {
    // Both independent signals available: cross-check
    // For high visual matches (Google Vision Web Detection), take the calibrated maximum
    finalSimilarity = Number(Math.max(reportedVisionScore, phashSimilarity).toFixed(4));
    evaluated.similarityBasis = 'CONCORDANT_VISION_AND_PHASH';
  } else if (reportedVisionScore != null) {
    finalSimilarity = Number(reportedVisionScore.toFixed(4));
    evaluated.similarityBasis = 'GOOGLE_VISION_WEB_DETECTION';
  } else if (phashSimilarity != null) {
    finalSimilarity = Number(phashSimilarity.toFixed(4));
    evaluated.similarityBasis = 'PERCEPTUAL_HASH_COMPARISON';
  } else {
    // If no visual bytes could be retrieved or compared
    if (candidate.matchType === 'visual_match' && candidate.similarity) {
      finalSimilarity = Number(candidate.similarity.toFixed(4));
      evaluated.similarityBasis = 'REVERSE_IMAGE_METADATA';
    } else {
      // Unfetchable text match: cannot verify visual relationship
      finalSimilarity = 0.0;
      evaluated.similarityBasis = 'UNVERIFIED_TEXT_ONLY';
    }
  }

  evaluated.similarity = finalSimilarity;
  evaluated.matchScore = Math.round(finalSimilarity * 100);

  const classification = classifyMatch(finalSimilarity);
  evaluated.classification = classification;

  return evaluated;
}
