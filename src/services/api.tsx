// VeriMedia AI — Typed API Client for Provenance & Media Investigations
import axios from 'axios'
import { getToken } from '../lib/supabaseClient'
import type {
  DetectionRequest, DetectionResult,
  DMCARequest, DMCANotice,
  CaseRecord, CaseStatus,
  HealthStatus,
} from '../types'

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    // If running on Vercel preview or production without explicit env variable, route to the Render backend
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://verimedia-ai-1.onrender.com'
    }
  }
  return ''
}

const BASE = getApiBaseUrl()

const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach Bearer token automatically to every API request
api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
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

export const registerMediaArtifact = async (file: File) => {
  const token = await getToken()
  const formData = new FormData()
  formData.append('media', file)
  formData.append('file', file)

  const base = getApiBaseUrl()
  const res = await axios.post(`${base}/api/artifacts/register`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    validateStatus: () => true
  })

  if (typeof res.data === 'string' && res.data.trim().startsWith('<')) {
    throw new Error('API server returned HTML instead of JSON. Ensure the backend URL is reachable.')
  }

  if (res.status >= 400 || !res.data) {
    const errMsg = typeof res.data === 'object' && res.data?.error ? res.data.error : `Upload failed (HTTP ${res.status})`
    throw new Error(errMsg)
  }

  return res.data
}

export const uploadArtifactFile = async (investigationId: string, file: File) => {
  const token = await getToken()
  const formData = new FormData()
  formData.append('file', file)
  return axios.post(`${BASE}/api/investigations/${investigationId}/artifacts/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }).then(r => r.data)
}

// ── Discovery & Provider Health API ──────────────────────────────────────────
export const getProviders = () =>
  api.get('/providers').then(r => r.data)

export const getProviderHealth = (provider: string) =>
  api.get(`/providers/${provider}/health`).then(r => r.data)

export const testProvider = (provider: string) =>
  api.post(`/providers/${provider}/test`).then(r => r.data)

export const getSearchTransparency = () =>
  api.get('/search/transparency').then(r => r.data)

export const searchMultiSource = (query: string, platforms?: string[]) =>
  api.post('/search/multi-source', { query, platforms }).then(r => r.data)

export const getInvestigationCandidates = (id: string) =>
  api.get(`/investigations/${id}/discovery/candidates`).then(r => r.data)

export const getInvestigationGenealogy = (id: string) =>
  api.get(`/investigations/${id}/genealogy`).then(r => r.data)

export const getInvestigationPropagation = (id: string) =>
  api.get(`/investigations/${id}/propagation`).then(r => r.data)

export const getInvestigationAlerts = (id: string) =>
  api.get(`/investigations/${id}/alerts`).then(r => r.data)

export const getInvestigationReports = (id: string) =>
  api.get(`/investigations/${id}/reports`).then(r => r.data)

export const generateInvestigationReport = (id: string) =>
  api.post(`/investigations/${id}/report`).then(r => r.data)

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

// ── Gemini Intelligence API ──────────────────────────────────────────────────
export const askGeminiCopilot = async (prompt: string, history?: Array<{ role: string; content: string }>) => {
  const token = await getToken()
  return axios.post(`${BASE}/chat`, { prompt, messages: history }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const analyzeForensicsGemini = async (payload: any) => {
  const token = await getToken()
  return axios.post(`${BASE}/analyze`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const decomposeClaimGemini = async (statement: string) => {
  const token = await getToken()
  return axios.post(`${BASE}/claims/decompose`, { statement }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const generateDMCANoticeGemini = async (payload: any) => {
  const token = await getToken()
  return axios.post(`${BASE}/dmca/generate`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}
