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

// ── Phase E Investigations API ────────────────────────────────────────────
export const fetchInvestigations = (params?: Record<string, any>) =>
  axios.get('/api/investigations', { params }).then(r => r.data)

export const fetchInvestigation = (id: string) =>
  axios.get(`/api/investigations/${id}`).then(r => r.data)

export const createInvestigationApi = (data: {
  title: string
  description?: string
  priority?: string
  tags?: string[]
  createdBy?: string
  mode?: string
}) => axios.post('/api/investigations', data).then(r => r.data)

export const updateInvestigationApi = (id: string, updates: Record<string, any>) =>
  axios.patch(`/api/investigations/${id}`, updates).then(r => r.data)

export const attachArtifactToInvestigationApi = (id: string, payload: any) =>
  axios.post(`/api/investigations/${id}/artifacts`, payload).then(r => r.data)

export const fetchInvestigationArtifacts = (id: string) =>
  axios.get(`/api/investigations/${id}/artifacts`).then(r => r.data)

export const fetchInvestigationFindings = (id: string) =>
  axios.get(`/api/investigations/${id}/findings`).then(r => r.data)

export const fetchInvestigationEvidence = (id: string) =>
  axios.get(`/api/investigations/${id}/evidence`).then(r => r.data)

export const fetchInvestigationTimeline = (id: string) =>
  axios.get(`/api/investigations/${id}/timeline`).then(r => r.data)

export const addInvestigationNoteApi = (id: string, text: string, authorId?: string) =>
  axios.post(`/api/investigations/${id}/notes`, { text, authorId }).then(r => r.data)

export const fetchInvestigationNotes = (id: string) =>
  axios.get(`/api/investigations/${id}/notes`).then(r => r.data)

export const fetchFindingTraceability = (findingId: string) =>
  axios.get(`/api/findings/${findingId}/traceability`).then(r => r.data)
