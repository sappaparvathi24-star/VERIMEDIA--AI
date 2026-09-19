import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

export function Nav() {
  const { health, stats, setShowHeroOverlay, setShowMonitoringModal } = useStore()

  const STAT_DESCRIPTIONS: Record<string, string> = {
    Scans: 'Total media scans executed across all monitored platforms',
    Threats: 'Tampered, deepfake, or adversarial manipulations identified',
    DMCA: 'Automated copyright takedown notices generated and tracked',
    Clean: 'Authenticated original content with un-altered provenance',
  }

  return (
    <nav style={{
      height: 56,
      background: 'linear-gradient(180deg, #0f172a 0%, #0d1117 100%)',
      borderBottom: '1px solid #1e2d3d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      flexShrink: 0,
      zIndex: 50,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Logo */}
      <Tooltip content="VeriMedia AI Engine v23 · Active Provenance & Forensic Mesh" position="bottom">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setShowHeroOverlay(true)}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(14,165,233,0.1) 100%)',
            border: '1.5px solid #00d4ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            boxShadow: '0 0 12px rgba(0, 212, 255, 0.25)'
          }}>🛡️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Veri<span style={{ color: '#00d4ff' }}>Media</span> AI
              </span>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                padding: '1px 5px', borderRadius: 4,
                letterSpacing: '0.05em'
              }}>v23</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
              Deepfake & Provenance Mesh
            </div>
          </div>
        </div>
      </Tooltip>

      {/* Status indicator */}
      <div style={{ height: 20, width: 1, background: '#1e2d3d', margin: '0 4px' }} />

      <Tooltip
        content={health ? 'Backend Health: Operational · Database & 5 Discovery Adapters Connected' : 'Connecting to Unified Engine...'}
        position="bottom"
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: health ? 'rgba(34, 197, 94, 0.08)' : 'rgba(100, 116, 139, 0.1)',
          border: `1px solid ${health ? 'rgba(34, 197, 94, 0.25)' : '#1e2d3d'}`,
          padding: '4px 10px', borderRadius: 20,
          cursor: 'default'
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: health ? '#22c55e' : '#64748b',
            boxShadow: health ? '0 0 8px #22c55e' : 'none',
            animation: health ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, color: health ? '#4ade80' : '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>
            {health ? 'SYSTEM OPERATIONAL' : 'CONNECTING...'}
          </span>
        </div>
      </Tooltip>

      <div style={{ flex: 1 }} />

      {/* Quick stats pills */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {[
          { label: 'Scans', value: stats.total, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
          { label: 'Threats', value: stats.threats, color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
          { label: 'DMCA', value: stats.dmca, color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
          { label: 'Clean', value: stats.clean, color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
        ].map(s => (
          <Tooltip key={s.label} content={STAT_DESCRIPTIONS[s.label]} position="bottom">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: s.bg, border: `1px solid ${s.color}25`,
              padding: '4px 12px', borderRadius: 6,
              cursor: 'default'
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                {s.value}
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                {s.label}
              </span>
            </div>
          </Tooltip>
        ))}
      </div>

      <div style={{ height: 20, width: 1, background: '#1e2d3d', margin: '0 4px' }} />

      {/* Action buttons */}
      <Tooltip content="Manage automated platform monitoring & alert scan jobs" position="bottom">
        <button
          onClick={() => setShowMonitoringModal(true)}
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #334155',
            color: '#cbd5e1',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s'
          }}
          className="hover:border-slate-400 hover:text-white"
        >
          <span>📡</span> Monitoring Jobs
        </button>
      </Tooltip>

      <Tooltip content="View platform capabilities, architecture & detection matrix" position="bottom">
        <button
          onClick={() => setShowHeroOverlay(true)}
          style={{
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: '#38bdf8',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s'
          }}
        >
          <span>ℹ️</span> Showcase Info
        </button>
      </Tooltip>
    </nav>
  )
}
