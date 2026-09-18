// VeriMedia AI — Typed API Client
import axios from 'axios'
import type {
  DetectionRequest, DetectionResult,
  DMCARequest, DMCANotice,
  CaseRecord, CaseStatus,
  HealthStatus,
} from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Detection ─────────────────────────────────────────────────────────────
export const detect = (req: DetectionRequest): Promise<DetectionResult> =>
  api.post<DetectionResult>('/detect/', req).then(r => r.data)

export const getDetectStats = () =>
  api.get<{ total_scans: number; status: string }>('/detect/stats').then(r => r.data)

// ── Enforcement ───────────────────────────────────────────────────────────
export const fileDMCA = (req: DMCARequest): Promise<DMCANotice> =>
  api.post<DMCANotice>('/enforce/dmca', req).then(r => r.data)

// ── Cases ─────────────────────────────────────────────────────────────────
export const listCases = (limit = 50): Promise<CaseRecord[]> =>
  api.get<CaseRecord[]>('/cases/', { params: { limit } }).then(r => r.data)

export const updateCase = (caseId: string, status: CaseStatus, notes?: string) =>
  api.patch(`/cases/${caseId}`, { status, notes }).then(r => r.data)

// ── Health ────────────────────────────────────────────────────────────────
export const getHealth = (): Promise<HealthStatus> =>
  api.get<HealthStatus>('/health').then(r => r.data)

// ── Ingestion & Demonstrations ───────────────────────────────────────────
export interface IngestResponse {
  success: boolean
  mode: 'REAL_INVESTIGATION'
  artifact: {
    id: string
    filename: string
    mimeType: string
    size: number
    sha256: string
    perceptualHash: string
    metadata: Record<string, any>
    sourceType: string
    sourceUrl?: string
    createdAt: string
  }
  investigation: {
    id: string
    artifactId: string
    mode: string
    status: string
    findings: any[]
    evidence: any[]
    observations: any[]
    uncertainty: string[]
    createdAt: string
  }
  observationsCount: number
  evidenceCount: number
  findingsCount: number
}

export const ingestMedia = (payload: { fileData?: string; filename?: string; mimeType?: string; url?: string }): Promise<IngestResponse> =>
  axios.post<IngestResponse>('/api/media/ingest', payload).then(r => r.data)

export const triggerDemoScenario = (scenario: string) =>
  axios.post('/api/demo/scenario', { scenario }).then(r => r.data)

