// VeriMedia AI — Typed API Client for Provenance & Media Investigations
import axios from 'axios'
import type {
  DetectionRequest, DetectionResult,
  DMCARequest, DMCANotice,
  CaseRecord, CaseStatus,
  HealthStatus,
} from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Investigations & Provenance API ──────────────────────────────────────────
export const listInvestigations = () =>
  api.get('/investigations').then(r => r.data)

export const createInvestigation = (payload: { title: string; description?: string }) =>
  api.post('/investigations', payload).then(r => r.data)

export const getInvestigationDetails = (id: string) =>
  api.get(`/investigations/${id}`).then(r => r.data)

export const getInvestigationProvenance = (id: string) =>
  api.get(`/investigations/${id}/provenance`).then(r => r.data)

export const getInvestigationTimeline = (id: string) =>
  api.get(`/investigations/${id}/timeline`).then(r => r.data)

export const getInvestigationReasoning = (id: string) =>
  api.get(`/investigations/${id}/reasoning`).then(r => r.data)

export const getMediaStoryline = (id: string) =>
  api.get(`/investigations/${id}/storyline`).then(r => r.data)

export const getWhatWeKnow = (id: string) =>
  api.get(`/investigations/${id}/what-we-know`).then(r => r.data)

export const getWhatRemainsUnknown = (id: string) =>
  api.get(`/investigations/${id}/what-remains-unknown`).then(r => r.data)

export const uploadArtifactFile = (investigationId: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return axios.post(`${BASE}/api/investigations/${investigationId}/artifacts/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

// ── Legacy Compatibility Wrappers ──────────────────────────────────────────
export const detect = (req: DetectionRequest): Promise<DetectionResult> =>
  api.post<DetectionResult>('/v1/detect/', req).then(r => r.data)

export const getDetectStats = () =>
  api.get<{ total_scans: number; status: string }>('/v1/detect/stats').then(r => r.data)

export const fileDMCA = (req: DMCARequest): Promise<DMCANotice> =>
  api.post<DMCANotice>('/v1/enforce/dmca', req).then(r => r.data)

export const listCases = (limit = 50): Promise<CaseRecord[]> =>
  api.get<CaseRecord[]>('/v1/cases/', { params: { limit } }).then(r => r.data)

export const updateCase = (caseId: string, status: CaseStatus, notes?: string) =>
  api.patch(`/v1/cases/${caseId}`, { status, notes }).then(r => r.data)

export const getHealth = (): Promise<HealthStatus> =>
  api.get<HealthStatus>('/health').then(r => r.data)
