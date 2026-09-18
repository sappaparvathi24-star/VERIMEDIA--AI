import { useEffect } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import type { CaseRecord } from '../../types'

const SEV_COLOR: Record<string, string> = {
  LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626',
}
const DEC_COLOR: Record<string, string> = {
  'ALLOW': '#22c55e', 'ATTRIBUTION': '#f59e0b', 'REVIEW REQUIRED': '#6366f1',
  'SUSPECT': '#f97316', 'TAKEDOWN': '#ef4444', 'EMERGENCY_TAKEDOWN': '#dc2626',
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: '#f59e0b', under_review: '#6366f1',
    dmca_filed: '#ef4444', resolved: '#22c55e', closed: '#4a5568',
  }
  const c = colors[status] || '#8899aa'
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 3,
      background: `${c}18`, color: c,
      fontSize: 9, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function CasesPanel() {
  const { cases, casesLoading } = useStore()
  const { refreshCases } = useDetection()

  useEffect(() => { refreshCases() }, [refreshCases])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Enforcement Cases ({cases.length})
        </span>
        <button className="vm-btn vm-btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }} onClick={refreshCases}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {casesLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568' }}>
            <span style={{ animation: 'spin-slow 1s linear infinite', marginRight: 8 }}>◌</span> Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568', gap: 8 }}>
            <div style={{ fontSize: 28 }}>📂</div>
            <p style={{ fontSize: 12 }}>No enforcement cases</p>
            <p style={{ fontSize: 11 }}>Cases are auto-created when TAKEDOWN decisions are made</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d3d' }}>
                {['Case ID', 'Platform', 'Account', 'Decision', 'Severity', 'Status', 'DMCA'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    color: '#8899aa', fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    fontWeight: 600,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c: CaseRecord) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid #1a2535',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#00d4ff', fontSize: 10 }}>
                    {c.case_id}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#8899aa' }}>{c.platform}</td>
                  <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>@{c.username}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ color: DEC_COLOR[c.decision] || '#8899aa', fontWeight: 700, fontFamily: 'monospace', fontSize: 10 }}>
                      {c.decision}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ color: SEV_COLOR[c.severity] || '#8899aa', fontWeight: 700 }}>
                      {c.severity}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      color: c.dmca_filed ? '#ef4444' : '#4a5568',
                      fontSize: 12,
                    }}>
                      {c.dmca_filed ? '✓' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
