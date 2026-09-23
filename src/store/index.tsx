// VeriMedia AI — Zustand Global Store
import { create } from 'zustand'
import type {
  DetectionResult, CaseRecord, HealthStatus,
  ScanStats, TabId, ForensicStageItem, ForensicStageStatus, ScanLogEntry,
  VerificationJobHistoryItem
} from '../types'
import type { ClaimVerificationResult } from '../services/api'
import { listInvestigations, getInvestigationDetails } from '../services/api'
import { DEFAULT_FORENSIC_STAGES, INITIAL_VERIFICATION_JOBS } from './initialData'

export function buildDetectionResultFromInvestigation(inv: any): DetectionResult {
  if (inv.detectionResult) {
    return inv.detectionResult
  }
  if (inv.metadata?.detectionResult) {
    return inv.metadata.detectionResult
  }

  const art = inv.artifacts?.[0] || inv.primaryArtifact || null
  const trustScore = inv.trustScore ?? (inv.metadata?.trustScore ?? (inv.forensicConfidence != null ? Math.round(inv.forensicConfidence * 100) : 85))
  const isThreat = inv.decision === 'TAKEDOWN' || inv.decision === 'EMERGENCY_TAKEDOWN' || inv.metadata?.priority === 'HIGH'
  const decision = (inv.decision || inv.metadata?.decision || (isThreat ? 'TAKEDOWN' : 'REVIEW REQUIRED'))

  return {
    job_id: inv.id,
    platform: (inv.metadata?.platform || 'YouTube') as any,
    username: inv.metadata?.username || 'analyst',
    caption: inv.title || 'Archived Investigation',
    content_type: (inv.metadata?.contentType || 'news') as any,
    scenario: inv.isDemo ? 'demo_scenario' : 'real_pipeline',
    similarity: Number((inv.metadata?.forensicConfidence || inv.forensicConfidence || 0.85).toFixed(2)),
    fingerprint_hash: inv.sha256 ? inv.sha256.slice(0, 16) : (art?.sha256 ? art.sha256.slice(0, 16) : '0'.repeat(16)),
    timestamp: inv.createdAt || new Date().toISOString(),
    case_id: inv.id,
    investigationId: inv.id,
    processing_ms: 120,
    is_demo: Boolean(inv.isDemo),
    mode: inv.isDemo ? 'DEMO_SCENARIO' : 'PERSISTED_INVESTIGATION',
    disclaimer: inv.demoNotice || null,
    artifact: {
      id: art?.id || inv.id,
      filename: inv.filename || art?.filename || inv.title,
      sha256: inv.sha256 || art?.sha256 || null,
      perceptualHash: art?.perceptualHash || null,
      dimensions: art?.dimensions || null,
      byteSize: art?.byteSize || 0,
      mimeType: art?.mimeType || 'image/jpeg',
      fileUrl: art?.id ? `/api/artifacts/${art.id}/file` : '',
      previewUrl: art?.id ? `/api/artifacts/${art.id}/file` : '',
      dataUrl: art?.metadata?.dataUrl || null,
      rawExif: art?.metadata?.exif || null
    },
    ml: {
      label: isThreat ? 'TAMPERED' : 'SAFE',
      trust_score: trustScore,
      confidence: inv.forensicConfidence || 0.85,
      signals: {}
    },
    integrity: {
      score: trustScore / 100,
      flags: [],
      signals: {}
    },
    trust: {
      trust_score: trustScore,
      risk_tier: isThreat ? 'high_risk' : (trustScore >= 70 ? 'safe' : 'suspect'),
      verdict: inv.metadata?.verdict || `Persisted Case Status: ${inv.status}`,
      factors: {
        perceptual_match: inv.forensicConfidence || 0.85,
        forensic_integrity: trustScore / 100
      }
    },
    ai_analysis: {
      threat_type: isThreat ? 'Infringement / Synthetic Manipulation' : 'General Analysis',
      decision: decision as any,
      severity: isThreat ? 'HIGH' : 'LOW',
      risk_label: isThreat ? 'HIGH_RISK' : 'SAFE',
      confidence: inv.forensicConfidence || 0.85,
      reasoning_points: [
        `Case ID: ${inv.id}`,
        `Current Status: ${inv.status}`,
        inv.description || `Persisted forensic ledger record with ${inv.artifactCount || 1} registered media artifact(s).`
      ],
      action: isThreat ? 'Submit DMCA takedown' : 'No enforcement action required',
      recommended_action: isThreat ? 'File expedited takedown notice' : 'Retain in archive',
      origin_traced: true,
      dmca_needed: isThreat,
      source: 'fallback'
    },
    forensics: {
      status: 'COMPLETED',
      authenticity: isThreat ? 'MANIPULATED' : 'AUTHENTIC',
      trustScore,
      verdict: `Persisted Case: ${inv.status}`
    }
  }
}

interface AppState {
  // Detection & Forensic Scan
  results: DetectionResult[]
  currentResult: DetectionResult | null
  isScanning: boolean
  scanError: string | null

  // Claim & Media Headline Verification
  showClaimModal: boolean
  claimInitialQuery: string
  claimResult: ClaimVerificationResult | null
  claimLoading: boolean
  claimError: string | null

  // Search-Grounded Verification Session History & Analytics
  verificationHistory: VerificationJobHistoryItem[]
  selectedVerificationJobId: string | null
  showVerificationHistoryDrawer: boolean
  activeHistoryTab: 'stream' | 'recharts'

  // Real-time Forensic Module Progress & Telemetry
  scanProgress: number
  scanStageIndex: number
  scanStageKey: string
  scanStageTitle: string
  scanStageDetail: string
  scanStages: ForensicStageItem[]
  scanLogs: ScanLogEntry[]
  scanStartTime: number | null
  scanElapsedSeconds: number
  activeJobId: string | null
  showGlobalProgressDrawer: boolean

  // Cases
  cases: CaseRecord[]
  casesLoading: boolean
  // Set when the real /api/v1/cases fetch fails, so the UI can show an honest
  // error instead of silently displaying stale or placeholder case data.
  casesError: string | null

  // Persistent Investigations Ledger
  investigations: any[]
  investigationsLoading: boolean
  investigationsError: string | null
  fetchInvestigations: () => Promise<any[]>
  loadInvestigationIntoDashboard: (invIdOrObj: any) => Promise<void>

  // Health
  health: HealthStatus | null

  // UI
  activeTab: TabId
  showEvidenceModal: boolean
  showDMCAModal: boolean
  showMonitoringModal: boolean
  showHeroOverlay: boolean
  showCommandPalette: boolean
  selectedCaseId: string | null

  // Stats
  stats: ScanStats

  // Actions
  setCurrentResult: (r: DetectionResult | null) => void
  addResult: (r: DetectionResult) => void
  setScanning: (v: boolean) => void
  setScanError: (e: string | null) => void
  setScanProgress: (progress: number, stageIndex?: number, title?: string, detail?: string) => void
  setScanStageStatus: (stageKey: string, status: ForensicStageStatus, detail?: string, metrics?: Record<string, any>) => void
  addScanLog: (message: string, stage?: string, level?: 'info' | 'success' | 'warn' | 'error') => void
  resetScanProgress: () => void
  setActiveJobId: (id: string | null) => void
  setShowGlobalProgressDrawer: (v: boolean) => void
  setCases: (c: CaseRecord[]) => void
  setCasesLoading: (v: boolean) => void
  setCasesError: (e: string | null) => void
  setHealth: (h: HealthStatus) => void
  setActiveTab: (t: TabId) => void
  setShowEvidenceModal: (v: boolean) => void
  setShowDMCAModal: (v: boolean) => void
  setShowMonitoringModal: (v: boolean) => void
  setShowHeroOverlay: (v: boolean) => void
  setShowCommandPalette: (v: boolean) => void
  openClaimModal: (query?: string) => void
  closeClaimModal: () => void
  setClaimResult: (res: ClaimVerificationResult | null) => void
  setClaimLoading: (loading: boolean) => void
  setClaimError: (err: string | null) => void
  setSelectedCaseId: (id: string | null) => void
  updateStats: (r: DetectionResult) => void
  clearResults: () => void

  // Verification History Actions
  addVerificationJob: (job: VerificationJobHistoryItem) => void
  updateVerificationJob: (id: string, updates: Partial<VerificationJobHistoryItem>) => void
  setSelectedVerificationJobId: (id: string | null) => void
  toggleVerificationHistoryDrawer: (force?: boolean) => void
  setShowVerificationHistoryDrawer: (v: boolean) => void
  setActiveHistoryTab: (tab: 'stream' | 'recharts') => void
  clearVerificationHistory: () => void
}

export const useStore = create<AppState>((set, get) => ({
  results: [],
  currentResult: null,
  isScanning: false,
  scanError: null,

  // Verification History Defaults
  verificationHistory: INITIAL_VERIFICATION_JOBS,
  selectedVerificationJobId: INITIAL_VERIFICATION_JOBS[0]?.id || null,
  showVerificationHistoryDrawer: false,
  activeHistoryTab: 'stream',

  // Forensic progress defaults
  scanProgress: 0,
  scanStageIndex: 0,
  scanStageKey: 'ingest',
  scanStageTitle: 'Initializing Analysis Pipeline',
  scanStageDetail: 'Ready for media submission',
  scanStages: DEFAULT_FORENSIC_STAGES.map(s => ({ ...s, status: 'PENDING' })),
  scanLogs: [],
  scanStartTime: null,
  scanElapsedSeconds: 0,
  activeJobId: null,
  showGlobalProgressDrawer: false,

  cases: [],
  casesLoading: false,
  casesError: null,

  // Persistent Investigations Ledger State
  investigations: [],
  investigationsLoading: false,
  investigationsError: null,

  fetchInvestigations: async () => {
    set({ investigationsLoading: true, investigationsError: null })
    try {
      const data = await listInvestigations()
      const invs = Array.isArray(data) ? data : []
      set({ investigations: invs, investigationsLoading: false })

      // If results feed is empty, populate from real investigations
      const currentResults = get().results
      if (currentResults.length === 0 && invs.length > 0) {
        const mappedResults: DetectionResult[] = invs
          .map(inv => buildDetectionResultFromInvestigation(inv))
          .filter(Boolean)
        set({ results: mappedResults })
      }
      return invs
    } catch (err: any) {
      console.warn('[Store] Failed to load investigations:', err.message)
      set({ investigationsLoading: false, investigationsError: err.message || 'Failed to load investigations' })
      return []
    }
  },

  loadInvestigationIntoDashboard: async (invIdOrObj: any) => {
    try {
      let inv = typeof invIdOrObj === 'object' && invIdOrObj !== null ? invIdOrObj : null
      const id = typeof invIdOrObj === 'string' ? invIdOrObj : inv?.id
      if (id && (!inv || !inv.metadata?.detectionResult)) {
        try {
          const detailed = await getInvestigationDetails(id)
          if (detailed) inv = detailed
        } catch (_) {}
      }
      if (!inv && id) {
        inv = get().investigations.find((i: any) => i.id === id)
      }
      if (!inv) return

      const detResult = buildDetectionResultFromInvestigation(inv)
      set({
        currentResult: detResult,
        activeTab: 'scanner',
        showVerificationHistoryDrawer: false,
        selectedCaseId: inv.id
      })
      // Ensure it is in results feed
      set(s => {
        const exists = s.results.some(r => r.job_id === detResult.job_id || r.investigationId === inv.id)
        if (!exists) {
          return { results: [detResult, ...s.results] }
        }
        return {}
      })
    } catch (e) {
      console.error('[Store] Failed to load investigation into dashboard:', e)
    }
  },

  health: null,
  activeTab: 'scanner',
  showEvidenceModal: false,
  showDMCAModal: false,
  showMonitoringModal: false,
  showHeroOverlay: false,
  showCommandPalette: false,
  showClaimModal: false,
  claimInitialQuery: '',
  claimResult: null,
  claimLoading: false,
  claimError: null,
  selectedCaseId: null,
  stats: { total: 0, threats: 0, dmca: 0, clean: 0 },

  setCurrentResult: (r) => set({ currentResult: r }),
  addResult: (r) => {
    set(s => ({ results: [r, ...s.results].slice(0, 200) }))
    // Sync with persistent backend investigations ledger
    get().fetchInvestigations().catch(() => {})
  },
  setScanning: (v) => set(s => {
    if (v) {
      return {
        isScanning: true,
        scanStartTime: Date.now(),
        scanElapsedSeconds: 0,
        scanProgress: 5,
        scanStageIndex: 0,
        scanStageKey: 'ingest',
        scanStageTitle: 'Stage 1: Ingest & Fingerprinting',
        scanStageDetail: 'Extracting SHA-256 bitstream and computing 64-bit perceptual hash...',
        scanStages: DEFAULT_FORENSIC_STAGES.map((st, idx) => ({
          ...st,
          status: idx === 0 ? 'RUNNING' : 'PENDING',
          detail: undefined,
          durationMs: undefined,
          metrics: undefined
        })),
        scanLogs: [{
          id: `log-${Date.now()}-0`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          stage: 'ingest',
          message: 'Forensic scan pipeline initiated. Ingesting media bitstream...'
        }]
      }
    }
    return { isScanning: false }
  }),
  setScanError: (e) => set({ scanError: e }),

  setScanProgress: (progress, stageIndex, title, detail) => set(s => {
    const updatedStages = [...s.scanStages]
    const resolvedIndex = stageIndex !== undefined ? stageIndex : s.scanStageIndex

    updatedStages.forEach((st, idx) => {
      if (idx < resolvedIndex) {
        st.status = 'COMPLETED'
      } else if (idx === resolvedIndex) {
        st.status = progress >= 100 ? 'COMPLETED' : 'RUNNING'
        if (detail) st.detail = detail
      } else {
        if (st.status === 'RUNNING') st.status = 'PENDING'
      }
    })

    const activeStage = updatedStages[resolvedIndex] || updatedStages[0]

    return {
      scanProgress: Math.min(100, Math.max(0, progress)),
      scanStageIndex: resolvedIndex,
      scanStageKey: activeStage?.key || s.scanStageKey,
      scanStageTitle: title || activeStage?.label || s.scanStageTitle,
      scanStageDetail: detail || activeStage?.description || s.scanStageDetail,
      scanStages: updatedStages
    }
  }),

  setScanStageStatus: (stageKey, status, detail, metrics) => set(s => {
    const updatedStages = s.scanStages.map(st => {
      if (st.key === stageKey) {
        return {
          ...st,
          status,
          detail: detail !== undefined ? detail : st.detail,
          metrics: metrics !== undefined ? { ...(st.metrics || {}), ...metrics } : st.metrics
        }
      }
      return st
    })
    return { scanStages: updatedStages }
  }),

  addScanLog: (message, stage = 'pipeline', level = 'info') => set(s => ({
    scanLogs: [
      ...s.scanLogs.slice(-150),
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        stage,
        message
      }
    ]
  })),

  resetScanProgress: () => set({
    scanProgress: 0,
    scanStageIndex: 0,
    scanStageKey: 'ingest',
    scanStageTitle: 'Initializing Analysis Pipeline',
    scanStageDetail: 'Ready for media submission',
    scanStages: DEFAULT_FORENSIC_STAGES.map(s => ({ ...s, status: 'PENDING' })),
    scanLogs: [],
    scanStartTime: null,
    scanElapsedSeconds: 0,
    activeJobId: null
  }),

  setActiveJobId: (id) => set({ activeJobId: id }),
  setShowGlobalProgressDrawer: (v) => set({ showGlobalProgressDrawer: v }),

  setCases: (c) => set({ cases: c }),
  setCasesLoading: (v) => set({ casesLoading: v }),
  setCasesError: (e: string | null) => set({ casesError: e }),
  setHealth: (h) => set({ health: h }),
  setActiveTab: (t) => set({ activeTab: t }),
  setShowEvidenceModal: (v) => set({ showEvidenceModal: v }),
  setShowDMCAModal: (v) => set({ showDMCAModal: v }),
  setShowMonitoringModal: (v) => set({ showMonitoringModal: v }),
  setShowHeroOverlay: (v) => set({ showHeroOverlay: v }),
  setShowCommandPalette: (v) => set({ showCommandPalette: v }),
  openClaimModal: (query = '') => set({ showClaimModal: true, claimInitialQuery: query }),
  closeClaimModal: () => set({ showClaimModal: false }),
  setClaimResult: (res) => set({ claimResult: res }),
  setClaimLoading: (loading) => set({ claimLoading: loading }),
  setClaimError: (err) => set({ claimError: err }),
  setSelectedCaseId: (id) => set({ selectedCaseId: id }),
  updateStats: (r) => set(s => {
    const d = r.ai_analysis.decision
    return {
      stats: {
        total: s.stats.total + 1,
        threats: s.stats.threats + (d === 'TAKEDOWN' || d === 'EMERGENCY_TAKEDOWN' ? 1 : 0),
        dmca: s.stats.dmca + (r.ai_analysis.dmca_needed ? 1 : 0),
        clean: s.stats.clean + (d === 'ALLOW' ? 1 : 0),
      }
    }
  }),
  clearResults: () => set({ results: [], currentResult: null }),

  // Verification History Actions
  addVerificationJob: (job) => set(s => ({
    verificationHistory: [job, ...s.verificationHistory.filter(j => j.id !== job.id)].slice(0, 100),
    selectedVerificationJobId: job.id
  })),
  updateVerificationJob: (id, updates) => set(s => ({
    verificationHistory: s.verificationHistory.map(j => j.id === id ? { ...j, ...updates } : j)
  })),
  setSelectedVerificationJobId: (id) => set({ selectedVerificationJobId: id }),
  toggleVerificationHistoryDrawer: (force) => set(s => ({
    showVerificationHistoryDrawer: force !== undefined ? force : !s.showVerificationHistoryDrawer
  })),
  setShowVerificationHistoryDrawer: (v) => set({ showVerificationHistoryDrawer: v }),
  setActiveHistoryTab: (tab) => set({ activeHistoryTab: tab }),
  clearVerificationHistory: () => set({ verificationHistory: [], selectedVerificationJobId: null }),
}))

