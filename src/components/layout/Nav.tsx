import { useStore } from '../../store'

export function Nav() {
  const { health, stats } = useStore()

  return (
    <nav style={{
      height: 52,
      background: '#0d1117',
      borderBottom: '1px solid #1e2d3d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00d4ff22, #0ea5e922)',
          border: '1.5px solid #00d4ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>🛡️</div>
        <div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#00d4ff', letterSpacing: '-0.01em' }}>
            VeriMedia
          </span>
          <span style={{
            marginLeft: 6, fontSize: 9, fontFamily: 'monospace',
            color: '#4a5568', letterSpacing: '0.15em',
          }}>v23</span>
        </div>
      </div>

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: health ? '#22c55e' : '#4a5568',
          boxShadow: health ? '0 0 6px #22c55e' : 'none',
          animation: health ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 10, color: '#8899aa', fontFamily: 'monospace' }}>
          {health ? 'OPERATIONAL' : 'CONNECTING'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { label: 'Scans', value: stats.total,   color: '#00d4ff' },
          { label: 'Threats', value: stats.threats, color: '#ef4444' },
          { label: 'DMCA',    value: stats.dmca,    color: '#f97316' },
          { label: 'Clean',   value: stats.clean,   color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* AI source */}
      {health && (
        <div style={{
          padding: '4px 10px', borderRadius: 4,
          background: health.services?.claude_ai === 'enabled'
            ? 'rgba(168,85,247,0.1)' : 'rgba(74,85,104,0.2)',
          border: `1px solid ${health.services?.claude_ai === 'enabled' ? '#a855f7' : '#4a5568'}`,
        }}>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
            color: health.services?.claude_ai === 'enabled' ? '#a855f7' : '#4a5568',
          }}>
            {health.services?.claude_ai === 'enabled' ? '✦ Claude AI' : '⚠ Fallback Mode'}
          </span>
        </div>
      )}
    </nav>
  )
}
