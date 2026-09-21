// VeriMedia AI — Complete TypeScript Type Definitions

export type Platform = 'YouTube' | 'Instagram' | 'TikTok' | 'X / Twitter' | 'Facebook' | 'Reddit'
export type ContentType = 'sports' | 'news' | 'entertainment' | 'education' | 'unknown'
export type Scenario = 'normal' | 'crop' | 'blur' | 'manipulated' | 'deepfake' | 'adversarial' | 'news' | 'entertainment' | 'education' | 'scam' | 'insufficient'
export type Decision = 'ALLOW' | 'ATTRIBUTION' | 'REVIEW REQUIRED' | 'SUSPECT' | 'TAKEDOWN' | 'EMERGENCY_TAKEDOWN'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskLabel = 'SAFE' | 'SUSPECT' | 'HIGH_RISK'
export type MLLabel = 'SAFE' | 'SUSPICIOUS' | 'TAMPERED'
export type Urgency = 'low' | 'medium' | 'high' | 'critical'
export type CaseStatus = 'open' | 'under_review' | 'dmca_filed' | 'resolved' | 'closed'

export interface MLSignals {
  match_score?: number | null
  spatial_diff?: number | null
  color_diff?: number | null
  frame_diff?: number | null
  temporal_diff?: number | null
  noise_score?: number | null
  watermark_detected?: number | null
  face_landmark?: number | null
  jpeg_artifact?: number | null
  edge_consistency?: number | null
  temporal_mismatch?: number | null
}

export interface MLPrediction {
  label: MLLabel
  manipulation_probability?: number | null
  trust_score?: number | null
  confidence?: number | null
  signals: MLSignals
}

export interface IntegritySignals {
  jpeg_artifact?: number | null
  noise_pattern?: number | null
  edge_consistency?: number | null
  metadata_coherence?: number | null
  color_histogram?: number | null
  face_landmark?: number | null
  lipsync?: number | null
  temporal_mismatch?: number | null
  watermark_presence?: number | null
}

export interface IntegrityResult {
  score?: number | null
  flags: string[]
  signals: IntegritySignals
}

export interface TrustResult {
  trust_score?: number | null
  risk_tier: 'safe' | 'suspect' | 'high_risk' | 'unknown'
  verdict: string
  factors: Record<string, number | null>
}

export interface AuthorshipConfidence {
  confidence?: number | null
  reason?: string
  origin_node?: string
  embedding_distance?: number | null
}

export interface PropagationSignal {
  total_scans?: number | null
  velocity?: number | null
  urgency?: Urgency
  indicator?: string
  ppm?: number | null
  anomaly_flag?: boolean
  anomaly_score?: number | null
}

export interface AIAnalysis {
  threat_type: string
  decision: Decision
  severity: Severity
  risk_label: RiskLabel
  confidence: number
  reasoning_points: string[]
  action: string
  recommended_action: string
  origin_traced: boolean
  dmca_needed: boolean
  source: 'claude' | 'fallback'
}

export interface DetectionResult {
  job_id: string
  platform: Platform
  username: string
  caption: string
  content_type: ContentType
  scenario: string
  similarity: number
  fingerprint_hash: string
  ml: MLPrediction
  integrity: IntegrityResult
  trust: TrustResult
  authorship?: AuthorshipConfidence | null
  propagation?: PropagationSignal | null
  ai_analysis: AIAnalysis
  timestamp: string
  case_id: string | null
  processing_ms: number
  investigationId?: string | null
  is_demo?: boolean
  mode?: string
  disclaimer?: string | null
  visual_findings?: string[]
  subject_description?: string | null
  detected_anomalies?: string[]
  forensics?: {
    engine?: string
    status?: string
    reason?: string | null
    source?: string | null
    limitations?: string[]
    authenticity?: string | null
    trustScore?: number | null
    manipulationProbability?: number | null
    confidence?: number | null
    verdict?: string
    summary?: string | null
    subjectDescription?: string | null
    visualFindings?: string[]
    detectedAnomalies?: string[]
    recommendedAction?: string
    riskLevel?: string
    ela?: {
      meanError?: number
      maxError?: number
      variance?: number
      hasCompressionAnomaly?: boolean
    }
    exif?: {
      make?: string
      model?: string
      lensModel?: string
      software?: string
      createDate?: string
      iso?: number
      fNumber?: number
      exposureTime?: number
    }
    stats?: {
      width?: number
      height?: number
      channels?: number
      entropy?: number
      luminance?: number
    }
    ocr?: {
      supported?: boolean
      text?: string
      confidence?: number
      wordCount?: number
      language?: string
      hasText?: boolean
      error?: string
    }
    c2pa?: {
      status?: string
      manifest?: {
        title?: string | null
        claim_generator?: string | null
        assertions?: number
        ingredients?: number
        signature_info?: unknown
      } | null
      message?: string
      isRealAnalysis?: boolean
    }
    videoMetadata?: {
      supported?: boolean
      status?: string
      isRealAnalysis?: boolean
      codec?: string | null
      codecLongName?: string | null
      duration?: number
      fps?: number | null
      frameCount?: number | null
      resolution?: { width?: number | null; height?: number | null } | null
      bitrate?: number
      byteSize?: number
      audioCodec?: string | null
      audioChannels?: number | null
      audioSampleRate?: number | null
      container?: string | null
      creationTime?: string | null
      streamCount?: number
      reason?: string
    } | null
  }
  artifact?: {
    id: string
    filename: string
    sha256?: string
    perceptualHash?: string
    dimensions?: { width: number; height: number } | null
    byteSize?: number
    mimeType?: string
    fileUrl?: string
    previewUrl?: string
    dataUrl?: string
    matchedReferenceId?: string | null
    /** Raw EXIF fields from exifr.parse() — camera make/model/settings */
    rawExif?: Record<string, unknown> | null
  }
}

export interface DetectionRequest {
  platform: Platform
  username: string
  caption: string
  content_type: ContentType
  scenario: Scenario
  media_url?: string
  artifactId?: string
  investigationId?: string
}

export interface DMCARequest {
  case_id: string
  platform: Platform
  username: string
  caption: string
  content_type: ContentType
  analysis: Record<string, unknown>
}

export interface DMCANotice {
  case_id: string
  subject: string
  body: string
  evidence_summary: string
  evidence_json: Record<string, unknown>
  claimant_name: string
  organization: string
  original_asset_id: string
  detection_timestamp: string
  match_score: number
  manipulation_details: string
  action_recommendation: string
  source: 'claude' | 'fallback'
}

export interface CaseRecord {
  id: string
  case_id: string
  platform: string
  username: string
  severity: Severity
  decision: Decision
  content_type: ContentType
  status: CaseStatus
  timestamp: string
  dmca_filed: boolean
  similarity?: number
  ml_label?: string
  notes?: string
}

export interface HealthStatus {
  status: string
  version: string
  services: Record<string, string>
  uptime_seconds: number
  total_scans: number
}

// ── UI State ───────────────────────────────────────────────────────────────

export interface ScanStats {
  total: number
  threats: number
  dmca: number
  clean: number
}

export interface GraphNode {
  id: string
  x: number
  y: number
  type: 'origin' | 'normal' | 'mutation' | 'threat' | 'platform'
  platform?: string
  label: string
  size: number
  color: string
}

export interface GraphEdge {
  from: string
  to: string
  color: string
  width: number
}

export type TabId = 'scanner' | 'propagation' | 'forensic' | 'origin' | 'discovery' | 'reasoning' | 'cases' | 'trends' | 'system' | 'feed' | 'intelligence' | 'review'
export type ScenarioKey = Scenario
