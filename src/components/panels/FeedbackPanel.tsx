import { useStore } from '../../store'
import type { DetectionResult } from '../../types'

const DECISION_COLOR: Record<string, string> = {
  'ALLOW':             '#22c55e',
  'ATTRIBUTION':       '#f59e0b',
  'REVIEW REQUIRED':   '#6366f1',
  'SUSPECT':           '#f97316',
  'TAKEDOWN':          '#ef4444',
  'EMERGENCY_TAKEDOWN':'#dc2626',
}

const PLATFORM_ICON: Record<string, string> = {
  'YouTube':   '▶',
  'Instagram': '◈',
  'TikTok':   '♬',
  'X / Twitter':'𝕏',
  'Facebook':  'ⓕ',
  'Reddit':    'ʀ',
}

function FeedItem({ result, onClick }: { result: DetectionResult; onClick: () => void }) {
  const dc = DECISION_COLOR[result.ai_analysis.decision] || '#8899aa'
  const simPct = Math.round(result.similarity * 100)
  const isEmergency = result.ai_analysis.decision === 'EMERGENCY_TAKEDOWN'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid #1e2d3d',
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: isEmergency ? 'rgba(220,38,38,0.05)' : 'transparent',
        animation: isEmergency ? 'emergency-flash 1.5s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = isEmergency ? 'rgba(220,38,38,0.05)' : 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {/* Platform icon */}
        <span style={{ fontSize: 12, color: '#00d4ff', width: 16, textAlign: 'center' }}>
          {PLATFORM_ICON[result.platform] || '○'}
        </span>

        {/* Decision badge */}
        <span style={{
          padding: '2px 6px', borderRadius: 3,
          background: `${dc}18`, color: dc,
          fontSize: 9, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
          flexShrink: 0,
        }}>
          {result.ai_analysis.decision}
        </span>

        {/* Username */}
        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          @{result.username}
        </span>

        {/* Similarity */}
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: simPct >= 80 ? '#ef4444' : simPct >= 60 ? '#f59e0b' : '#22c55e', flexShrink: 0 }}>
          {simPct}%
        </span>
      </div>

      {/* Caption */}
      <div style={{
        fontSize: 11, color: '#8899aa', marginLeft: 24,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 4,
      }}>
        {result.caption || '(no caption)'}
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', gap: 10, marginLeft: 24, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#4a5568', fontFamily: 'monospace' }}>
          {result.ml.label}
        </span>
        <span style={{ fontSize: 10, color: '#4a5568' }}>·</span>
        <span style={{ fontSize: 10, color: '#4a5568' }}>{result.content_type}</span>
        <span style={{ fontSize: 10, color: '#4a5568' }}>·</span>
        <span style={{ fontSize: 10, color: '#4a5568', fontFamily: 'monospace' }}>
          {result.processing_ms.toFixed(0)}ms
        </span>
        {result.case_id && (
          <>
            <span style={{ fontSize: 10, color: '#4a5568' }}>·</span>
            <span style={{ fontSize: 10, color: '#ef4444', fontFamily: 'monospace' }}>
              {result.case_id}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function FeedPanel() {
  const { results, setCurrentResult, setShowEvidenceModal } = useStore()

  function handleClick(r: DetectionResult) {
    setCurrentResult(r)
    setShowEvidenceModal(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live Detection Feed
          </span>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4a5568' }}>
          {results.length} events
        </span>
      </div>

      {/* Feed items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#4a5568', gap: 10,
          }}>
            <div style={{ fontSize: 32 }}>🔍</div>
            <p style={{ fontSize: 12 }}>No detections yet</p>
            <p style={{ fontSize: 11 }}>Run a detection above to start</p>
          </div>
        ) : (
          results.map(r => (
            <FeedItem key={r.job_id} result={r} onClick={() => handleClick(r)} />
          ))
        )}
      </div>
    </div>
  )
}
