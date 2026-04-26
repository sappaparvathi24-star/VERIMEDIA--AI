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
  match_score: number
  spatial_diff: number
  color_diff: number
  frame_diff: number
  temporal_diff: number
  noise_score: number
  watermark_detected: number
}

export interface MLPrediction {
  label: MLLabel
  manipulation_probability: number
  trust_score: number
  confidence: number
  signals: MLSignals
}

export interface IntegritySignals {
  jpeg_artifact: number
  noise_pattern: number
  edge_consistency: number
  metadata_coherence: number
  color_histogram: number
  face_landmark: number
  lipsync: number
  temporal_mismatch: number
  watermark_presence: number
}

export interface IntegrityResult {
  score: number
  flags: string[]
  signals: IntegritySignals
}

export interface TrustResult {
  trust_score: number
  risk_tier: 'safe' | 'suspect' | 'high_risk'
  verdict: string
  factors: Record<string, number>
}

export interface AuthorshipConfidence {
  confidence: number
  reason: string
  origin_node: string
  embedding_distance: number
}

export interface PropagationSignal {
  total_scans: number
  velocity: number
  urgency: Urgency
  indicator: string
  ppm: number
  anomaly_flag: boolean
  anomaly_score: number
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
  authorship: AuthorshipConfidence
  propagation: PropagationSignal
  ai_analysis: AIAnalysis
  timestamp: string
  case_id: string | null
  processing_ms: number
}

export interface DetectionRequest {
  platform: Platform
  username: string
  caption: string
  content_type: ContentType
  scenario: Scenario
  media_url?: string
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

export type TabId = 'feed' | 'origin' | 'forensic' | 'cases' | 'system'
export type ScenarioKey = Scenario
