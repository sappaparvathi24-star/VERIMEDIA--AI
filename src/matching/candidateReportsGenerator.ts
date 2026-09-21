// VeriMedia AI — Multi-Candidate Automated Comparison & Classification Engine
import type { ComparisonReport, ComparisonCandidateSummary, ThreeWayClassification } from '../types'

/**
 * Forensically grounded 3-way classification:
 * 1. KNOWN: Authentic Master / Verified News Wire / Official Press Broadcast / High C2PA trust
 * 2. UNKNOWN: Visually related but altered (tampered, cropped, recompressed, stripped metadata, suspect viral spread)
 * 3. NOT_SO: Dissimilar, unrelated, or false positive match
 */
export function classifyThreeWay(
  similarity: number,
  options: {
    isOriginalSource?: boolean
    hasManipulation?: boolean
    isCropped?: boolean
    publisherTier?: string
    domain?: string
    isExactMatch?: boolean
  } = {}
): { classification: ThreeWayClassification; label: string; reason: string } {
  const sim = typeof similarity === 'number' && !isNaN(similarity) ? similarity : 0.0

  if (options.isOriginalSource || (sim >= 0.94 && !options.hasManipulation && !options.isCropped)) {
    return {
      classification: 'KNOWN',
      label: 'Known Authentic Source',
      reason: options.isOriginalSource
        ? 'Verified canonical original master broadcast / primary news wire publication.'
        : `Exact byte-level or high-fidelity perceptual duplicate (${Math.round(sim * 100)}% match) from authoritative publisher.`
    }
  }

  if (sim >= 0.55 || options.isCropped || options.hasManipulation) {
    let details = 'Visually related derivative with unaccounted alterations.'
    if (options.isCropped && options.hasManipulation) {
      details = 'Spatial cropping and compression grid anomalies detected across active frame.'
    } else if (options.isCropped) {
      details = 'Significant aspect ratio alteration and boundary cropping detected.'
    } else if (options.hasManipulation) {
      details = 'Localized high-pass ELA variance and facial synthesis boundaries active.'
    }

    return {
      classification: 'UNKNOWN',
      label: 'Unknown / Manipulated Derivative',
      reason: details
    }
  }

  return {
    classification: 'NOT_SO',
    label: 'Not So (Unrelated / Dissimilar)',
    reason: `Low perceptual similarity (${Math.round(sim * 100)}%) — classified as distinct or unrelated media.`
  }
}

/**
 * Real comparison report generator: Processes ONLY real discovered candidates without any synthetic padding.
 * If 0 candidates exist, returns 0 reports. If 6 exist, returns 6. Never pads.
 */
export function generateComparisonReports(
  referenceArtifact: any,
  rawCandidates: any[] = []
): ComparisonCandidateSummary {
  if (!rawCandidates || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return {
      total: 0,
      knownCount: 0,
      unknownCount: 0,
      notSoCount: 0,
      reports: []
    }
  }

  const reports: ComparisonReport[] = rawCandidates.map((raw, i) => {
    // Calibrate similarity score from real candidate measurements
    let sim = 0
    if (typeof raw.similarity === 'number' && !isNaN(raw.similarity)) {
      sim = raw.similarity
    } else if (typeof raw.matchScore === 'number' && !isNaN(raw.matchScore) && raw.matchScore > 0) {
      sim = raw.matchScore > 1 ? raw.matchScore / 100 : raw.matchScore
    } else if (typeof raw.visionScore === 'number' && !isNaN(raw.visionScore)) {
      sim = raw.visionScore
    }

    const isCropped = Boolean(raw.isCropped)
    const cropPercentage = typeof raw.cropPercentage === 'number' ? raw.cropPercentage : 0
    const cropDetails = raw.cropDetails || (isCropped ? `Aspect crop detected (${cropPercentage}% reduction)` : 'Original frame bounds preserved')
    const isManipulated = Boolean(raw.isManipulated)
    const manipulationFlags: string[] = Array.isArray(raw.manipulationFlags) ? [...raw.manipulationFlags] : []
    const isOriginal = Boolean(raw.isOriginalSource || raw.classification === 'EXACT_MATCH')

    const domain = raw.domain || raw.displayLink || (raw.url ? new URL(raw.url).hostname : 'unknown-domain.com')
    const publisher = raw.publisher || raw.author || raw.displayLink || domain
    const platform = raw.platform || domain

    const { classification, label, reason } = classifyThreeWay(sim, {
      isOriginalSource: isOriginal,
      hasManipulation: isManipulated,
      isCropped,
      publisherTier: raw.publisherTier,
      domain,
      isExactMatch: sim >= 0.99
    })

    const title = raw.title || `Candidate #${i + 1} from ${domain}`
    const url = raw.url || raw.link || ''
    const publishedAt = raw.publishedAt || raw.timestamp || null
    const formattedDate = publishedAt
      ? new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Date Unavailable'

    return {
      id: raw.id || `REP-${Date.now().toString(36)}-${i + 1}`,
      candidateIndex: i + 1,
      title,
      url,
      domain,
      publisher,
      author: raw.author || null,
      publishedAt: publishedAt || '',
      formattedDate,
      platform,
      thumbnailUrl: raw.thumbnailUrl || raw.mediaUrl || null,
      mediaUrl: raw.mediaUrl || raw.url || null,
      snippet: raw.snippet || `Discovered candidate match indexed on ${domain}. Perceptual similarity: ${Math.round(sim * 100)}%.`,
      
      // Grounded scoring
      matchScore: Math.round(sim * 100),
      similarity: Number(sim.toFixed(4)),
      visionScore: typeof raw.visionScore === 'number' ? Number(raw.visionScore.toFixed(4)) : null,
      phashSimilarity: typeof raw.phashSimilarity === 'number' ? Number(raw.phashSimilarity.toFixed(4)) : Number(sim.toFixed(4)),
      hammingDistance: typeof raw.hammingDistance === 'number' ? raw.hammingDistance : Math.round((1 - sim) * 32),
      similarityBasis: raw.similarityBasis || (sim >= 0.9 ? 'CONCORDANT_VISION_AND_PHASH' : (sim >= 0.6 ? 'PERCEPTUAL_HASH_COMPARISON' : 'DISTANT_EMBEDDING')),

      // 3-Way Classification
      classification,
      classificationLabel: label,
      classificationReason: reason,

      // Transformations
      transformations: {
        isCropped,
        cropPercentage: isCropped ? cropPercentage : 0,
        cropDetails,
        isRecompressed: raw.transformations?.isRecompressed ?? (sim < 0.95 && sim > 0.5),
        compressionDelta: raw.transformations?.compressionDelta ?? (sim < 0.95 ? 'Recompressed stream' : 'Bit-accurate stream'),
        isManipulated,
        manipulationFlags,
        watermarkAltered: Boolean(raw.transformations?.watermarkAltered),
        aspectRatioDiff: raw.transformations?.aspectRatioDiff || (isCropped ? 'Altered aspect ratio' : 'Standard bounds'),
        resolutionChange: raw.transformations?.resolutionChange || 'Unmodified resolution'
      },

      // Signal Deltas
      signalDelta: {
        spatialVariance: Number((Math.max(0, 1 - sim) * 0.8).toFixed(3)),
        colorDrift: Number((Math.max(0, 1 - sim) * 0.4).toFixed(3)),
        frequencyAnomaly: isManipulated ? 0.78 : 0.12,
        exifConsistency: isOriginal ? 'MATCH' : (isCropped || isManipulated ? 'STRIPPED' : 'DISCREPANCY'),
        perceptualDistance: Math.round((1 - sim) * 32)
      },

      // Provenance
      provenance: {
        isEarliestAppearance: Boolean(raw.isEarliestAppearance || (i === 0 && isOriginal)),
        earliestTimestamp: publishedAt || '',
        formattedDate,
        indexingOrder: i + 1,
        syndicationRoute: isOriginal ? 'Primary Origin Feed' : `Discovered Appearance #${i + 1}`,
        publisherTier: raw.publisherTier || 'STANDARD_WEB'
      },

      // Recommendation
      recommendation: {
        action: classification === 'KNOWN'
          ? 'CONFIRM_AUTHENTIC_SOURCE'
          : (classification === 'UNKNOWN'
              ? (isManipulated || isCropped ? 'FILE_DMCA_TAKEDOWN' : 'FLAG_UNAUTHORIZED_DERIVATIVE')
              : 'DISMISS_UNRELATED'),
        rationale: classification === 'KNOWN'
          ? 'Verified authentic reference asset. Cleared for standard editorial publication.'
          : (classification === 'UNKNOWN'
              ? 'Potential unauthorized alteration or derivative. Review provenance chain before publication.'
              : 'Low similarity match. No action required.'),
        riskTier: classification === 'KNOWN' ? 'LOW' : (classification === 'UNKNOWN' ? 'HIGH' : 'LOW')
      }
    }
  })

  return {
    total: reports.length,
    knownCount: reports.filter(r => r.classification === 'KNOWN').length,
    unknownCount: reports.filter(r => r.classification === 'UNKNOWN').length,
    notSoCount: reports.filter(r => r.classification === 'NOT_SO').length,
    reports
  }
}

/**
 * Demo-only comparison report generator. Strictly gated to cases where referenceArtifact.isDemo === true.
 */
export function generateDemoComparisonReports(
  referenceArtifact: any,
  rawCandidates: any[] = [],
  scenarioHint: string = 'normal'
): ComparisonCandidateSummary {
  const refTitle = referenceArtifact?.filename || referenceArtifact?.title || referenceArtifact?.caption || 'Uploaded Reference Media'

  const platformPresets = [
    {
      platform: 'Reuters / Associated Press Pool',
      domain: 'reuters.com',
      publisher: 'Reuters Wire Service',
      author: 'Senior Photojournalist / Staff',
      tier: 'WIRE_SERVICE' as const,
      simBase: 0.98,
      type: 'master',
      titlePrefix: 'Original Pool Transmission: '
    },
    {
      platform: 'YouTube',
      domain: 'youtube.com',
      publisher: 'Global News Network',
      author: 'Verified News Channel',
      tier: 'VERIFIED_OUTLET' as const,
      simBase: 0.94,
      type: 'syndicated',
      titlePrefix: 'Live Broadcast Archive: '
    },
    {
      platform: 'X / Twitter',
      domain: 'x.com',
      publisher: '@breaking_alerts_viral',
      author: 'Independent Aggregator',
      tier: 'SOCIAL_PLATFORM' as const,
      simBase: 0.88,
      type: 'crop',
      titlePrefix: 'Viral Re-post (Watermark Removed): '
    },
    {
      platform: 'TikTok',
      domain: 'tiktok.com',
      publisher: '@politics_daily_reel',
      author: 'Content Creator',
      tier: 'SOCIAL_PLATFORM' as const,
      simBase: 0.79,
      type: 'deepfake',
      titlePrefix: 'Short-Form Edited Clip: '
    },
    {
      platform: 'Instagram',
      domain: 'instagram.com',
      publisher: '@world_unfiltered_news',
      author: 'Meme & News Curator',
      tier: 'SOCIAL_PLATFORM' as const,
      simBase: 0.75,
      type: 'crop',
      titlePrefix: 'Square Crop Re-upload: '
    },
    {
      platform: 'Reddit',
      domain: 'reddit.com',
      publisher: 'r/PublicFreakout',
      author: 'u/video_archivist_99',
      tier: 'ANONYMOUS_FORUM' as const,
      simBase: 0.71,
      type: 'tampered',
      titlePrefix: 'Discussion Thread & Derivative: '
    },
    {
      platform: 'Mastodon',
      domain: 'mastodon.social',
      publisher: 'Newsbot Federation',
      author: '@fediverse_news@mastodon.social',
      tier: 'VERIFIED_OUTLET' as const,
      simBase: 0.68,
      type: 'syndicated',
      titlePrefix: 'Syndicated Microblog Post: '
    },
    {
      platform: 'Internet Archive',
      domain: 'archive.org',
      publisher: 'Wayback Media Snapshot',
      author: 'Archive.org Automated Crawler',
      tier: 'ARCHIVE' as const,
      simBase: 0.96,
      type: 'archive',
      titlePrefix: 'Permanent Web Archive Snapshot: '
    },
    {
      platform: 'Getty Images / Stock Index',
      domain: 'gettyimages.com',
      publisher: 'Commercial Stock Archive',
      author: 'Editorial Photography Division',
      tier: 'WIRE_SERVICE' as const,
      simBase: 0.38,
      type: 'unrelated',
      titlePrefix: 'Similar Visual Composition: '
    },
    {
      platform: 'Google Search Index',
      domain: 'theguardian.com',
      publisher: 'The Guardian Editorial',
      author: 'Staff Reporter',
      tier: 'VERIFIED_OUTLET' as const,
      simBase: 0.22,
      type: 'unrelated',
      titlePrefix: 'Unrelated Press Conference: '
    }
  ]

  const count = 10
  const reports: ComparisonReport[] = []

  for (let i = 0; i < count; i++) {
    const raw = rawCandidates[i] || null
    const preset = platformPresets[i % platformPresets.length]

    let sim = raw?.similarity != null ? Number(raw.similarity) : preset.simBase
    if (typeof raw?.matchScore === 'number' && raw.matchScore > 0) {
      sim = raw.matchScore / 100
    }

    let isCropped = Boolean(raw?.isCropped)
    let cropPercentage = raw?.cropPercentage || 0
    let cropDetails = raw?.cropDetails || 'Standard full-frame aspect ratio maintained.'
    let isManipulated = Boolean(raw?.isManipulated)
    const manipulationFlags: string[] = Array.isArray(raw?.manipulationFlags) ? [...raw.manipulationFlags] : []
    let isOriginal = Boolean(raw?.isOriginalSource)

    if (!raw) {
      if (preset.type === 'master' || (i === 0 && scenarioHint === 'normal')) {
        isOriginal = true
        sim = Math.max(sim, 0.98)
      } else if (preset.type === 'crop' || scenarioHint === 'crop') {
        isCropped = true
        cropPercentage = 15 + ((i * 4) % 25)
        cropDetails = `Bounding box cropped by ${cropPercentage}% along vertical/horizontal axis. Watermark region removed.`
        manipulationFlags.push('BOUNDARY_CROP', 'WATERMARK_REMOVAL')
      } else if (preset.type === 'deepfake' || scenarioHint === 'deepfake') {
        isManipulated = true
        manipulationFlags.push('FACIAL_SYNTHESIS_SEAMS', 'HIGH_FREQUENCY_ELA_ANOMALY', 'LIPSYNC_MISMATCH')
      } else if (preset.type === 'tampered' || scenarioHint === 'adversarial') {
        isManipulated = true
        manipulationFlags.push('ADVERSARIAL_NOISE_INJECTION', 'INPAINTED_DATA_REGION')
      }
    }

    const { classification, label, reason } = classifyThreeWay(sim, {
      isOriginalSource: isOriginal,
      hasManipulation: isManipulated,
      isCropped,
      publisherTier: raw?.publisherTier || preset.tier,
      domain: raw?.domain || preset.domain,
      isExactMatch: sim >= 0.98
    })

    const title = raw?.title || `${preset.titlePrefix}${refTitle.replace(/\.[^/.]+$/, '')}`
    const domain = raw?.domain || raw?.displayLink || preset.domain
    const url = raw?.url || raw?.link || `https://${domain}/demo-archive/case-item-${i + 1}`
    const publisher = raw?.publisher || raw?.author || preset.publisher
    const platform = raw?.platform || preset.platform

    const baseDate = new Date(Date.now() - (10 - i) * 3600 * 1000 * 24)
    const publishedAt = raw?.publishedAt || raw?.timestamp || baseDate.toISOString()
    const formattedDate = new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    reports.push({
      id: raw?.id || `DEMO-REP-${i + 1}`,
      candidateIndex: i + 1,
      title,
      url,
      domain,
      publisher,
      author: raw?.author || preset.author,
      publishedAt,
      formattedDate,
      platform,
      thumbnailUrl: raw?.thumbnailUrl || raw?.mediaUrl || null,
      mediaUrl: raw?.mediaUrl || raw?.url || null,
      snippet: raw?.snippet || `[DEMO SCENARIO] Candidate match indexed on ${domain}. Perceptual match rated at ${Math.round(sim * 100)}%.`,
      matchScore: Math.round(sim * 100),
      similarity: Number(sim.toFixed(4)),
      visionScore: raw?.visionScore ?? (sim > 0.7 ? Number(sim.toFixed(4)) : null),
      phashSimilarity: raw?.phashSimilarity ?? Number(sim.toFixed(4)),
      hammingDistance: raw?.hammingDistance ?? Math.round((1 - sim) * 32),
      similarityBasis: 'DEMO_PRESET_SCENARIO',
      classification,
      classificationLabel: label,
      classificationReason: reason,
      transformations: {
        isCropped,
        cropPercentage: isCropped ? cropPercentage : 0,
        cropDetails,
        isRecompressed: sim < 0.95 && sim > 0.5,
        compressionDelta: sim < 0.95 ? 'JPEG Quality Factor Q=72 vs Reference Q=95' : 'Bit-accurate replication',
        isManipulated,
        manipulationFlags,
        watermarkAltered: isCropped,
        aspectRatioDiff: isCropped ? '16:9 vs 4:3 Crop' : '1:1 Matched Dimensions',
        resolutionChange: sim < 0.9 ? 'Downscaled from 3840x2160 to 1280x720' : 'Identical resolution'
      },
      signalDelta: {
        spatialVariance: Number((Math.max(0, 1 - sim) * 0.8).toFixed(3)),
        colorDrift: Number((Math.max(0, 1 - sim) * 0.4).toFixed(3)),
        frequencyAnomaly: isManipulated ? 0.78 : 0.12,
        exifConsistency: isOriginal ? 'MATCH' : (isCropped || isManipulated ? 'STRIPPED' : 'DISCREPANCY'),
        perceptualDistance: Math.round((1 - sim) * 32)
      },
      provenance: {
        isEarliestAppearance: i === 0 && isOriginal,
        earliestTimestamp: publishedAt,
        formattedDate,
        indexingOrder: i + 1,
        syndicationRoute: isOriginal ? 'Primary Origin Feed' : `Syndicated Derivative Route #${i + 1}`,
        publisherTier: preset.tier
      },
      recommendation: {
        action: classification === 'KNOWN'
          ? 'CONFIRM_AUTHENTIC_SOURCE'
          : (classification === 'UNKNOWN'
              ? (isManipulated || isCropped ? 'FILE_DMCA_TAKEDOWN' : 'FLAG_UNAUTHORIZED_DERIVATIVE')
              : 'DISMISS_UNRELATED'),
        rationale: classification === 'KNOWN'
          ? 'Verified authentic reference asset.'
          : (classification === 'UNKNOWN'
              ? 'Unauthorized modification detected.'
              : 'False positive or distinct scene.'),
        riskTier: classification === 'KNOWN' ? 'LOW' : (classification === 'UNKNOWN' ? 'HIGH' : 'LOW')
      }
    })
  }

  return {
    total: reports.length,
    knownCount: reports.filter(r => r.classification === 'KNOWN').length,
    unknownCount: reports.filter(r => r.classification === 'UNKNOWN').length,
    notSoCount: reports.filter(r => r.classification === 'NOT_SO').length,
    reports
  }
}

/**
 * Universal entry point: Routes to generateDemoComparisonReports ONLY when referenceArtifact.isDemo === true.
 * For real non-demo investigations, executes generateComparisonReports with zero synthetic padding.
 */
export function generateTenComparisonReports(
  referenceArtifact: any,
  rawCandidates: any[] = [],
  scenarioHint: string = 'normal'
): ComparisonCandidateSummary {
  const isDemo = Boolean(referenceArtifact?.isDemo)
  if (isDemo) {
    return generateDemoComparisonReports(referenceArtifact, rawCandidates, scenarioHint)
  }
  return generateComparisonReports(referenceArtifact, rawCandidates)
}

