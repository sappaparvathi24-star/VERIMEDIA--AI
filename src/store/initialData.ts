import type { DetectionResult, CaseRecord, ForensicStageItem } from '../types'

export const DEFAULT_FORENSIC_STAGES: ForensicStageItem[] = [
  {
    id: 1,
    key: 'ingest',
    label: 'Stage 1: Ingest & Fingerprinting',
    shortTitle: 'Fingerprint (E1)',
    icon: '🔐',
    description: 'Cryptographic SHA-256 bitstream verification & 64-bit perceptual hashing',
    color: '#00d4ff',
    status: 'PENDING',
  },
  {
    id: 2,
    key: 'ela',
    label: 'Stage 2: Error Level Analysis',
    shortTitle: 'ELA Physics (E2)',
    icon: '🔬',
    description: 'Multi-pass DCT quantization grid analysis & compression delta inspection',
    color: '#38bdf8',
    status: 'PENDING',
  },
  {
    id: 3,
    key: 'exif_c2pa',
    label: 'Stage 3: EXIF & C2PA Credentials',
    shortTitle: 'Hardware / C2PA (E3)',
    icon: '📷',
    description: 'Sensor PRNU noise verification, camera device tags & C2PA manifest audit',
    color: '#a855f7',
    status: 'PENDING',
  },
  {
    id: 4,
    key: 'stats_ocr',
    label: 'Stage 4: Pixel Entropy & OCR',
    shortTitle: 'Entropy & Text (E4)',
    icon: '📊',
    description: 'Luminance variance, RGB channel entropy distribution & OCR optical text extraction',
    color: '#f59e0b',
    status: 'PENDING',
  },
  {
    id: 5,
    key: 'vision_ai',
    label: 'Stage 5: Multimodal AI Vision',
    shortTitle: 'Gemini Vision (E5)',
    icon: '👁️',
    description: 'Neural forensic audit for synthetic synthesis, facial seams & diffusion artifacts',
    color: '#f97316',
    status: 'PENDING',
  },
  {
    id: 6,
    key: 'fusion',
    label: 'Stage 6: Epistemic Fusion & Verdict',
    shortTitle: 'Verdict (E6)',
    icon: '⚖️',
    description: 'Independent signal concordance, calibrated trust score & DMCA enforcement dossier',
    color: '#22c55e',
    status: 'PENDING',
  },
]

export const DEFAULT_SHOWCASE_RESULT: DetectionResult = {
  job_id: 'VM-2026-9841',
  platform: 'YouTube',
  username: 'viral_intel_feed',
  caption: 'BREAKING: Leaked deepfake speech of prominent figure claiming major economic emergency',
  content_type: 'news',
  scenario: 'deepfake',
  similarity: 0.942,
  fingerprint_hash: 'e83a9f1b4c7d2e0a8f9c1e3b5d7a9f2c',
  processing_ms: 320,
  timestamp: new Date().toISOString(),
  case_id: 'CASE-2026-089',
  is_demo: true,
  mode: 'SIMULATED_SCENARIO',
  disclaimer: 'DEMO SHOWCASE — Pre-loaded benchmark scenario. Upload a real media file for live forensic analysis.',
  subject_description: 'High-profile broadcast video exhibiting facial boundary blending and audio-acoustic viseme desynchronization.',
  visual_findings: [
    'Facial boundary gradient discontinuity along the jawline indicative of GAN/Diffusion blending.',
    'Error Level Analysis (ELA) reveals elevated 8x8 block compression variance around mouth and eyes.',
    'Sensor PRNU noise pattern inconsistent with Sony Alpha A7S III capture sensor EXIF claim.',
    'Chroma sub-sampling artifacts indicate secondary re-encoding and watermark removal.'
  ],
  detected_anomalies: [
    'Facial Landmark Mesh Synthesis (anomaly rating 0.89)',
    'Acoustic-Viseme Lipsync Desynchronization (anomaly rating 0.82)',
    'Sensor PRNU Noise Inconsistency (anomaly rating 0.78)',
    'Watermark Stripping Residuals along bottom-right quadrant'
  ],
  ml: {
    label: 'TAMPERED',
    manipulation_probability: 0.91,
    trust_score: 18,
    confidence: 0.94,
    signals: {
      match_score: 0.94,
      spatial_diff: 0.88,
      color_diff: 0.72,
      frame_diff: 0.85,
      temporal_diff: 0.81,
      noise_score: 0.78,
      watermark_detected: 0.12
    }
  },
  integrity: {
    score: 0.18,
    flags: ['DEEPFAKE_SYNTHESIS', 'PRNU_MISMATCH', 'WATERMARK_REMOVED', 'EXIF_SPOOFED'],
    signals: {
      jpeg_artifact: 0.84,
      noise_pattern: 0.79,
      edge_consistency: 0.14,
      metadata_coherence: 0.22,
      color_histogram: 0.68,
      face_landmark: 0.89,
      lipsync: 0.82,
      temporal_mismatch: 0.76,
      watermark_presence: 0.08
    }
  },
  trust: {
    trust_score: 18,
    risk_tier: 'high_risk',
    verdict: 'Synthetic Deepfake Manipulation Detected',
    factors: {
      perceptual_integrity: 0.15,
      source_credibility: 0.22,
      tampering_anomalies: 0.91,
      provenance_continuity: 0.20
    }
  },
  authorship: {
    confidence: 0.96,
    reason: 'Cryptographic fingerprint matched against verified Reuters Broadcast Master (Hop 0).',
    origin_node: 'node_reuters_master_001',
    embedding_distance: 0.058
  },
  propagation: {
    total_scans: 48,
    velocity: 142.5,
    urgency: 'critical',
    indicator: 'EXPONENTIAL_VIRAL_DIFFUSION',
    ppm: 38,
    anomaly_flag: true,
    anomaly_score: 0.92
  },
  ai_analysis: {
    threat_type: 'Deepfake & Copyright Tampering',
    decision: 'EMERGENCY_TAKEDOWN',
    severity: 'CRITICAL',
    risk_label: 'HIGH_RISK',
    confidence: 0.94,
    reasoning_points: [
      'Visual artifact inspection isolated neural face-swap synthesis boundaries with 94% statistical confidence.',
      'Audio frequency spectrogram reveals acoustic viseme desynchronization exceeding 120ms.',
      'Cryptographic provenance matches authenticated Reuters master broadcast with 94.2% perceptual hash match.',
      'Automated DMCA notice eligibility satisfied under 17 U.S.C. § 512 with technical evidence manifest.'
    ],
    action: 'DISPATCH_AUTOMATED_DMCA_TAKEDOWN',
    recommended_action: 'Issue emergency takedown notice to platform and syndicate cryptographic forensic hash to social integrity consortium.',
    origin_traced: true,
    dmca_needed: true,
    source: 'claude'
  },
  forensics: {
    engine: 'Multi-Signal Neural Forensic Core',
    authenticity: 'MANIPULATED',
    trustScore: 18,
    manipulationProbability: 0.91,
    confidence: 0.94,
    verdict: 'Deepfake Neural Synthesis & Copyright Infringement',
    summary: 'Analyzed asset exhibits high-confidence neural facial synthesis, acoustic mismatch, and removed broadcast watermarks.',
    visualFindings: [
      'Facial boundary gradient discontinuity along jawline.',
      'Error Level Analysis reveals compression anomaly in facial region.',
      'PRNU sensor noise does not match claimed camera hardware.'
    ],
    detectedAnomalies: [
      'Facial Landmark Neural Artifacts (0.89)',
      'Audio-Visual Desynchronization (0.82)',
      'Steganographic Watermark Missing'
    ],
    recommendedAction: 'Automated DMCA Takedown & Provenance Flag',
    riskLevel: 'CRITICAL',
    ela: {
      meanError: 42.8,
      maxError: 198.4,
      variance: 38.2,
      hasCompressionAnomaly: true
    },
    exif: {
      make: 'Sony',
      model: 'ILCE-7SM3 (Spoofed)',
      lensModel: 'FE 24-70mm F2.8 GM',
      software: 'Adobe Premiere Pro 24.2 / Re-encoded',
      createDate: '2026-01-10T08:14:00Z',
      iso: 800,
      fNumber: 2.8,
      exposureTime: 0.02
    },
    stats: {
      width: 1920,
      height: 1080,
      channels: 3,
      entropy: 7.82,
      luminance: 124.5
    }
  }
}

export const SAMPLE_CASES: CaseRecord[] = [
  {
    id: '1',
    case_id: 'CASE-2026-089',
    platform: 'YouTube',
    username: 'viral_intel_feed',
    severity: 'CRITICAL',
    decision: 'EMERGENCY_TAKEDOWN',
    content_type: 'news',
    status: 'open',
    timestamp: '2026-01-10T08:30:00Z',
    dmca_filed: true,
    similarity: 0.94,
    ml_label: 'TAMPERED',
    notes: 'High-impact synthetic video. Immediate DMCA takedown issued with D3 provenance tree attachment.'
  },
  {
    id: '2',
    case_id: 'CASE-2026-088',
    platform: 'TikTok',
    username: 'sports_clips_99',
    severity: 'HIGH',
    decision: 'TAKEDOWN',
    content_type: 'sports',
    status: 'under_review',
    timestamp: '2026-01-09T14:15:00Z',
    dmca_filed: false,
    similarity: 0.98,
    ml_label: 'TAMPERED',
    notes: 'Watermark cropped out of master stream; candidate matched to NBC sports broadcast.'
  },
  {
    id: '3',
    case_id: 'CASE-2026-087',
    platform: 'X / Twitter',
    username: 'nature_hub',
    severity: 'LOW',
    decision: 'ALLOW',
    content_type: 'education',
    status: 'resolved',
    timestamp: '2026-01-08T11:00:00Z',
    dmca_filed: false,
    similarity: 0.12,
    ml_label: 'SAFE',
    notes: 'EXIF metadata verified authentic Canon R5 raw capture. No synthetic artifacts.'
  }
]
