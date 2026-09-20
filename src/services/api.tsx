// VeriMedia AI — Typed API Client for Provenance & Media Investigations
import axios from 'axios'
import { getToken } from '../lib/supabaseClient'
import { networkLogger } from './networkLogger'
import type {
  DetectionRequest, DetectionResult,
  DMCARequest, DMCANotice,
  CaseRecord, CaseStatus,
  HealthStatus,
} from '../types'

export { networkLogger }

// Canonical Render backend URL — update this single constant when the backend URL changes
const RENDER_BACKEND = 'https://verimedia-ai-2.onrender.com'

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (envUrl && envUrl !== 'https://verimedia-ai-2.onrender.com' && envUrl !== 'https://verimedia-ai-1.onrender.com') {
    return envUrl.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // Only route to external Render backend if hosted purely on static Vercel domain
    if (host.includes('vercel.app')) {
      return RENDER_BACKEND
    }
    // In local dev, Cloud Run preview container (*.run.app), and same-origin deployments, use relative base
    return ''
  }
  return ''
}

const BASE = getApiBaseUrl()

const api = axios.create({
  baseURL: `${BASE}/api`,
  // Render free tier can take up to 50s to wake from suspension on the first request.
  // Set timeout high enough to survive cold start, but not so high it hangs forever.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach network logger interceptors for real-time traffic audit & backend verification
networkLogger.attachAxios(api)
networkLogger.attachAxios(axios)

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

export const uploadArtifactAsync = async (file: File, investigationId?: string) => {
  const token = await getToken()
  const formData = new FormData()
  formData.append('file', file)
  if (investigationId) {
    formData.append('investigationId', investigationId)
  }

  return axios.post(`${BASE}/api/artifacts/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }).then(r => r.data)
}

export const getForensicJob = async (jobId: string) => {
  return axios.get(`${BASE}/api/jobs/${jobId}`).then(r => r.data)
}

export const listForensicJobs = async (params?: { investigationId?: string; artifactId?: string; status?: string }) => {
  return axios.get(`${BASE}/api/jobs`, { params }).then(r => r.data)
}

export const pollForensicJob = async (jobId: string, maxWaitMs = 30000, intervalMs = 1000) => {
  const startTime = Date.now()
  while (Date.now() - startTime < maxWaitMs) {
    const data = await getForensicJob(jobId)
    const job = data?.job || data
    if (job?.status === 'COMPLETED' || job?.status === 'SKIPPED' || job?.status === 'FAILED') {
      return job
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Forensic job ${jobId} timed out after ${maxWaitMs}ms`)
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

export const getDetectionTrends = (timeRange: string = '24h', platform: string = 'ALL') =>
  api.get('/analytics/detection-trends', { params: { timeRange, platform } }).then(r => r.data)

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

export const recordDecision = (caseId: string, decision: string, notes?: string) =>
  api.patch(`/v1/cases/${caseId}`, { decision, notes }).then(r => r.data)

export const getAuditEvents = (params?: { limit?: number; investigationId?: string }) =>
  api.get('/audit', { params }).then(r => r.data)

export const getHealth = (): Promise<HealthStatus> =>
  api.get<HealthStatus>('/health').then(r => r.data)

// ── Gemini Intelligence API ──────────────────────────────────────────────────
export const askGeminiCopilot = async (prompt: string, history?: Array<{ role: string; content: string }>) => {
  const token = await getToken()
  return axios.post(`${BASE}/api/chat`, { prompt, messages: history }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const explainForensicSignalGemini = async (payload: {
  signalKey: string
  signalName?: string
  value?: number | string
  context?: string
  mediaType?: string
}) => {
  const token = await getToken()
  return axios.post(`${BASE}/api/gemini/explain`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const generateInvestigationBriefGemini = async (payload: {
  investigationId: string
  userNotes?: string
}) => {
  const token = await getToken()
  return axios.post(`${BASE}/api/gemini/investigation-brief`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

export const analyzeMultimodalGemini = async (payload: {
  imageBase64: string
  mimeType?: string
  prompt?: string
  filename?: string
}) => {
  const token = await getToken()
  return axios.post(`${BASE}/api/gemini/multimodal-analyze`, payload, {
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

// ── Google Search API: Earliest Known Appearance (Source) ───────────────────
export interface EarliestAppearanceResult {
  found: boolean
  targetQuery: string
  earliestAppearance: {
    title: string
    publisher: string
    domain: string
    url: string
    publishedAt: string
    formattedDate?: string
    snippet?: string
    platform?: string
    confidenceScore: number
    sourceType?: string
    author?: string
  }
  searchSummary: string
  timelineAppearances: Array<{
    order?: number
    timestamp: string
    platform: string
    domain: string
    url?: string
    title: string
    type: string
    isEarliest: boolean
  }>
  corroborationSources: string[]
  searchQueriesUsed: string[]
  groundingSources?: Array<{ uri: string; title: string }>
  provider: string
  queriedAt: string
}

export const fetchEarliestAppearance = async (params: {
  query?: string
  filename?: string
  sha256?: string
  investigationId?: string
  mediaUrl?: string
  scenario?: string
}): Promise<EarliestAppearanceResult> => {
  const token = await getToken()
  return axios.post(`${BASE}/api/forensics/earliest-appearance`, params, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

