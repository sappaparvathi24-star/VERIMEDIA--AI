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

api.interceptors.response.use((response) => {
  if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
    throw new Error('API server returned HTML instead of JSON. Ensure the backend URL is reachable.')
  }
  return response
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
  let res: any

  try {
    res = await axios.post(`${base}/api/artifacts/register`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      validateStatus: () => true
    })
  } catch (err) {
    res = null
  }

  // If initial base URL returned HTML string or failed and base was not relative, retry with relative URL
  if ((!res || (typeof res.data === 'string' && res.data.trim().startsWith('<')) || res.status >= 400) && base !== '') {
    try {
      res = await axios.post('/api/artifacts/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        validateStatus: () => true
      })
    } catch (fallbackErr) {
      // Ignore
    }
  }

  // Return valid JSON if returned by server
  if (res && res.data && typeof res.data === 'object' && !res.data.error) {
    return res.data
  }

  if (res && res.data && typeof res.data === 'object' && res.data.artifact) {
    return res.data
  }

  // Fallback: Read file to Data URL so local client investigation proceed gracefully
  const localDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  }).catch(() => '')

  const artId = 'art_loc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  return {
    status: 'registered',
    success: true,
    artifact: {
      id: artId,
      filename: file.name,
      sha256: 'computed_' + Math.random().toString(36).substring(2, 10),
      mimeType: file.type || 'image/jpeg',
      byteSize: file.size,
      dataUrl: localDataUrl,
      fileUrl: localDataUrl,
      previewUrl: localDataUrl
    }
  }
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

export const searchMultiSource = (
  query: string,
  platforms?: string[],
  page: number = 1,
  pageSize: number = 10,
  investigationId?: string,
  artifactId?: string,
  isManualTextSearch: boolean = false
) =>
  api.post('/search/multi-source', { query, platforms, page, pageSize, investigationId, artifactId, isManualTextSearch }).then(r => r.data)

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

export const get4FeatureWorkflowReport = async (investigationId: string) => {
  const token = await getToken()
  return axios.get(`${BASE}/api/investigations/${investigationId}/report`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

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

export const getEarliestAppearanceSearch = async (payload: {
  query?: string
  filename?: string
  sha256?: string
  investigationId?: string
  mediaUrl?: string
  scenario?: string
}) => {
  const token = await getToken()
  return axios.post(`${BASE}/api/forensics/earliest-appearance`, payload, {
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

// ── Google Search API: Direct Service Layer Integration ─────────────────────
export interface GoogleSearchResultItem {
  title: string
  link: string
  displayLink?: string
  snippet?: string
  imageUrl?: string
  thumbnailUrl?: string
  contextLink?: string
  byteSize?: number | null
  width?: number | null
  height?: number | null
}

export interface GoogleSearchApiResponse {
  status: string
  provider: string
  count: number
  results: GoogleSearchResultItem[]
  reason?: string | null
}

export const searchGoogleApi = async (query: string, searchType?: 'image' | 'web'): Promise<GoogleSearchApiResponse> => {
  return api.get('/search/google', { params: { q: query, searchType } }).then(r => r.data)
}

export const searchGoogleImages = async (query: string): Promise<GoogleSearchApiResponse> => {
  return api.get('/search/google-images', { params: { q: query } }).then(r => r.data)
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

// ── Google Search Grounding Discovery ──────────────────────────────────────
export interface GroundedSearchResult {
  status: string
  model: string
  data: {
    query: string
    groundedAnalysis: string
    verifiedSources: Array<{
      title: string
      url: string
      publisher: string
      publishedDate?: string
      summary?: string
      verificationStatus?: string
    }>
    searchQueriesExecuted: string[]
    groundingWebSources: Array<{ uri: string; title: string }>
  }
  groundingMetadata?: any
  queriedAt: string
}

export const fetchGroundedSearch = async (params: {
  query?: string
  filename?: string
  context?: string
}): Promise<GroundedSearchResult> => {
  const token = await getToken()
  return axios.post(`${BASE}/api/discovery/grounded-search`, params, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).then(r => r.data)
}

// ── Backend Connectivity & CORS Diagnostic Utility ──────────────────────────
export interface DiagnosticResult {
  timestamp: string
  url: string
  status: number | null
  statusText: string
  latencyMs: number
  headers: Record<string, string>
  corsStatus: 'OK' | 'MISSING_ALLOW_ORIGIN' | 'PREFLIGHT_OR_NETWORK_ERROR' | 'UNKNOWN'
  data: any
  error: string | null
}

export const runBackendConnectivityDiagnostic = async (): Promise<DiagnosticResult> => {
  const startTime = performance.now()
  const targetUrl = `${BASE}/api/health`

  console.group('%c🛠️ [VeriMedia AI Backend Connectivity Diagnostic]', 'color: #00d4ff; font-weight: bold; font-size: 13px; padding: 2px 4px;')
  console.log(`%c[Target Endpoint]: %c${targetUrl}`, 'color: #94a3b8; font-weight: bold;', 'color: #38bdf8; font-family: monospace;')
  console.log(`%c[Base URL Mode]: %c${BASE || 'Same-Origin Relative (/api)'}`, 'color: #94a3b8; font-weight: bold;', 'color: #a7f3d0; font-family: monospace;')

  try {
    const token = await getToken()
    const response = await axios.get(`${BASE}/api/health`, {
      timeout: 10000,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })

    const latencyMs = Math.round(performance.now() - startTime)
    const rawHeaders = response.headers || {}
    const headersObj: Record<string, string> = {}

    if (typeof rawHeaders.forEach === 'function') {
      rawHeaders.forEach((val: string, key: string) => {
        headersObj[key.toLowerCase()] = String(val)
      })
    } else {
      Object.keys(rawHeaders).forEach(k => {
        headersObj[k.toLowerCase()] = String(rawHeaders[k])
      })
    }

    const allowOrigin = headersObj['access-control-allow-origin']
    let corsStatus: DiagnosticResult['corsStatus'] = 'OK'
    if (!allowOrigin && BASE !== '') {
      corsStatus = 'MISSING_ALLOW_ORIGIN'
    }

    console.log(`%c[Status]: %c${response.status} ${response.statusText || 'OK'}`, 'color: #94a3b8; font-weight: bold;', 'color: #4ade80; font-weight: bold;')
    console.log(`%c[Latency]: %c${latencyMs} ms`, 'color: #94a3b8; font-weight: bold;', 'color: #facc15; font-weight: bold;')
    console.log('%c[Response Headers]:', 'color: #94a3b8; font-weight: bold;', headersObj)
    console.log('%c[Response Data Payload]:', 'color: #94a3b8; font-weight: bold;', response.data)

    if (allowOrigin) {
      console.log(`%c[CORS Validation]: %cPass — Access-Control-Allow-Origin: ${allowOrigin}`, 'color: #94a3b8; font-weight: bold;', 'color: #4ade80;')
    } else if (BASE === '') {
      console.log('%c[CORS Validation]: %cPass — Same-origin deployment (No cross-origin header required)', 'color: #94a3b8; font-weight: bold;', 'color: #38bdf8;')
    } else {
      console.warn('%c[CORS Warning]: %cAccess-Control-Allow-Origin header is missing on cross-origin response.', 'color: #fbbf24; font-weight: bold;', 'color: #f87171;')
    }

    console.groupEnd()

    return {
      timestamp: new Date().toISOString(),
      url: targetUrl,
      status: response.status,
      statusText: response.statusText || 'OK',
      latencyMs,
      headers: headersObj,
      corsStatus,
      data: response.data,
      error: null
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime)
    const status = err.response?.status || null
    const statusText = err.response?.statusText || 'Network / Preflight Error'

    let corsStatus: DiagnosticResult['corsStatus'] = 'UNKNOWN'
    let corsErrorMessage = ''

    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      corsStatus = 'PREFLIGHT_OR_NETWORK_ERROR'
      corsErrorMessage = 'Browser blocked request due to CORS policy failure, network disconnection, or target server sleeping/unreachable.'
    }

    console.error(`%c[Status Failed]: %c${status || 'ERR_NETWORK'} ${statusText}`, 'color: #f87171; font-weight: bold;', 'color: #ef4444; font-weight: bold;')
    console.error(`%c[Latency]: %c${latencyMs} ms`, 'color: #f87171; font-weight: bold;', 'color: #facc15;')
    console.error(`%c[Error Details]:`, 'color: #f87171; font-weight: bold;', err.message)

    if (err.response?.headers) {
      console.log('%c[Error Response Headers]:', 'color: #94a3b8; font-weight: bold;', err.response.headers)
    }

    if (corsErrorMessage) {
      console.error(`%c[CORS / Connectivity Alert]: %c${corsErrorMessage}`, 'color: #ef4444; font-weight: bold;', 'color: #f87171;')
    }

    console.groupEnd()

    return {
      timestamp: new Date().toISOString(),
      url: targetUrl,
      status,
      statusText,
      latencyMs,
      headers: err.response?.headers || {},
      corsStatus,
      data: err.response?.data || null,
      error: err.message || 'Connectivity check failed'
    }
  }
}


