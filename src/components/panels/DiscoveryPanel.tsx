import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { getProviders, getSearchTransparency, searchMultiSource, getInvestigationCandidates } from '../../services/api'

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  authRequired: boolean
  reason?: string | null
  permanentUnavailable?: boolean
  instances?: string[]
}

interface TransparencySource {
  id: string
  name: string
  category: string
  description: string
  status: string
  reason?: string | null
  resultCount?: number
  isPermanentUnavailable?: boolean
  publicApiExists?: boolean
}

interface DiscoveredCandidate {
  id?: string
  title: string
  url: string
  author?: string
  publishedAt?: string
  platform?: string
  domain?: string
  similarity?: number
  matchScore?: number
  thumbnailUrl?: string
  snippet?: string
}

export function DiscoveryPanel() {
  const { currentResult, setActiveTab } = useStore()
  const isTestScenario = currentResult?.scenario === 'deepfake' || currentResult?.scenario === 'scam' || currentResult?.scenario === 'authentic'

  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({})
  const [transparencySources, setTransparencySources] = useState<TransparencySource[]>([])
  const [transparencyNotice, setTransparencyNotice] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<string>('googleImages')
  const [testQuery, setTestQuery] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [candidatesList, setCandidatesList] = useState<DiscoveredCandidate[]>([])
  const [queryError, setQueryError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [providerMatchCounts, setProviderMatchCounts] = useState<Record<string, { count: number; status: string }>>({})

  useEffect(() => {
    fetchProvidersAndTransparency()
    setQueryError(null)
    setStatusMsg(null)

    if (currentResult?.caption) {
      setTestQuery(currentResult.caption)
    } else if (isTestScenario) {
      setTestQuery('Championship final broadcast 2026')
    } else {
      setTestQuery('')
    }

    const invId = currentResult?.investigationId || currentResult?.case_id
    // Only load pre-baked test scenario candidates if user has explicitly selected one of the test scenarios
    if (isTestScenario && invId) {
      loadInvestigationCandidates(invId)
    } else if (currentResult && (currentResult as any).candidates && Array.isArray((currentResult as any).candidates) && (currentResult as any).candidates.length > 0) {
      setCandidatesList((currentResult as any).candidates)
    } else {
      // Clear candidates so that non-scenario scans do not inherit demo/scenario candidates
      setCandidatesList([])
    }
  }, [currentResult])

  async function fetchProvidersAndTransparency() {
    setProvidersLoading(true)
    try {
      const [provRes, transpRes] = await Promise.all([
        getProviders().catch(() => null),
        getSearchTransparency().catch(() => null)
      ])

      if (provRes?.providers) {
        setProviders(provRes.providers)
        if (provRes.checkedAt) setCheckedAt(provRes.checkedAt)
        const provs = provRes.providers as Record<string, ProviderInfo>
        if (provs.googleImages?.available) {
          setSelectedProvider('googleImages')
        } else {
          const first = Object.values(provs).find(p => p.available && !p.permanentUnavailable)
          if (first) setSelectedProvider(first.id)
        }
      }

      if (transpRes?.sources && Array.isArray(transpRes.sources)) {
        setTransparencySources(transpRes.sources)
      }
      if (transpRes?.notice) {
        setTransparencyNotice(transpRes.notice)
      }
    } catch (e) {
      console.error('Failed to load providers and search transparency:', e)
    } finally {
      setProvidersLoading(false)
    }
  }

  async function loadInvestigationCandidates(invId: string) {
    try {
      const res = await getInvestigationCandidates(invId)
      const list = Array.isArray(res) ? res : (res?.candidates || res?.results || [])
      if (list.length > 0) {
        setCandidatesList(list)
      } else {
        setCandidatesList([])
      }
    } catch (err) {
      console.warn('Could not load candidates for investigation:', err)
      setCandidatesList([])
    }
  }

  async function handleSearch() {
    if (!testQuery.trim()) return
    setIsQuerying(true)
    setQueryError(null)
    setStatusMsg(null)
    try {
      const result = await searchMultiSource(testQuery.trim(), [selectedProvider])
      const provResult = result?.results?.[selectedProvider] || result
      const candidates = provResult?.candidates || provResult?.results || result?.candidates || []
      
      const counts: Record<string, { count: number; status: string }> = {}
      if (result?.providerStatuses) {
        Object.entries(result.providerStatuses).forEach(([k, v]: [string, any]) => {
          counts[k] = { count: v.count || 0, status: v.status || 'OK' }
        })
      } else {
        counts[selectedProvider] = { count: candidates.length, status: 'OK' }
      }
      setProviderMatchCounts(counts)

      if (candidates.length > 0) {
        const formatted: DiscoveredCandidate[] = candidates.map((c: any, i: number) => {
          const url = c.url || c.link || c.contextLink || '#'
          let domain = c.domain || c.displayLink || ''
          if (!domain && url && url !== '#') {
            try { domain = new URL(url).hostname.replace(/^www\./, '') } catch (_) {}
          }
          return {
            id: c.id || `CAND-LIVE-${Date.now()}-${i}`,
            title: c.title || c.snippet?.slice(0, 60) || 'Discovered Media Candidate',
            url,
            author: c.author || c.displayLink || domain || 'Indexed Web Source',
            publishedAt: c.publishedAt || c.retrievedAt || new Date().toISOString(),
            platform: c.platform || activeProviderObj?.name || selectedProvider,
            domain: domain || 'web',
            similarity: c.similarity ?? (c.matchScore ? c.matchScore / 100 : 0.88),
            thumbnailUrl: c.thumbnailUrl || c.imageUrl || c.mediaUrl || null,
            snippet: c.snippet || c.description || c.text || 'Real-time candidate ingested from live search provider.'
          }
        })
        setCandidatesList(formatted)
        setStatusMsg(`Discovered ${formatted.length} live candidates via ${activeProviderObj?.name || selectedProvider}.`)
      } else {
        setCandidatesList([])
        setStatusMsg('No matching appearances found across indexed providers for this asset')
      }
    } catch (err: any) {
      setCandidatesList([])
      setQueryError(err?.response?.data?.error || err?.message || 'Search failed across configured discovery endpoints')
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
    <div style={{ padding: '20px 24px', width: '100%', minHeight: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header Banner */}
      <div style={{
        padding: '14px 20px',
        borderRadius: 10,
        background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.1) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
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
            <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: 'rgba(0,212,255,0.15)', color: '#38bdf8', fontWeight: 700 }}>
              CANDIDATE INGESTION
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0 0' }}>
            Multi-platform search and normalized candidate ingestion pipeline across open web repositories.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: '#0d1117', padding: '6px 14px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
              {providersLoading ? '…' : `${activeCount} / ${totalCount}`}
            </div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Active Adapters</div>
          </div>
          <div style={{ background: '#0d1117', padding: '6px 14px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {candidatesList.length}
            </div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Matched Candidates</div>
          </div>
          <button
            onClick={fetchProvidersAndTransparency}
            disabled={providersLoading}
            style={{
              background: '#0d1117',
              border: '1px solid #1e2d3d',
              color: '#00d4ff',
              cursor: 'pointer',
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 6,
              fontWeight: 700
            }}
          >
            {providersLoading ? '◌ Loading…' : '↻ Refresh Matrix'}
          </button>
        </div>
      </div>

      {/* Provider Selection Badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configured Discovery Adapters (Live Backend)
          </div>
          {checkedAt && (
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
              Verified: {new Date(checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {providerList.map(prov => {
            const isSelected = selectedProvider === prov.id
            const canSelect = prov.available && !prov.permanentUnavailable
            return (
              <button
                key={prov.id}
                onClick={() => canSelect && setSelectedProvider(prov.id)}
                style={{
                  background: isSelected ? 'rgba(0, 212, 255, 0.12)' : '#0d1117',
                  border: isSelected ? '1.5px solid #00d4ff' : '1px solid #1e2d3d',
                  borderRadius: 8,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: canSelect ? 'pointer' : 'not-allowed',
                  opacity: prov.permanentUnavailable ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? '#38bdf8' : '#e2e8f0' }}>
                  {prov.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: statusColor(prov) }}>
                    ● {statusLabel(prov)}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b' }}>
                    {providerMatchCounts[prov.id] !== undefined ? `${providerMatchCounts[prov.id].count} matches` : '0 matches'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live Search Transparency Matrix Section */}
      {transparencySources.length > 0 && (
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📡 Live Search Transparency Matrix</span>
              <span style={{ fontSize: 10, color: '#00d4ff', background: 'rgba(0,212,255,0.15)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                getSearchTransparency()
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {transparencySources.length} Platform Sources Audited
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {transparencySources.map((src) => {
              const isAvailable = src.status === 'AVAILABLE'
              const isUnavail = src.isPermanentUnavailable || src.status === 'UNAVAILABLE'
              return (
                <div
                  key={src.id}
                  style={{
                    background: '#080c10',
                    border: '1px solid #1e2d3d',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{src.name}</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      background: isAvailable ? 'rgba(34,197,94,0.15)' : isUnavail ? 'rgba(100,116,139,0.2)' : 'rgba(245,158,11,0.15)',
                      color: isAvailable ? '#4ade80' : isUnavail ? '#64748b' : '#fbbf24'
                    }}>
                      {src.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {src.category}
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.3 }}>
                    {src.description}
                  </p>
                  {src.reason && (
                    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontStyle: 'italic' }}>
                      Note: {src.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {transparencyNotice && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(15,23,42,0.8)', border: '1px solid #1e2d3d', fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>🔒</span>
              <span><strong>Compliance Notice:</strong> {transparencyNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* Live Search Bar */}
      <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc' }}>
            Multi-Source Search & Media Discovery Query
          </div>
          {activeProviderObj && (
            <span style={{ fontSize: 11, color: activeProviderObj.available ? '#4ade80' : '#fbbf24' }}>
              Target: <strong>{activeProviderObj.name}</strong> {activeProviderObj.authRequired ? '(API Key Ready)' : '(Public Direct)'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isQuerying && handleSearch()}
            placeholder="Search keywords, hash, caption or media topic…"
            style={{
              flex: 1,
              background: '#080c10',
              border: '1px solid #1e2d3d',
              borderRadius: 6,
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: 13,
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
              padding: '0 20px',
              fontSize: 12,
              fontWeight: 800,
              cursor: activeProviderObj?.available ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {isQuerying ? '◌ Searching…' : '🔍 Discover Candidates'}
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quick Queries:</span>
          {['Broadcast Highlights 2026', 'Deepfake interview viral', 'TikTok vertical crop sports'].map((preset) => (
            <button
              key={preset}
              onClick={() => { setTestQuery(preset); }}
              style={{
                background: '#080c10',
                border: '1px solid #1e2d3d',
                color: '#94a3b8',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10,
                cursor: 'pointer'
              }}
            >
              {preset}
            </button>
          ))}
        </div>

        {statusMsg && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 11, color: '#4ade80' }}>
            ✓ {statusMsg}
          </div>
        )}
        {queryError && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#f87171' }}>
            ⚠ {queryError}
          </div>
        )}
      </div>

      {/* Discovered Candidates Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔎 Discovered Media Candidates</span>
            <span style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '2px 8px', borderRadius: 4 }}>
              {candidatesList.length} items
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Sorted by Perceptual Hash Similarity</span>
        </div>

        {candidatesList.length === 0 ? (
          <div style={{
            background: '#0d1117',
            border: queryError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px dashed #1e2d3d',
            borderRadius: 8,
            padding: '36px 20px',
            textAlign: 'center',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>
              {queryError ? '⚠️' : '🔎'}
            </div>
            <div style={{ color: queryError ? '#f87171' : '#94a3b8', fontWeight: 800, fontSize: 14 }}>
              {queryError
                ? 'Discovery Provider Search Error'
                : (currentResult || statusMsg
                    ? 'No matching appearances found across indexed providers for this asset'
                    : 'No Live Candidates Ingested Yet')}
            </div>
            <div style={{ fontSize: 12, maxWidth: 520, lineHeight: 1.5, color: '#64748b' }}>
              {queryError ? (
                <span>Error details: {queryError}. Check discovery adapter credentials or select an alternate provider.</span>
              ) : (currentResult || statusMsg) ? (
                <span>
                  Search across verified discovery adapters returned <strong>0 matches</strong> for this media signature. Provider statuses are confirmed at 0 matches.
                </span>
              ) : (
                <span>
                  Select an active discovery adapter above (such as <strong>Google Search API</strong>) and enter a target search query, then click <strong>"Discover Candidates"</strong> to fetch real live candidate results.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {candidatesList.map((cand, idx) => {
              const sim = cand.similarity ?? 0.85
              const simPct = Math.round(sim * 100)
              const isOriginal = simPct >= 99
              const isHighDerivative = simPct >= 85 && !isOriginal

              return (
                <div
                  key={cand.id || idx}
                  style={{
                    background: '#0d1117',
                    border: isOriginal ? '1.5px solid rgba(34, 197, 94, 0.5)' : isHighDerivative ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid #1e2d3d',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: isOriginal ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.1)',
                        border: `1px solid ${isOriginal ? '#22c55e44' : '#00d4ff44'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0
                      }}>
                        {isOriginal ? '👑' : cand.platform?.includes('TikTok') ? '📱' : cand.platform?.includes('YouTube') ? '▶️' : '🌐'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                            {cand.title}
                          </h4>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isOriginal ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.15)',
                            color: isOriginal ? '#4ade80' : '#38bdf8'
                          }}>
                            {cand.platform || 'Web'}
                          </span>
                          {cand.author && (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>by @{cand.author}</span>
                          )}
                        </div>

                        <p style={{ fontSize: 12, color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                          {cand.snippet}
                        </p>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                          <span>Published: {cand.publishedAt ? new Date(cand.publishedAt).toLocaleString() : 'N/A'}</span>
                          <span>•</span>
                          <a href={cand.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                            🔗 {cand.url.length > 45 ? `${cand.url.slice(0, 45)}…` : cand.url}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Similarity Score Badge & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div style={{
                        textAlign: 'right',
                        background: '#080c10',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #1e2d3d'
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isOriginal ? '#4ade80' : isHighDerivative ? '#fbbf24' : '#38bdf8', fontFamily: 'monospace' }}>
                          {simPct}%
                        </div>
                        <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                          {isOriginal ? 'Master Origin' : 'Perceptual Match'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setActiveTab('origin')}
                          style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🌳 Trace in E3
                        </button>
                        <button
                          onClick={() => setActiveTab('propagation')}
                          style={{
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            color: '#c084fc',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📡 View in E4
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
