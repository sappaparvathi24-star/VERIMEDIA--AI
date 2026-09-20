// VeriMedia AI — Zustand Global Store
import { create } from 'zustand'
import type {
  DetectionResult, CaseRecord, HealthStatus,
  ScanStats, TabId,
} from '../types'
import { DEFAULT_SHOWCASE_RESULT, SAMPLE_CASES } from './initialData'

interface AppState {
  // Detection
  results: DetectionResult[]
  currentResult: DetectionResult | null
  isScanning: boolean
  scanError: string | null

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
  setCurrentResult: (r: DetectionResult) => void
  addResult: (r: DetectionResult) => void
  setScanning: (v: boolean) => void
  setScanError: (e: string | null) => void
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
  setScanning: (v) => set({ isScanning: v }),
  setScanError: (e) => set({ scanError: e }),
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
