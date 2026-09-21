// VeriMedia AI — Zustand Global Store
import { create } from 'zustand'
import type {
  DetectionResult, CaseRecord, HealthStatus,
  ScanStats, TabId, ForensicStageItem, ForensicStageStatus, ScanLogEntry
} from '../types'
import { DEFAULT_SHOWCASE_RESULT, SAMPLE_CASES, DEFAULT_FORENSIC_STAGES } from './initialData'

interface AppState {
  // Detection & Forensic Scan
  results: DetectionResult[]
  currentResult: DetectionResult | null
  isScanning: boolean
  scanError: string | null

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
  setHealth: (h: HealthStatus) => void
  setActiveTab: (t: TabId) => void
  setShowEvidenceModal: (v: boolean) => void
  setShowDMCAModal: (v: boolean) => void
  setShowMonitoringModal: (v: boolean) => void
  setShowHeroOverlay: (v: boolean) => void
  setShowCommandPalette: (v: boolean) => void
  setSelectedCaseId: (id: string | null) => void
  updateStats: (r: DetectionResult) => void
  clearResults: () => void
}

export const useStore = create<AppState>((set, get) => ({
  results: [],
  currentResult: null,
  isScanning: false,
  scanError: null,

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

  cases: SAMPLE_CASES,
  casesLoading: false,
  health: null,
  activeTab: 'scanner',
  showEvidenceModal: false,
  showDMCAModal: false,
  showMonitoringModal: false,
  showHeroOverlay: false,
  showCommandPalette: false,
  selectedCaseId: null,
  stats: { total: 0, threats: 0, dmca: 0, clean: 0 },

  setCurrentResult: (r) => set({ currentResult: r }),
  addResult: (r) => set(s => ({ results: [r, ...s.results].slice(0, 200) })),
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
  setHealth: (h) => set({ health: h }),
  setActiveTab: (t) => set({ activeTab: t }),
  setShowEvidenceModal: (v) => set({ showEvidenceModal: v }),
  setShowDMCAModal: (v) => set({ showDMCAModal: v }),
  setShowMonitoringModal: (v) => set({ showMonitoringModal: v }),
  setShowHeroOverlay: (v) => set({ showHeroOverlay: v }),
  setShowCommandPalette: (v) => set({ showCommandPalette: v }),
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
}))

