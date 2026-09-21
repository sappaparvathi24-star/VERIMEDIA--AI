import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { getHealth, getProviders, testProvider, getSearchTransparency, getAuditEvents } from '../../services/api'

export function SystemPanel() {
  const { health, setHealth, stats } = useStore()
  const [loading, setLoading] = useState(false)
  const [providersData, setProvidersData] = useState<any | null>(null)
  const [transparency, setTransparency] = useState<any | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<any | null>(null)
  const [auditEvents, setAuditEvents] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setTestResult(null)
    try {
      const [h, provs, transp] = await Promise.all([
        getHealth().catch(() => null),
        getProviders().catch(() => null),
        getSearchTransparency().catch(() => null)
      ])
      if (h) setHealth(h)
      if (provs) setProvidersData(provs)
      if (transp) setTransparency(transp)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleTestProvider(name: string) {
    setTestingProvider(name)
    setTestResult(null)
    try {
      const res = await testProvider(name)
      setTestResult(res)
    } catch (e: any) {
      setTestResult({
        status: 'error',
        testedProvider: name,
        message: e.message || 'Provider test request failed'
      })
    } finally {
      setTestingProvider(null)
    }
  }

  async function fetchAudit() {
    setAuditLoading(true)
    try {
      const data = await getAuditEvents({ limit: 50 })
      if (data?.events) setAuditEvents(data.events)
    } catch (_) {}
    setAuditLoading(false)
  }

  useEffect(() => {
    refresh()
    fetchAudit()
    const t = setInterval(fetchAudit, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', background: '#080c10', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <span style={{ fontSize: 11, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>
            System Infrastructure & Provider Matrix
          </span>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
            Real-time status of forensic engines, discovery adapters, Supabase persistence & rate limits
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="vm-btn"
            style={{ padding: '6px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: '#0e1d30', border: '1px solid #00d4ff50', color: '#38bdf8' }}
            onClick={() => useStore.getState().setActiveTab('debug')}
          >
            🪲 Live Network Debugger ↗
          </button>
          <button
            className="vm-btn vm-btn-ghost"
            style={{ padding: '6px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={refresh}
            disabled={loading}
          >
            {loading ? '◌ Checking...' : '↻ Refresh Status'}
          </button>
        </div>
      </div>

      {testResult && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 6,
          background: testResult.status === 'ok' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${testResult.status === 'ok' ? '#22c55e' : '#ef4444'}40`,
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Provider [{testResult.testedProvider}]:</strong> {testResult.message}
          </div>
          <button
            onClick={() => setTestResult(null)}
            style={{ background: 'transparent', border: 'none', color: '#8899aa', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Discovery Providers Matrix */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Discovery Providers & External Adapters
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {providersData?.providers ? (
            Object.entries(providersData.providers).map(([key, prov]: [string, any]) => {
              const isConnected = prov.status === 'AVAILABLE' || prov.status === 'CONNECTED'
              const isAuthReq = prov.status === 'AUTH_REQUIRED' || prov.status === 'CREDENTIALS_REQUIRED'
              const isNotConfig = prov.status === 'NOT_CONFIGURED'
              const badgeColor = isConnected ? '#22c55e' : isAuthReq ? '#f59e0b' : '#64748b'
              const badgeBg = isConnected ? 'rgba(34,197,94,0.1)' : isAuthReq ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)'

              return (
                <div key={key} style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                      {prov.name || key.toUpperCase()}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}33`,
                      fontSize: 9,
                      fontWeight: 800,
                      fontFamily: 'monospace'
                    }}>
                      {prov.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
                    {prov.requiresKey ? 'Requires API Key in .env' : 'Public Official API'}
                    {prov.rateLimit && ` · ${prov.rateLimit}`}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                      Free Tier: {prov.freeTier ? 'YES' : 'REQUIRES AUTH'}
                    </span>
                    <button
                      onClick={() => handleTestProvider(key)}
                      disabled={testingProvider === key}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#38bdf8',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {testingProvider === key ? 'Testing...' : 'Test Adapter'}
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ color: '#64748b', fontSize: 12 }}>Loading provider matrix...</div>
          )}
        </div>
      </div>

      {/* Permanently Unavailable Platforms Notice */}
      {transparency?.permanentUnavailablePlatforms && (
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 6 }}>
            🛡️ Platform Policy & Honest Status Declaration
          </div>
          <p style={{ fontSize: 11, color: '#cbd5e1', margin: '0 0 8px 0', lineHeight: 1.5 }}>
            {transparency.notice}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {transparency.permanentUnavailablePlatforms.map((p: string) => (
              <span key={p} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {p}: UNAVAILABLE (NO SCRAPING)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Core Services & DB Sync */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 700 }}>
          Core Infrastructure Services
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {health?.services ? (
            Object.entries(health.services).map(([name, status]) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#0d1117', border: '1px solid #1e2d3d',
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace' }}>{name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: status === 'operational' || status === 'enabled' ? '#22c55e' : '#f59e0b',
                  }} />
                  <span style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 700 }}>{status}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#4a5568', fontSize: 12 }}>Connecting...</div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 700 }}>
          Live Engine Session Metrics
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total Investigations/Scans', value: stats.total, color: '#00d4ff' },
            { label: 'Threats Detected', value: stats.threats, color: '#ef4444' },
            { label: 'DMCA Enforcements', value: stats.dmca, color: '#f97316' },
            { label: 'Authentic/Clean Media', value: stats.clean, color: '#22c55e' },
            { label: 'Engine Uptime', value: health ? `${Math.round(health.uptime_seconds)}s` : '—', color: '#a855f7' },
            { label: 'Total Server Ingestions', value: health?.total_scans ?? '—', color: '#0ea5e9' },
          ].map(item => (
            <div key={item.label} style={{
              background: '#0d1117', border: '1px solid #1e2d3d',
              borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: '#8899aa', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Direct API Endpoints */}
      <div style={{ padding: 16, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
          Direct REST Endpoints
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {[
            { label: 'System Health Check', url: '/health' },
            { label: 'Discovery Health', url: '/api/search/health' },
            { label: 'Discovery Transparency', url: '/api/search/transparency' },
            { label: 'Provider Matrix Index', url: '/api/providers' },
            { label: 'Active Investigations Index', url: '/api/investigations' },
            { label: 'Enforcement Cases Index', url: '/api/v1/cases/' },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', background: '#080c10', border: '1px solid #1e2d3d',
              borderRadius: 6, color: '#00d4ff', fontSize: 11,
              textDecoration: 'none',
            }}>
              <span>↗</span> {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Audit Trail */}
      <div style={{ padding: 16, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>
            Audit Trail {auditLoading ? '◌' : `(${auditEvents.length})`}
          </p>
          <button
            onClick={fetchAudit}
            style={{ fontSize: 10, color: '#38bdf8', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            ↻ Refresh
          </button>
        </div>
        {auditEvents.length === 0 ? (
          <div style={{ fontSize: 11, color: '#4a5568', textAlign: 'center', padding: 16 }}>
            {auditLoading ? 'Loading audit events…' : 'No audit events recorded yet'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d3d' }}>
                  {['Timestamp', 'Actor', 'Action', 'Object Type', 'Object ID'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditEvents.slice(0, 50).map((ev: any) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #111827' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '5px 8px', color: '#64748b' }}>
                      {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#94a3b8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.actor || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#38bdf8', fontWeight: 700 }}>{ev.action}</td>
                    <td style={{ padding: '5px 8px', color: '#8899aa' }}>{ev.objectType}</td>
                    <td style={{ padding: '5px 8px', color: '#4a5568', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.objectId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
