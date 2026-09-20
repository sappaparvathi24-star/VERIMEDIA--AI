import { useState, useEffect } from 'react'
import { getProviders, searchMultiSource } from '../../services/api'

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  authRequired: boolean
  reason?: string | null
  permanentUnavailable?: boolean
  instances?: string[]
}

export function DiscoveryPanel() {
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({})
  const [providersLoading, setProvidersLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<string>('reddit')
  const [testQuery, setTestQuery] = useState('breaking interview 2026')
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryResults, setQueryResults] = useState<{ raw: any; text: string } | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  useEffect(() => {
    loadProviders()
  }, [])

  async function loadProviders() {
    setProvidersLoading(true)
    try {
      const data = await getProviders()
      if (data?.providers) {
        setProviders(data.providers)
        // Select first available provider by default
        const first = Object.values(data.providers as Record<string, ProviderInfo>).find(p => p.available && !p.permanentUnavailable)
        if (first) setSelectedProvider(first.id)
      }
    } catch (e) {
      console.error('Failed to load providers', e)
    } finally {
      setProvidersLoading(false)
    }
  }

  async function handleSearch() {
    if (!testQuery.trim()) return
    setIsQuerying(true)
    setQueryError(null)
    setQueryResults(null)
    try {
      const result = await searchMultiSource(testQuery.trim(), [selectedProvider])
      const provResult = result?.results?.[selectedProvider] || result
      const candidates = provResult?.candidates || provResult?.results || []
      const count = provResult?.count ?? candidates.length

      const lines: string[] = []
      lines.push(`[Discovery] Provider: ${selectedProvider.toUpperCase()} | Query: "${testQuery}"`)
      lines.push(`[Discovery] ${count} result(s) returned`)
      if (candidates.length > 0) {
        candidates.slice(0, 8).forEach((c: any, i: number) => {
          const ts = c.publishedAt ? ` | ${c.publishedAt.slice(0, 10)}` : ''
          const auth = c.author ? ` | @${c.author}` : ''
          lines.push(`  [${i + 1}] ${c.title || c.url || 'Untitled'}${auth}${ts}`)
          if (c.url) lines.push(`       → ${c.url}`)
        })
        if (count > 8) lines.push(`  … and ${count - 8} more results.`)
      } else {
        lines.push('  No candidates found for this query.')
      }
      setQueryResults({ raw: result, text: lines.join('\n') })
    } catch (err: any) {
      setQueryError(err?.response?.data?.error || err?.message || 'Search failed')
    } finally {
      setIsQuerying(false)
    }
  }

  const providerList = Object.values(providers) as ProviderInfo[]
  const activeProviderObj = providers[selectedProvider]
  const activeCount = providerList.filter(p => p.available && !p.permanentUnavailable).length
  const totalCount = providerList.filter(p => !p.permanentUnavailable).length

  function statusColor(p: ProviderInfo) {
    if (p.permanentUnavailable) return '#4a5568'
    return p.available ? '#4ade80' : '#f59e0b'
  }

  function statusLabel(p: ProviderInfo) {
    if (p.permanentUnavailable) return 'UNAVAILABLE'
    return p.available ? 'AVAILABLE' : 'CONFIG REQUIRED'
  }

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header Banner */}
      <div style={{
        padding: '12px 18px',
        borderRadius: 8,
        background: 'rgba(0, 212, 255, 0.08)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#00d4ff', fontWeight: 800 }}>
              Engine 2 — Discovery Intelligence
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0 0' }}>
            Multi-platform search and normalized candidate ingestion pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#0d1117', padding: '6px 12px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
              {providersLoading ? '…' : `${activeCount} / ${totalCount}`}
            </div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Active Adapters</div>
          </div>
          <div style={{ background: '#0d1117', padding: '6px 12px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <button
              onClick={loadProviders}
              disabled={providersLoading}
              style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', fontSize: 11, padding: 0, fontWeight: 700 }}
            >
              {providersLoading ? '◌ Loading…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Provider Status Grid */}
      {providersLoading ? (
        <div style={{ textAlign: 'center', color: '#4a5568', padding: '20px', fontSize: 12 }}>
          <span style={{ animation: 'spin-slow 1s linear infinite', marginRight: 6 }}>◌</span>
          Loading provider status from backend…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {providerList.map(prov => {
            const isSelected = selectedProvider === prov.id
            const canSelect = prov.available && !prov.permanentUnavailable
            return (
              <button
                key={prov.id}
                onClick={() => canSelect && setSelectedProvider(prov.id)}
                style={{
                  background: isSelected ? 'rgba(30, 41, 59, 0.9)' : '#0d1117',
                  border: isSelected ? '1.5px solid #00d4ff' : '1px solid #1e2d3d',
                  borderRadius: 8,
                  padding: '10px 8px',
                  textAlign: 'center',
                  cursor: canSelect ? 'pointer' : 'not-allowed',
                  opacity: prov.permanentUnavailable ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#38bdf8' : '#e2e8f0', marginBottom: 2 }}>
                  {prov.name}
                </div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: statusColor(prov) }}>
                  ● {statusLabel(prov)}
                </div>
                {prov.authRequired && !prov.available && (
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Needs API key</div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Selected Provider Details + Search Dispatcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Provider Detail Card */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
          {activeProviderObj ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{activeProviderObj.name}</h4>
                  <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>ID: {activeProviderObj.id}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, background: activeProviderObj.available ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${activeProviderObj.available ? '#22c55e44' : '#f59e0b44'}`,
                  color: activeProviderObj.available ? '#4ade80' : '#fbbf24',
                  padding: '2px 8px', borderRadius: 4, fontWeight: 700
                }}>
                  {activeProviderObj.available ? '● AVAILABLE' : '● CONFIG REQUIRED'}
                </span>
                <span style={{ fontSize: 10, background: '#080c10', border: '1px solid #1e2d3d', color: '#38bdf8', padding: '2px 8px', borderRadius: 4 }}>
                  {activeProviderObj.authRequired ? '🔑 Key Required' : '🔓 No Key Needed'}
                </span>
              </div>
              {activeProviderObj.reason && (
                <p style={{ fontSize: 11, color: '#f59e0b', margin: '0 0 8px 0' }}>
                  ⚠ {activeProviderObj.reason}
                </p>
              )}
              {activeProviderObj.instances && (
                <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
                  Instances: {activeProviderObj.instances.join(', ')}
                </p>
              )}
            </>
          ) : (
            <div style={{ color: '#4a5568', fontSize: 12 }}>Select a provider to see details.</div>
          )}
        </div>

        {/* Query Dispatcher */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Live Discovery Query
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isQuerying && handleSearch()}
              placeholder="Search query or keyword…"
              style={{
                flex: 1,
                background: '#080c10',
                border: '1px solid #1e2d3d',
                borderRadius: 6,
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: 12,
                outline: 'none'
              }}
            />
            <button
              onClick={handleSearch}
              disabled={isQuerying || !activeProviderObj?.available}
              style={{
                background: activeProviderObj?.available ? '#00d4ff' : '#334155',
                color: '#080c10',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 800,
                cursor: activeProviderObj?.available ? 'pointer' : 'not-allowed'
              }}
            >
              {isQuerying ? '◌ Searching…' : 'Search'}
            </button>
          </div>

          <div style={{
            flex: 1,
            background: '#080c10',
            border: `1px solid ${queryError ? '#ef4444' : '#1e2d3d'}`,
            borderRadius: 6,
            padding: 10,
            fontFamily: 'monospace',
            fontSize: 11,
            color: queryError ? '#ef4444' : '#94a3b8',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            minHeight: 90,
            overflowY: 'auto'
          }}>
            {queryError
              ? `[Error] ${queryError}`
              : queryResults
                ? queryResults.text
                : activeProviderObj?.available
                  ? `// Enter a query and click Search to run a live ${activeProviderObj.name} query.`
                  : `// Provider "${activeProviderObj?.name || selectedProvider}" requires an API key. Configure it in environment variables to enable live search.`
            }
          </div>
        </div>
      </div>

      {/* Transparency Notice */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid #1e2d3d',
        fontSize: 11,
        color: '#64748b'
      }}>
        <strong style={{ color: '#8899aa' }}>Transparency:</strong> Closed platforms (Instagram, TikTok, Facebook, X) have no public media-search API and are not accessible. Reddit, Mastodon, and Wayback Machine require no API key. YouTube and Google Images require API keys configured in server environment variables.
      </div>
    </div>
  )
}
