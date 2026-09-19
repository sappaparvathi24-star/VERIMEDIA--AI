import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'
import type { TabId } from '../../types'

const PAGE_TITLES: Record<TabId, { title: string; subtitle: string; icon: string }> = {
  scanner: {
    title: 'Media Scanner & Detection Hub',
    subtitle: 'Upload local media artifacts or select synthetic test scenarios for multi-signal ML deepfake classification',
    icon: '⚡'
  },
  propagation: {
    title: 'Viral Propagation Topology Mesh',
    subtitle: 'Cross-platform velocity vectors, node replication, and viral threat containment graph',
    icon: '📡'
  },
  forensic: {
    title: '9-Signal Forensic Matrix & Hashes',
    subtitle: 'Detailed perceptual hashing, noise residual maps, face landmark lipsync, and ML model confidence score breakdown',
    icon: '🔬'
  },
  origin: {
    title: 'Provenance Lineage & Signature Tree',
    subtitle: 'Cryptographic C2PA metadata verification, perceptual tree distance, and origin node attribution',
    icon: '🔗'
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
    subtitle: 'Unified Express backend status, Supabase database synchronization, discovery adapters, and background jobs',
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
            gap: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #1e2d3d',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            minWidth: 240
          }}
          className="hover:border-cyan-500/50 hover:text-slate-200"
        >
          <span style={{ fontSize: 14, color: '#00d4ff' }}>🔍</span>
          <span style={{ flex: 1, textAlign: 'left' }}>Search or command...</span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#38bdf8',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            padding: '1px 6px',
            borderRadius: 4
          }}>
            Ctrl+K
          </span>
        </button>
      </Tooltip>

      {/* Right Side: Quick Stats, System Health & User Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Quick stats pills */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { label: 'Scans', value: stats.total, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
            { label: 'Threats', value: stats.threats, color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
            { label: 'DMCA', value: stats.dmca, color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
            { label: 'Clean', value: stats.clean, color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
          ].map(s => (
            <Tooltip key={s.label} content={STAT_DESCRIPTIONS[s.label]} position="bottom">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: s.bg, border: `1px solid ${s.color}25`,
                padding: '4px 8px', borderRadius: 6,
                cursor: 'default'
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                  {s.value}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {s.label}
                </span>
              </div>
            </Tooltip>
          ))}
        </div>

        <div style={{ height: 18, width: 1, background: '#1e2d3d' }} />

        {/* Live Engine Status Badge */}
        <Tooltip content={health ? 'Unified Engine Online · DB & Adapters Synchronized' : 'Connecting to Engine...'} position="bottom">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: health ? 'rgba(34, 197, 94, 0.08)' : 'rgba(100, 116, 139, 0.1)',
            border: `1px solid ${health ? 'rgba(34, 197, 94, 0.25)' : '#1e2d3d'}`,
            padding: '4px 8px', borderRadius: 6,
            cursor: 'default'
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: health ? '#22c55e' : '#64748b',
              boxShadow: health ? '0 0 6px #22c55e' : 'none',
              animation: health ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 9, color: health ? '#4ade80' : '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>
              {health ? 'OPERATIONAL' : 'OFFLINE'}
            </span>
          </div>
        </Tooltip>

        <div style={{ height: 18, width: 1, background: '#1e2d3d' }} />

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip content="Manage automated platform monitoring & alert scan jobs" position="bottom">
            <button
              onClick={() => setShowMonitoringModal(true)}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s'
              }}
              className="hover:border-slate-400 hover:text-white"
            >
              <span>📡</span> Jobs
            </button>
          </Tooltip>

          <Tooltip content="View platform capabilities & architecture showcase" position="bottom">
            <button
              onClick={() => setShowHeroOverlay(true)}
              style={{
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#38bdf8',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s'
              }}
            >
              <span>ℹ️</span> Specs
            </button>
          </Tooltip>
        </div>

        <div style={{ height: 18, width: 1, background: '#1e2d3d' }} />

        {/* User Analyst Profile Badge */}
        <Tooltip content="Logged in as Guest Analyst (Enterprise Tier)" position="bottom">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#090e17',
            border: '1px solid #1e2d3d',
            padding: '3px 8px 3px 4px',
            borderRadius: 20
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#1e293b', border: '1px solid #00d4ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#00d4ff', fontWeight: 800
            }}>
              GA
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
              Analyst
            </span>
          </div>
        </Tooltip>
      </div>
    </header>
  )
}
