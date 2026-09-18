import { useStore } from '../../store'

interface NavProps {
  currentTab?: string
  onTabChange?: (tab: string) => void
}

export function Nav({ currentTab = 'investigations', onTabChange }: NavProps) {
  const { health } = useStore()

  return (
    <nav style={{
      height: 56,
      background: '#0d1117',
      borderBottom: '1px solid #1e2d3d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 20,
      flexShrink: 0,
    }}>
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
          border: '1px solid #38bdf8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 0 12px rgba(56,189,248,0.2)'
        }}>🔍</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f6fc', letterSpacing: '-0.01em' }}>
              VeriMedia AI
            </span>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
              padding: '2px 6px', borderRadius: 4,
              background: '#161b22', border: '1px solid #30363d', color: '#38bdf8'
            }}>PROVENANCE & FORENSICS</span>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: '0.02em' }}>
            Media Provenance, Integrity & Investigation
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: health ? '#22c55e' : '#4a5568',
          boxShadow: health ? '0 0 6px #22c55e' : 'none',
        }} />
        <span style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace' }}>
          {health ? 'OPERATIONAL' : 'CONNECTING'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Main Navigation Tabs */}
      {onTabChange && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onTabChange('investigations')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              background: currentTab === 'investigations' ? 'rgba(56,189,248,0.12)' : 'transparent',
              color: currentTab === 'investigations' ? '#38bdf8' : '#8b949e',
              border: `1px solid ${currentTab === 'investigations' ? '#38bdf8' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>📋</span> Investigations
          </button>
          <button
            onClick={() => onTabChange('demo')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              background: currentTab === 'demo' ? 'rgba(168,85,247,0.12)' : 'transparent',
              color: currentTab === 'demo' ? '#c084fc' : '#8b949e',
              border: `1px solid ${currentTab === 'demo' ? '#c084fc' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>⚡</span> Explore Demo Scenarios
          </button>
          <button
            onClick={() => onTabChange('system')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              background: currentTab === 'system' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: currentTab === 'system' ? '#f0f6fc' : '#8b949e',
              border: `1px solid ${currentTab === 'system' ? '#30363d' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>⚙️</span> System
          </button>
        </div>
      )}
    </nav>
  )
}

