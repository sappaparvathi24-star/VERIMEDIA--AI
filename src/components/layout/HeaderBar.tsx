import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'
import type { TabId } from '../../types'

const PAGE_TITLES: Record<TabId, { title: string; subtitle: string; icon: string }> = {
  scanner: {
    title: 'Media Scanner & Ingestion Hub',
    subtitle: 'Upload local media artifacts, audio or select synthetic test scenarios for 5-engine deepfake analysis',
    icon: '⚡'
  },
  forensic: {
    title: 'Engine 1 — Media Forensics',
    subtitle: 'Ensemble multi-signal extraction: ELA, PRNU sensor noise, EXIF/C2PA metadata, facial Delaunay mesh & perceptual hashes',
    icon: '🔬'
  },
  discovery: {
    title: 'Engine 2 — Discovery Intelligence',
    subtitle: 'Provider-agnostic discovery orchestrator with normalized platform observation adapters & Sybil defense',
    icon: '🌐'
  },
  origin: {
    title: 'Engine 3 — Provenance & Origin Intelligence',
    subtitle: 'D3 provenance tree, transformation flow & earliest observed source attribution with epistemic certainty demarcations',
    icon: '🌳'
  },
  propagation: {
    title: 'Engine 4 — Propagation Intelligence',
    subtitle: 'Content genealogy graph, viral velocity vectors & multi-platform spread topology',
    icon: '📡'
  },
  reasoning: {
    title: 'Engine 5 — Evidence Reasoning',
    subtitle: 'Explainable AI reasoning dossier, structured confidence calculus & IBM AI governance audit matrix',
    icon: '⚖️'
  },
  cases: {
    title: 'Copyright Cases & DMCA Enforcement',
    subtitle: 'Active takedown claims ledger, automated DMCA notice generator, and platform enforcement tracking',
    icon: '📋'
  },
  trends: {
    title: 'Detection Analytics & Threat Volume',
    subtitle: 'Historical scan distribution, threat rates, platform breakdown, and detection performance trends',
    icon: '📈'
  },
  system: {
    title: 'System Health & Engine Diagnostics',
    subtitle: 'Unified Express backend status, database synchronization, discovery adapters, and background jobs',
    icon: '⚙️'
  },
  feed: {
    title: 'Real-Time Media Ingestion Feed',
    subtitle: 'Live monitored platform event stream and detection logs',
    icon: '📡'
  }
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  Scans: 'Total media scans executed across all monitored platforms',
  Threats: 'Manipulated or deepfake media flagged for takedown',
  DMCA: 'Formal legal copyright notices dispatched to platform legal desks',
  Clean: 'Authentic content verified with intact perceptual signatures',
}

export function HeaderBar() {
  const { activeTab, stats, health, setShowHeroOverlay, setShowMonitoringModal, setShowCommandPalette } = useStore()

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
