// VeriMedia AI — Pre-configured High-Fidelity Forensic Demo Pieces
import type { DetectionResult } from '../types'
import { generateTenComparisonReports } from '../matching/candidateReportsGenerator'

export interface DemoPiece {
  id: string
  title: string
  subtitle: string
  category: 'DEEPFAKE' | 'CROP_TAMPER' | 'AUTHENTIC' | 'INPAINTING' | 'LIPSYNC'
  icon: string
  badgeColor: string
  filename: string
  mediaUrl: string
  description: string
  trustScore: number
  riskLevel: 'CRITICAL' | 'HIGH' | 'LOW'
  scenario: 'deepfake' | 'crop' | 'normal' | 'adversarial'
  details: {
    tamperingType: string
    keyDiscrepancy: string
    groundTruth: string
  }
}

export const DEMO_PIECES: DemoPiece[] = [
  {
    id: 'demo-deepfake-speech',
    title: 'Viral Political Press Briefing',
    subtitle: 'Neural Facial Synthesis & Audio Splice',
    category: 'DEEPFAKE',
    icon: '🤖',
    badgeColor: '#ef4444',
    filename: 'deepfake_speech_briefing.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    description: 'High-visibility press conference video frame altered using latent diffusion to fabricate false statements.',
    trustScore: 28,
    riskLevel: 'CRITICAL',
    scenario: 'deepfake',
    details: {
      tamperingType: 'Deepfake Generative Inpainting',
      keyDiscrepancy: 'Severe high-frequency ELA variance across jawline and lip-sync temporal boundary.',
      groundTruth: 'Fabricated derivative of original C-SPAN 4K pool feed.'
    }
  },
  {
    id: 'demo-breaking-news-crop',
    title: 'Breaking News Disaster Photo',
    subtitle: '25% Crop & Watermark Stripped',
    category: 'CROP_TAMPER',
    icon: '✂️',
    badgeColor: '#f59e0b',
    filename: 'disaster_photo_cropped.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=1200&q=80',
    description: 'Exclusive photojournalism asset with photographer agency credit cropped and redistributed across social media.',
    trustScore: 52,
    riskLevel: 'HIGH',
    scenario: 'crop',
    details: {
      tamperingType: 'Copyright Infringement & Framing Tampering',
      keyDiscrepancy: 'Aspect ratio reduced from 16:9 to 4:3 with lower right watermark region erased.',
      groundTruth: 'Originally copyrighted by AP Photojournalism Wire.'
    }
  },
  {
    id: 'demo-authentic-master',
    title: 'Official 4K Broadcast Master',
    subtitle: 'Verified Cryptographic C2PA Provenance',
    category: 'AUTHENTIC',
    icon: '🎥',
    badgeColor: '#10b981',
    filename: 'authentic_4k_master_transmission.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
    description: 'Untampered original live feed with hardware sensor PRNU coherence and intact camera EXIF.',
    trustScore: 96,
    riskLevel: 'LOW',
    scenario: 'normal',
    details: {
      tamperingType: 'None (Authentic Master)',
      keyDiscrepancy: 'Uniform DCT quantization matrices and clean camera hardware signature.',
      groundTruth: 'Certified authentic camera capture.'
    }
  },
  {
    id: 'demo-financial-tampered',
    title: 'Financial Quarterly Earnings Graphic',
    subtitle: 'Adversarial Number Inpainting',
    category: 'INPAINTING',
    icon: '⚡',
    badgeColor: '#ec4899',
    filename: 'earnings_report_inpainted.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    description: 'Corporate balance sheet graphic with revenue numbers digitally replaced to mislead stock market investors.',
    trustScore: 34,
    riskLevel: 'CRITICAL',
    scenario: 'adversarial',
    details: {
      tamperingType: 'Data Table Forgery',
      keyDiscrepancy: 'Double JPEG compression ring artifacts around modified revenue figures.',
      groundTruth: 'SEC Edgar filing original shows 3.2B vs altered 8.9B.'
    }
  },
  {
    id: 'demo-interview-lipsync',
    title: 'Celebrity Podcast Video Clip',
    subtitle: 'Wav2Lip Generative Speech Resynthesis',
    category: 'LIPSYNC',
    icon: '🎭',
    badgeColor: '#8b5cf6',
    filename: 'celebrity_podcast_lipsync.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80',
    description: 'Podcast interview segment where mouth movements were re-animated to match an AI-generated voice clone.',
    trustScore: 41,
    riskLevel: 'HIGH',
    scenario: 'deepfake',
    details: {
      tamperingType: 'Audio-Visual Desync & Lip Re-animation',
      keyDiscrepancy: 'Spatial blur around lower facial boundary and 180ms audio-phoneme offset.',
      groundTruth: 'Original unedited 60-minute studio podcast.'
    }
  }
]

/**
 * Constructs a rich DetectionResult with all 10 comparison reports pre-computed for demo pieces.
 */
export function buildDemoDetectionResult(demo: DemoPiece): DetectionResult {
  const isManipulated = demo.trustScore < 60
  const summary = generateTenComparisonReports(
    {
      id: `art-${demo.id}`,
      filename: demo.filename,
      title: demo.title,
      isDemo: true,
      mediaUrl: demo.mediaUrl
    },
    [],
    demo.scenario
  )

  const result: DetectionResult = {
    job_id: `DET-DEMO-${demo.id.toUpperCase()}`,
    platform: 'YouTube',
    username: 'verified_analyst',
    caption: `${demo.title} — ${demo.subtitle}`,
    content_type: 'news',
    scenario: demo.scenario,
    similarity: isManipulated ? 0.88 : 0.98,
    fingerprint_hash: 'a3f8c9b2e1d047a5',
    timestamp: new Date().toISOString(),
    case_id: `VM-CASE-${Date.now().toString().slice(-5)}`,
    processing_ms: 420,
    is_demo: true,
    mode: 'DEMO_BENCHMARK',
    subject_description: demo.description,
    visual_findings: [
      `Source format: High-definition 1080p master frame (${demo.filename})`,
      demo.details.keyDiscrepancy,
      demo.details.groundTruth,
      `10 multi-source candidates discovered and compared across index.`
    ],
    detected_anomalies: isManipulated
      ? [demo.details.tamperingType, 'Compression grid discontinuity', 'Perceptual hash variation']
      : ['None — Coherent physical capture profile'],
    ml: {
      label: isManipulated ? 'TAMPERED' : 'SAFE',
      manipulation_probability: isManipulated ? (100 - demo.trustScore) / 100 : 0.04,
      trust_score: demo.trustScore,
      confidence: 0.94,
      signals: {
        match_score: isManipulated ? 0.88 : 0.98,
        spatial_diff: isManipulated ? 0.76 : 0.08,
        noise_score: isManipulated ? 0.82 : 0.14,
        face_landmark: demo.category === 'DEEPFAKE' || demo.category === 'LIPSYNC' ? 0.89 : null,
        jpeg_artifact: isManipulated ? 0.74 : 0.15,
        edge_consistency: isManipulated ? 0.35 : 0.92
      }
    },
    integrity: {
      score: demo.trustScore / 100,
      flags: isManipulated ? [demo.details.tamperingType] : [],
      signals: {
        jpeg_artifact: isManipulated ? 0.74 : 0.15,
        edge_consistency: isManipulated ? 0.35 : 0.92,
        metadata_coherence: isManipulated ? 0.2 : 0.95,
        face_landmark: demo.category === 'DEEPFAKE' ? 0.89 : null
      }
    },
    trust: {
      trust_score: demo.trustScore,
      risk_tier: demo.trustScore < 40 ? 'high_risk' : (demo.trustScore < 70 ? 'suspect' : 'safe'),
      verdict: isManipulated ? `Manipulated Media Detected (${demo.details.tamperingType})` : 'Authentic Media Master Verified',
      factors: {
        perceptual_match: isManipulated ? 0.88 : 0.98,
        forensic_integrity: demo.trustScore / 100
      }
    },
    ai_analysis: {
      threat_type: isManipulated ? demo.details.tamperingType : 'Authentic Content',
      decision: isManipulated ? (demo.trustScore < 35 ? 'EMERGENCY_TAKEDOWN' : 'TAKEDOWN') : 'ALLOW',
      severity: demo.riskLevel,
      risk_label: demo.trustScore < 40 ? 'HIGH_RISK' : (demo.trustScore < 70 ? 'SUSPECT' : 'SAFE'),
      confidence: 0.94,
      reasoning_points: [
        `Analysis mode: ${demo.title}`,
        demo.details.keyDiscrepancy,
        demo.details.groundTruth,
        `Classified 10 candidates: ${summary.knownCount} Known, ${summary.unknownCount} Unknown/Manipulated, ${summary.notSoCount} Not So (Unrelated).`
      ],
      action: isManipulated ? 'Issue formal DMCA takedown & preserve evidence manifest' : 'Archive verified master to immutable provenance store',
      recommended_action: isManipulated ? 'Enforce automated copyright & authenticity takedown' : 'Certify authentic origin in C2PA ledger',
      origin_traced: true,
      dmca_needed: isManipulated,
      source: 'claude'
    },
    artifact: {
      id: `art-${demo.id}`,
      filename: demo.filename,
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      perceptualHash: 'a3f8c9b2e1d047a5',
      dimensions: { width: 1920, height: 1080 },
      byteSize: 2450000,
      mimeType: 'image/jpeg',
      fileUrl: demo.mediaUrl,
      previewUrl: demo.mediaUrl,
      dataUrl: demo.mediaUrl
    },
    forensics: {
      engine: 'VeriMedia-Multi-Signal-v2',
      status: 'COMPLETED',
      authenticity: isManipulated ? 'MANIPULATED' : 'AUTHENTIC',
      trustScore: demo.trustScore,
      confidence: 0.94,
      verdict: isManipulated ? demo.details.tamperingType : 'Authentic Master Record',
      summary: `${demo.title}: ${demo.details.keyDiscrepancy}`,
      subjectDescription: demo.description,
      visualFindings: [
        demo.details.keyDiscrepancy,
        demo.details.groundTruth,
        `Candidate comparisons synthesized across 10 indexed media platforms.`
      ],
      detectedAnomalies: isManipulated ? [demo.details.tamperingType] : [],
      ela: {
        meanError: isManipulated ? 34.2 : 4.8,
        maxError: isManipulated ? 88.5 : 12.0,
        variance: isManipulated ? 42.1 : 3.2,
        hasCompressionAnomaly: isManipulated
      },
      stats: {
        width: 1920,
        height: 1080,
        channels: 3,
        entropy: 7.6,
        luminance: 142
      }
    }
  }

  // Attach comparison summary
  ;(result as any).comparisonSummary = summary
  ;(result as any).candidates = summary.reports
  ;(result as any).comparisonReports = summary.reports

  return result
}
