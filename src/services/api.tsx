// VeriMedia AI — Typed API Client
import axios from 'axios'
import type {
  DetectionRequest, DetectionResult,
  DMCARequest, DMCANotice,
  CaseRecord, CaseStatus,
  HealthStatus,
} from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
