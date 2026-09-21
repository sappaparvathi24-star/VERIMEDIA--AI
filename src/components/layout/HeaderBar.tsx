import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'
import type { TabId } from '../../types'

const PAGE_TITLES: Record<TabId, { title: string; subtitle: string; icon: string }> = {
  scanner: {
    title: 'Media Scanner',
    subtitle: 'Upload media, audio, or test scenarios for instant analysis',
    icon: '⚡'
  },
  forensic: {
    title: 'Engine 1 — Media Forensics',
    subtitle: 'Multi-signal deepfake detection, ELA & sensor analysis',
    icon: '🔬'
  },
  discovery: {
    title: 'Engine 2 — Discovery Intelligence',
    subtitle: 'Multi-platform search & normalized candidate ingestion',
    icon: '🌐'
  },
  origin: {
    title: 'Engine 3 — Provenance & Origin',
    subtitle: 'Earliest source attribution & transformation lineage',
    icon: '🌳'
  },
  propagation: {
    title: 'Engine 4 — Propagation Intelligence',
    subtitle: 'Viral spread velocity & multi-platform cascade graph',
    icon: '📡'
  },
  reasoning: {
    title: 'Engine 5 — Evidence Reasoning',
    subtitle: 'Calibrated confidence scores & explainable signal weights',
    icon: '⚖️'
  },
  cases: {
    title: 'DMCA & Enforcement Cases',
    subtitle: 'Enforcement tracking & automated infringement notices',
    icon: '📋'
  },
  trends: {
    title: 'Threat Trends & Analytics',
    subtitle: 'Platform threat rates, volume distribution & metrics',
    icon: '📈'
  },
  system: {
    title: 'System & Ingestion Jobs',
    subtitle: 'Backend health, DB sync & provider status',
    icon: '⚙️'
  },
  feed: {
    title: 'Live Media Stream',
    subtitle: 'Real-time platform detection logs & alerts',
    icon: '📡'
  },
  intelligence: {
    title: 'VeriMedia AI Assistant',
    subtitle: 'Multimodal reasoning, automated forensic dossiers & technical explainer',
    icon: '✨'
  },
  review: {
    title: 'Human Review',
    subtitle: 'AI assists the investigation; the investigator makes the final decision',
    icon: '🧑‍⚖️'
  },
  debug: {
    title: 'API Network Traffic & Backend Fidelity Inspector',
    subtitle: 'Real-time HTTP traffic debugger, binary forensic verification & cURL inspector',
    icon: '🪲'
  }
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  Scans: 'Total media scans executed across all monitored platforms',
  Threats: 'Manipulated or deepfake media flagged for takedown',
  DMCA: 'Formal legal copyright notices dispatched to platform legal desks',
  Clean: 'Authentic content verified with intact perceptual signatures',
}

export function HeaderBar() {
  const { activeTab, stats, health, currentResult, setCurrentResult, setActiveTab, setShowHeroOverlay, setShowMonitoringModal, setShowCommandPalette, setShowEvidenceModal } = useStore()

  const current = PAGE_TITLES[activeTab] || PAGE_TITLES.scanner

  return (
    <header style={{
      height: 60,
      background: 'linear-gradient(180deg, #0d1117 0%, #090d12 100%)',
      borderBottom: '1px solid #1e2d3d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
      zIndex: 30
    }}>
      {/* Left: Active Workspace Title & Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 280 }}>
        <div style={{
          fontSize: 20,
          width: 38,
          height: 38,
          borderRadius: 8,
          background: 'rgba(0, 212, 255, 0.08)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {current.icon}
        </div>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {current.title}
          </h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontWeight: 500, lineHeight: 1.2 }}>
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Center: Command Palette Search Bar */}
      <Tooltip content="Global Command Palette: Search investigations, trigger workflows or create cases (Ctrl+K)" position="bottom">
        <button
          onClick={() => setShowCommandPalette(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #1e2d3d',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#64748b',
            fontSize: 12,
            cursor: 'pointer',
            minWidth: 280,
            justifyContent: 'space-between',
            transition: 'all 0.15s'
          }}
          className="hover:border-cyan-500/40 hover:text-slate-300"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#00d4ff' }}>🔍</span>
            <span>Search forensic scans or commands...</span>
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#38bdf8',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            padding: '2px 6px',
            borderRadius: 4
          }}>
            ⌘K
          </span>
        </button>
      </Tooltip>

      {/* Right: Quick Operational Counters & Live Health */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Metric Tickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(13, 17, 23, 0.6)', padding: '4px 12px', borderRadius: 8, border: '1px solid #1e2d3d' }}>
          {[
            { label: 'Scans', val: stats?.total || 0, color: '#00d4ff' },
            { label: 'Threats', val: stats?.threats || 0, color: '#ef4444' },
            { label: 'DMCA', val: stats?.dmca || 0, color: '#f59e0b' },
          ].map(s => (
            <Tooltip key={s.label} content={STAT_DESCRIPTIONS[s.label]} position="bottom">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace' }}>{s.label}:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.val}</span>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Check Another Image Button */}
        <Tooltip content="Upload and analyze another image or media asset" position="bottom">
          <button
            onClick={() => {
              setCurrentResult(null)
              setActiveTab('scanner')
              setShowEvidenceModal(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #00d4ff 0%, #0077ff 100%)',
              border: 'none',
              padding: '6px 13px',
              borderRadius: 6,
              color: '#040d1a',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(0, 212, 255, 0.4)',
              transition: 'all 0.15s'
            }}
            className="hover:scale-105"
          >
            <span>📷</span>
            <span>Check Another Image</span>
          </button>
        </Tooltip>

        {/* VeriMedia AI Assistant Button */}
        <Tooltip content="VeriMedia AI Assistant: Multimodal Analysis, Executive Dossiers & Technical Explainer" position="bottom">
          <button
            onClick={() => useStore.getState().setActiveTab('intelligence')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              padding: '6px 12px',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)'
            }}
            className="hover:scale-105"
          >
            <span>✨</span>
            <span>Gemini AI</span>
          </button>
        </Tooltip>

        {/* Live Monitoring Modal Trigger */}
        <Tooltip content="Live Platform Ingestion Jobs & Discovery Scheduler" position="bottom">
          <button
            onClick={() => setShowMonitoringModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: 6,
              color: '#cbd5e1',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            className="hover:border-slate-400 hover:text-white"
          >
            <span>📡</span>
            <span>Jobs</span>
          </button>
        </Tooltip>

        {/* Backend Status Indicator */}
        <Tooltip content="5-Engine VeriMedia Engine API: Nominal Operational Status" position="bottom">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            padding: '5px 10px',
            borderRadius: 6,
            cursor: 'default'
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: health?.status === 'ok' ? '#22c55e' : '#eab308',
              boxShadow: health?.status === 'ok' ? '0 0 8px #22c55e' : '0 0 8px #eab308',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>
              ONLINE
            </span>
          </div>
        </Tooltip>

        {/* System Architecture Overview trigger */}
        <Tooltip content="VeriMedia 5-Engine Architecture & Specs" position="bottom">
          <button
            onClick={() => setShowHeroOverlay(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700
            }}
            className="hover:bg-cyan-500/20"
          >
            ⓘ
          </button>
        </Tooltip>
      </div>
    </header>
  )
}
