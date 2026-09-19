import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

export function Nav() {
  const { health, stats } = useStore()

  const STAT_DESCRIPTIONS: Record<string, string> = {
    Scans: 'Total media scans executed across all monitored platforms',
    Threats: 'Tampered, deepfake, or adversarial manipulations identified',
    DMCA: 'Automated copyright takedown notices generated and tracked',
    Clean: 'Authenticated original content with un-altered provenance',
  }

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
      <Tooltip content="VeriMedia AI Engine v23 · Active Provenance & Forensic Mesh" position="bottom">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8, cursor: 'default' }}>
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
      </Tooltip>

      {/* Status indicator */}
      <Tooltip
        content={health ? 'Backend Health: Operational · Database & 5 Discovery Adapters Connected' : 'Connecting to Unified Engine...'}
        position="bottom"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
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
      </Tooltip>

      <div style={{ flex: 1 }} />

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { label: 'Scans', value: stats.total,   color: '#00d4ff' },
          { label: 'Threats', value: stats.threats, color: '#ef4444' },
          { label: 'DMCA',    value: stats.dmca,    color: '#f97316' },
          { label: 'Clean',   value: stats.clean,   color: '#22c55e' },
        ].map(s => (
          <Tooltip key={s.label} content={STAT_DESCRIPTIONS[s.label]} position="bottom">
            <div style={{ textAlign: 'center', cursor: 'default' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </div>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* AI source */}
      {health && (
        <Tooltip
          content={
            health.services?.claude_ai === 'enabled'
              ? 'Primary AI Engine: Gemini/Claude Multimodal Reasoning & Synthesis'
              : 'Rule-Based Local Fallback Classifier Active'
          }
          position="bottom"
        >
          <div style={{
            padding: '4px 10px', borderRadius: 4,
            background: health.services?.claude_ai === 'enabled'
              ? 'rgba(168,85,247,0.1)' : 'rgba(74,85,104,0.2)',
            border: `1px solid ${health.services?.claude_ai === 'enabled' ? '#a855f7' : '#4a5568'}`,
            cursor: 'default'
          }}>
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
              color: health.services?.claude_ai === 'enabled' ? '#a855f7' : '#4a5568',
            }}>
              {health.services?.claude_ai === 'enabled' ? '✦ Claude AI' : '⚠ Fallback Mode'}
            </span>
          </div>
        </Tooltip>
      )}
    </nav>
  )
}
