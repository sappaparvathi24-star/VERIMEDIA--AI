// VeriMedia AI — Network Request/Response Live Logger & Data Fidelity Auditor
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type DataFidelity = 
  | 'REAL_FORENSICS'        // True binary forensic execution (Sharp, ELA, EXIF, pHash, SHA-256)
  | 'GEMINI_AI'             // Live Gemini Multimodal / Reasoning model response
  | 'CLOUD_DATABASE'        // Live Supabase / PostgreSQL query
  | 'PERSISTENCE_STORE'     // Live SQLite / Provenance DB transaction
  | 'DISCOVERY_PROVIDER'    // Live external provider / Search API query
  | 'FALLBACK_HEURISTIC'    // Server heuristic fallback (e.g. offline fallback)
  | 'CLIENT_SIMULATION'     // Client synthetic fallback
  | 'SYSTEM_TELEMETRY'      // Health checks, ping, metrics

export interface NetworkLogEntry {
  id: string
  traceId: string
  timestamp: string
  formattedTime: string
  method: HttpMethod
  url: string
  fullUrl: string
  status?: number
  statusText?: string
  durationMs: number
  state: 'pending' | 'success' | 'error'
  
  // Request metadata
  requestHeaders: Record<string, string>
  requestBody?: any
  queryParams?: Record<string, any>
  
  // Response metadata
  responseHeaders?: Record<string, string>
  responseBody?: any
  errorMessage?: string
  
  // Data Fidelity & Real Backend Analysis
  fidelity: DataFidelity
  isRealData: boolean
  fidelitySummary: string
  detectedSignals: string[]
  curlCommand: string
}

class NetworkLoggerService {
  private logs: NetworkLogEntry[] = []
  private maxLogs = 500
  private listeners: Set<(logs: NetworkLogEntry[]) => void> = new Set()
  private isRecording = true

  public getLogs(): NetworkLogEntry[] {
    return [...this.logs]
  }

  public subscribe(listener: (logs: NetworkLogEntry[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getLogs())
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const current = this.getLogs()
    this.listeners.forEach(fn => fn(current))
  }

  public clear() {
    this.logs = []
    this.notify()
  }

  public toggleRecording(): boolean {
    this.isRecording = !this.isRecording
    return this.isRecording
  }

  public getRecordingStatus(): boolean {
    return this.isRecording
  }

  // Generate a standard cURL command for testing & terminal reproduction
  private generateCurl(config: AxiosRequestConfig | InternalAxiosRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase()
    const fullUrl = config.baseURL 
      ? (config.url?.startsWith('http') ? config.url : `${config.baseURL.replace(/\/$/, '')}/${config.url?.replace(/^\//, '')}`)
      : (config.url || '')
    
    let curl = `curl -X ${method} "${fullUrl}"`
    
    if (config.headers) {
      Object.entries(config.headers).forEach(([k, v]) => {
        if (typeof v === 'string' && k.toLowerCase() !== 'common') {
          curl += ` \\\n  -H "${k}: ${v}"`
        }
      })
    }
    
    if (config.data && method !== 'GET') {
      if (typeof config.data === 'string') {
        curl += ` \\\n  -d '${config.data}'`
      } else if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        curl += ` \\\n  -F "[multipart/form-data payload]"`
      } else {
        try {
          curl += ` \\\n  -d '${JSON.stringify(config.data)}'`
        } catch {
          // ignore circular
        }
      }
    }
    
    return curl
  }

  // Audits the response payload to determine if it is authentic server forensic computation or a fallback
  public auditFidelity(url: string, method: string, status?: number, body?: any): {
    fidelity: DataFidelity
    isRealData: boolean
    summary: string
    signals: string[]
  } {
    const signals: string[] = []
    const lowerUrl = url.toLowerCase()

    if (!body || status === 0 || (status && status >= 400)) {
      return {
        fidelity: 'FALLBACK_HEURISTIC',
        isRealData: false,
        summary: status ? `HTTP Error (${status})` : 'Network Error / Disconnected',
        signals: ['error_response']
      }
    }

    // Health / Metrics endpoint
    if (lowerUrl.includes('/health') || lowerUrl.includes('/detect/stats')) {
      if (body.uptime_seconds !== undefined || body.services) {
        signals.push('live_server_uptime', 'service_registry_active')
      }
      return {
        fidelity: 'SYSTEM_TELEMETRY',
        isRealData: true,
        summary: 'Live Service Health & Telemetry',
        signals
      }
    }

    // Database & Investigation Records
    if (lowerUrl.includes('/investigations') || lowerUrl.includes('/cases') || lowerUrl.includes('/audit')) {
      if (Array.isArray(body)) {
        signals.push(`records_count:${body.length}`, 'sqlite_storage_query')
        return {
          fidelity: 'PERSISTENCE_STORE',
          isRealData: true,
          summary: `Database Store Query (${body.length} live records)`,
          signals
        }
      }
      if (body.investigation || body.id || body.title) {
        signals.push('case_record_resolved', 'sqlite_provenance_node')
        return {
          fidelity: 'PERSISTENCE_STORE',
          isRealData: true,
          summary: 'Database Record Retrieved',
          signals
        }
      }
    }

    // Gemini AI Reasoning
    if (lowerUrl.includes('/chat') || lowerUrl.includes('/gemini/') || lowerUrl.includes('/claims/decompose')) {
      if (body.response || body.analysis || body.dossier || body.claims || body.explanation) {
        signals.push('gemini_llm_inference', 'structured_xai_output')
        return {
          fidelity: 'GEMINI_AI',
          isRealData: true,
          summary: 'Gemini Multimodal Live Model Inference',
          signals
        }
      }
    }

    // Provider / Search Discovery
    if (lowerUrl.includes('/search') || lowerUrl.includes('/providers') || lowerUrl.includes('/earliest-appearance')) {
      if (body.found !== undefined || body.providers || body.results || body.timelineAppearances) {
        signals.push('provider_search_orchestrated', 'web_crawler_transparency')
        return {
          fidelity: 'DISCOVERY_PROVIDER',
          isRealData: true,
          summary: 'Live Provider Search & Discovery',
          signals
        }
      }
    }

    // Core Forensics & Detection Pipeline
    if (lowerUrl.includes('/detect') || lowerUrl.includes('/artifacts') || lowerUrl.includes('/forensic') || lowerUrl.includes('/jobs')) {
      let isReal = false
      
      // Check for real SHA-256 fingerprint
      if (body.fingerprint_hash?.length === 64 || body.artifact?.sha256?.length === 64) {
        signals.push('sha256_cryptographic_digest')
        isReal = true
      }
      
      // Check for real perceptual hash
      if (body.artifact?.perceptualHash || body.forensics?.perceptualHash) {
        signals.push('dhash_perceptual_hash')
        isReal = true
      }

      // Check for real ELA (Error Level Analysis)
      if (body.forensics?.ela?.meanError !== undefined || body.forensics?.ela?.blocksAnalyzed) {
        signals.push(`sharp_ela_computation (variance: ${body.forensics.ela.meanError}dB)`)
        isReal = true
      }

      // Check for EXIF metadata extraction
      if (body.artifact?.metadata?.exif || body.forensics?.exif) {
        signals.push('exif_metadata_extracted')
        isReal = true
      }

      // Check for dimensions from Sharp binary analysis
      if (body.artifact?.dimensions?.width && body.artifact?.dimensions?.height) {
        signals.push(`binary_raster_dimensions (${body.artifact.dimensions.width}x${body.artifact.dimensions.height})`)
        isReal = true
      }

      // Check for ML signals & visual findings
      if (body.forensics?.visualFindings?.length) {
        signals.push(`visual_artifacts_classified (${body.forensics.visualFindings.length} regions)`)
        isReal = true
      }

      // Check for AI analysis source
      if (body.ai_analysis?.source === 'fallback') {
        signals.push('rule_based_fallback_heuristics')
      } else if (body.ai_analysis?.source) {
        signals.push(`ai_decision_engine (${body.ai_analysis.source})`)
        isReal = true
      }

      if (isReal) {
        return {
          fidelity: 'REAL_FORENSICS',
          isRealData: true,
          summary: 'Verified Real Binary Forensic & ML Computation',
          signals
        }
      } else {
        return {
          fidelity: 'FALLBACK_HEURISTIC',
          isRealData: false,
          summary: 'Fallback Heuristic / Baseline Synthesis',
          signals: signals.length ? signals : ['synthetic_heuristic_defaults']
        }
      }
    }

    // Default check
    if (body && typeof body === 'object') {
      signals.push('json_payload_valid')
      return {
        fidelity: 'PERSISTENCE_STORE',
        isRealData: true,
        summary: 'Standard API Response',
        signals
      }
    }

    return {
      fidelity: 'CLIENT_SIMULATION',
      isRealData: false,
      summary: 'Raw / Unclassified Response',
      signals: ['unclassified']
    }
  }

  // Interceptor Installer for Axios
  public attachAxios(axiosInstance: AxiosInstance) {
    // Request Interceptor
    axiosInstance.interceptors.request.use((config) => {
      if (!this.isRecording) return config

      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const traceId = `trc-${Math.random().toString(36).substring(2, 9)}`
      const now = new Date()
      const formattedTime = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0')
      
      const fullUrl = config.baseURL 
        ? (config.url?.startsWith('http') ? config.url : `${config.baseURL.replace(/\/$/, '')}/${config.url?.replace(/^\//, '')}`)
        : (config.url || '')

      let cleanRequestBody: any = config.data
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        const fields: Array<{ key: string; value: string }> = []
        try {
          // @ts-ignore
          for (const [k, v] of (config.data as any).entries()) {
            fields.push({
              key: String(k),
              value: (typeof File !== 'undefined' && v instanceof File)
                ? `File: ${v.name} (${(v.size / 1024).toFixed(1)} KB, ${v.type})`
                : String(v)
            })
          }
        } catch {
          // fallback if entries is not accessible
        }
        cleanRequestBody = {
          _type: 'FormData (Multipart)',
          fields
        }
      }

      const entry: NetworkLogEntry = {
        id,
        traceId,
        timestamp: now.toISOString(),
        formattedTime,
        method: ((config.method || 'GET').toUpperCase() as HttpMethod),
        url: config.url || '',
        fullUrl,
        durationMs: 0,
        state: 'pending',
        requestHeaders: { ...(config.headers as any) },
        requestBody: cleanRequestBody,
        queryParams: config.params,
        fidelity: 'PERSISTENCE_STORE',
        isRealData: true,
        fidelitySummary: 'In Flight...',
        detectedSignals: ['request_dispatched'],
        curlCommand: this.generateCurl(config)
      }

      // Attach internal metadata to config
      ;(config as any).__networkLogId = id
      ;(config as any).__startTime = performance.now()

      this.logs.unshift(entry)
      if (this.logs.length > this.maxLogs) {
        this.logs.pop()
      }
      this.notify()

      return config
    }, (error) => {
      return Promise.reject(error)
    })

    // Response Interceptor
    axiosInstance.interceptors.response.use((response) => {
      const config = response.config as any
      const id = config?.__networkLogId
      const startTime = config?.__startTime

      if (id) {
        const durationMs = startTime ? Math.round(performance.now() - startTime) : 0
        const entry = this.logs.find(l => l.id === id)
        if (entry) {
          entry.status = response.status
          entry.statusText = response.statusText
          entry.durationMs = durationMs
          entry.state = response.status >= 400 ? 'error' : 'success'
          entry.responseHeaders = { ...(response.headers as any) }
          entry.responseBody = response.data

          const audit = this.auditFidelity(entry.url, entry.method, response.status, response.data)
          entry.fidelity = audit.fidelity
          entry.isRealData = audit.isRealData
          entry.fidelitySummary = audit.summary
          entry.detectedSignals = audit.signals

          this.notify()
        }
      }
      return response
    }, (error) => {
      const config = error.config as any
      const id = config?.__networkLogId
      const startTime = config?.__startTime

      if (id) {
        const durationMs = startTime ? Math.round(performance.now() - startTime) : 0
        const entry = this.logs.find(l => l.id === id)
        if (entry) {
          entry.status = error.response?.status || 0
          entry.statusText = error.response?.statusText || 'Network Error'
          entry.durationMs = durationMs
          entry.state = 'error'
          entry.errorMessage = error.message || 'Request failed'
          entry.responseHeaders = error.response?.headers ? { ...(error.response.headers as any) } : undefined
          entry.responseBody = error.response?.data || { error: error.message }

          const audit = this.auditFidelity(entry.url, entry.method, entry.status, entry.responseBody)
          entry.fidelity = audit.fidelity
          entry.isRealData = false
          entry.fidelitySummary = error.message || audit.summary
          entry.detectedSignals = [...audit.signals, 'error_intercepted']

          this.notify()
        }
      }
      return Promise.reject(error)
    })
  }

  // Direct manual log injector (for testing or fetch calls)
  public logManual(entry: Omit<NetworkLogEntry, 'id' | 'timestamp' | 'formattedTime' | 'fidelity' | 'isRealData' | 'fidelitySummary' | 'detectedSignals' | 'curlCommand'> & Partial<NetworkLogEntry>) {
    const id = `man_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date()
    const formattedTime = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0')
    const audit = this.auditFidelity(entry.url, entry.method, entry.status, entry.responseBody)

    const fullEntry: NetworkLogEntry = {
      id,
      traceId: entry.traceId || `trc-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: now.toISOString(),
      formattedTime,
      method: entry.method,
      url: entry.url,
      fullUrl: entry.fullUrl || entry.url,
      status: entry.status,
      statusText: entry.statusText,
      durationMs: entry.durationMs,
      state: entry.state,
      requestHeaders: entry.requestHeaders || {},
      requestBody: entry.requestBody,
      queryParams: entry.queryParams,
      responseHeaders: entry.responseHeaders,
      responseBody: entry.responseBody,
      errorMessage: entry.errorMessage,
      fidelity: entry.fidelity || audit.fidelity,
      isRealData: entry.isRealData !== undefined ? entry.isRealData : audit.isRealData,
      fidelitySummary: entry.fidelitySummary || audit.summary,
      detectedSignals: entry.detectedSignals || audit.signals,
      curlCommand: entry.curlCommand || `curl -X ${entry.method} "${entry.url}"`
    }

    this.logs.unshift(fullEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }
    this.notify()
  }
}

export const networkLogger = new NetworkLoggerService()
