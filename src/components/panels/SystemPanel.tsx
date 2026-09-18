import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { getHealth } from '../../services/api'

export function SystemPanel() {
  const { health, setHealth, stats } = useStore()
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try { const h = await getHealth(); setHealth(h) }
    catch {}
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          System Status
        </span>
        <button className="vm-btn vm-btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }} onClick={refresh} disabled={loading}>
          {loading ? '◌' : '↻'} Refresh
        </button>
      </div>

      {/* Services */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Services</p>
        {health ? (
          Object.entries(health.services).map(([name, status]) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: '#0d1117', border: '1px solid #1e2d3d',
              borderRadius: 6, marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace' }}>{name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: status === 'operational' || status === 'enabled' ? '#22c55e' : '#f59e0b',
                }} />
                <span style={{ fontSize: 10, color: '#8899aa' }}>{status}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#4a5568', fontSize: 12 }}>Connecting...</div>
        )}
      </div>

      {/* Metrics */}
      <div>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Session Metrics</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total Scans',    value: stats.total,                        color: '#00d4ff' },
            { label: 'Threats Found',  value: stats.threats,                      color: '#ef4444' },
            { label: 'DMCA Filed',     value: stats.dmca,                         color: '#f97316' },
            { label: 'Clean Content',  value: stats.clean,                        color: '#22c55e' },
            { label: 'Uptime',         value: health ? `${Math.round(health.uptime_seconds)}s` : '—', color: '#a855f7' },
            { label: 'Server Scans',   value: health?.total_scans ?? '—',         color: '#0ea5e9' },
          ].map(item => (
            <div key={item.label} style={{
              background: '#0d1117', border: '1px solid #1e2d3d',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* API info */}
      <div style={{ marginTop: 20, padding: 14, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8 }}>
        <p style={{ fontSize: 10, color: '#4a5568', marginBottom: 8 }}>QUICK LINKS</p>
        {[
          { label: 'API Documentation', url: 'http://localhost:8000/docs' },
          { label: 'API ReDoc',         url: 'http://localhost:8000/redoc' },
          { label: 'Health Endpoint',   url: 'http://localhost:8000/api/v1/health' },
          { label: 'MinIO Console',     url: 'http://localhost:9001' },
        ].map(link => (
          <a key={link.label} href={link.url} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 0', color: '#00d4ff', fontSize: 12,
            textDecoration: 'none',
          }}>
            <span>↗</span> {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}
