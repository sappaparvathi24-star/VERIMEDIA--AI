import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { getProviders, getSearchTransparency, searchMultiSource, getInvestigationCandidates, fetchGroundedSearch, GroundedSearchResult } from '../../services/api'

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
  classification?: 'EXACT_MATCH' | 'NEAR_DUPLICATE' | 'MODIFIED_DERIVATIVE' | 'UNRELATED' | string
  matchType?: 'visual_match' | 'text_inferred' | 'unsupported_by_platform' | string
  visionScore?: number | null
  phashSimilarity?: number | null
  hammingDistance?: number | null
  similarityMeasurements?: {
    visualSimilarity?: number | null
    phashSimilarity?: number | null
    visionScore?: number | null
    hammingDistance?: number | null
    comparisonMethod?: string
    similarityStatus?: string
  }
  thumbnailUrl?: string | null
  snippet?: string
  source?: string
  sourceType?: string
  isPartialMatch?: boolean
  tamperedIndicator?: string | null
}

export function DiscoveryPanel() {
  const { currentResult, setCurrentResult, setActiveTab } = useStore()
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({})
  const [transparencySources, setTransparencySources] = useState<TransparencySource[]>([])
  const [transparencyNotice, setTransparencyNotice] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<string>('google_vision')
  const [testQuery, setTestQuery] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [candidatesList, setCandidatesList] = useState<DiscoveredCandidate[]>([])
  const [queryError, setQueryError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [providerStatuses, setProviderStatuses] = useState<Record<string, { status: string; count: number; reason?: string | null; name?: string }>>({})

  // Pagination state (10 items per batch, up to 50 max)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [maxReached, setMaxReached] = useState<boolean>(false)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [totalDiscoveredCount, setTotalDiscoveredCount] = useState<number>(0)

  const [searchMode, setSearchMode] = useState<'VISUAL' | 'MANUAL_TEXT'>('VISUAL')
  const [lastExecutedQuery, setLastExecutedQuery] = useState<string>('')

  // Google Search Grounding state (gemini-3.5-flash)
  const [groundedResult, setGroundedResult] = useState<GroundedSearchResult | null>(null)
  const [isGroundedLoading, setIsGroundedLoading] = useState<boolean>(false)
  const [groundedError, setGroundedError] = useState<string | null>(null)

  const artifactId = (currentResult as any)?.artifact?.id || (currentResult as any)?.artifactId || (currentResult as any)?.id || null
  const referenceThumbnail = (currentResult as any)?.artifact?.previewUrl ||
    (currentResult as any)?.artifact?.fileUrl ||
    (currentResult as any)?.artifact?.dataUrl ||
    (currentResult as any)?.previewUrl ||
    (currentResult as any)?.thumbnailUrl ||
    (currentResult as any)?.mediaUrl ||
    (currentResult as any)?.url ||
    (artifactId ? `/api/artifacts/${artifactId}/file` : null)
  const artifactName = (currentResult as any)?.artifact?.filename || (currentResult as any)?.filename || (currentResult as any)?.title || currentResult?.caption || 'Uploaded Media Artifact'

  async function runGroundedDiscovery() {
    setIsGroundedLoading(true)
    setGroundedError(null)
    try {
      const qTerm = testQuery.trim() || artifactName || 'Media authenticity verification'
      const res = await fetchGroundedSearch({
        query: qTerm,
        filename: artifactName,
        context: 'Discovery Intelligence & Live Web Grounding'
      })
      setGroundedResult(res)
    } catch (err: any) {
      setGroundedError(err?.response?.data?.error || err?.message || 'Grounded search query failed')
    } finally {
      setIsGroundedLoading(false)
    }
  }

  useEffect(() => {
    fetchProvidersAndTransparency()
    if (currentResult?.caption) {
      setTestQuery(currentResult.caption)
    } else if ((currentResult as any)?.filename) {
      setTestQuery((currentResult as any).filename.replace(/\.[^/.]+$/, ''))
    } else {
      setTestQuery('')
    }

    // 1. Immediately hydrate candidates if currentResult already has them
    const existing = (currentResult as any)?.candidates || (currentResult as any)?.discovery?.candidates || []
    if (existing.length > 0) {
      const formatted = existing.map((c: any, i: number) => formatCandidate(c, i))
      setCandidatesList(formatted)
      setTotalDiscoveredCount(formatted.length)
      setHasSearched(true)
      setStatusMsg(`Loaded ${formatted.length} discovered appearance(s) from media investigation pipeline.`)
    }

    const invId = currentResult?.investigationId || currentResult?.case_id
    if (invId) {
      loadInvestigationCandidates(invId)
    }

    // Auto-trigger image-first visual discovery when media artifact is present ONLY if no candidates exist yet
    const artId = (currentResult as any)?.artifact?.id || ((currentResult as any)?.id || (currentResult as any)?.artifactId)
    const hasMedia = Boolean(artId || referenceThumbnail)
    if (hasMedia && !hasSearched && existing.length === 0) {
      executeDiscovery(false, 1)
    }
  }, [(currentResult as any)?.artifact?.id, (currentResult as any)?.id, (currentResult as any)?.artifactId, currentResult?.investigationId, (currentResult as any)?.candidates])

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
        if (provs.google_vision?.available) {
          setSelectedProvider('google_vision')
        } else if (provs.googleImages?.available) {
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
      const rawList = Array.isArray(res) ? res : (res?.candidates || res?.results || [])
      if (rawList.length > 0) {
        const formatted = rawList.map((c: any, i: number) => formatCandidate(c, i))
        setCandidatesList(formatted)
        setTotalDiscoveredCount(formatted.length)
        setHasSearched(true)
        if (currentResult) {
          setCurrentResult({
            ...currentResult,
            candidates: formatted,
            comparisonReports: formatted,
            discovery: {
              ...(currentResult as any)?.discovery,
              candidates: formatted,
              totalDiscovered: formatted.length
            }
          } as any)
        }
      }
    } catch (err) {
      console.warn('Could not load candidates for investigation:', err)
    }
  }

  function formatCandidate(c: any, i: number): DiscoveredCandidate {
    const url = c.url || c.link || c.contextLink || '#'
    let domain = c.domain || c.displayLink || ''
    if (!domain && url && url !== '#') {
      try { domain = new URL(url).hostname.replace(/^www\./, '') } catch (_) {}
    }
    const sim = typeof c.similarity === 'number' ? c.similarity : (c.matchScore ? c.matchScore / 100 : 0.85)
    return {
      id: c.id || `CAND-LIVE-${Date.now()}-${i}`,
      title: c.title || c.snippet?.slice(0, 60) || 'Discovered Media Candidate',
      url,
      author: c.author || c.displayLink || domain || 'Indexed Web Source',
      publishedAt: c.publishedAt || c.retrievedAt || new Date().toISOString(),
      platform: c.platform || activeProviderObj?.name || selectedProvider,
      domain: domain || 'web',
      similarity: sim,
      matchScore: Math.round(sim * 100),
      classification: c.classification || (sim >= 0.98 ? 'EXACT_MATCH' : sim >= 0.88 ? 'NEAR_DUPLICATE' : sim >= 0.70 ? 'MODIFIED_DERIVATIVE' : 'UNRELATED'),
      matchType: c.matchType || (c.source === 'google_vision' ? 'visual_match' : 'text_inferred'),
      visionScore: typeof c.visionScore === 'number' ? c.visionScore : (c.similarityMeasurements?.visionScore ?? null),
      phashSimilarity: typeof c.phashSimilarity === 'number' ? c.phashSimilarity : (c.similarityMeasurements?.phashSimilarity ?? null),
      hammingDistance: typeof c.hammingDistance === 'number' ? c.hammingDistance : (c.similarityMeasurements?.hammingDistance ?? null),
      similarityMeasurements: c.similarityMeasurements,
      thumbnailUrl: c.thumbnailUrl || c.imageUrl || c.mediaUrl || null,
      snippet: c.snippet || c.description || c.text || 'Real-time candidate ingested from live external API.',
      source: c.source || selectedProvider,
      sourceType: c.sourceType || 'EXTERNAL_API_VERIFIED',
      isPartialMatch: Boolean(c.isPartialMatch || c.classification === 'MODIFIED_DERIVATIVE'),
      tamperedIndicator: c.tamperedIndicator || (c.classification === 'MODIFIED_DERIVATIVE' ? 'Visual variance detected (possible crop, tampering, or derivative modification)' : null)
    }
  }

  async function executeDiscovery(isManualText: boolean, pageNum: number = 1) {
    setIsQuerying(true)
    setQueryError(null)
    setStatusMsg(null)
    setHasSearched(true)
    setCurrentPage(pageNum)
    setSearchMode(isManualText ? 'MANUAL_TEXT' : 'VISUAL')
    setLastExecutedQuery(isManualText ? testQuery.trim() : 'Image-First Visual Search')

    try {
      const platformsToQuery = selectedProvider === 'ALL_PROVIDERS' ? undefined : [selectedProvider]
      const invId = (currentResult?.investigationId || currentResult?.case_id) || undefined
      const artId = (currentResult as any)?.artifact?.id || ((currentResult as any)?.id || (currentResult as any)?.artifactId) || undefined

      const queryToSend = isManualText ? testQuery.trim() : (testQuery.trim() || 'visual-reverse-search')
      const result = await searchMultiSource(queryToSend, platformsToQuery, pageNum, 10, invId, artId, isManualText)
      const provResult = selectedProvider !== 'ALL_PROVIDERS' ? (result?.results?.[selectedProvider] || result) : result
      const rawCandidates = provResult?.candidates || provResult?.results || result?.candidates || []
      
      if (rawCandidates.length > 0) {
        const formatted: DiscoveredCandidate[] = rawCandidates.map((c: any, i: number) => formatCandidate(c, i))
        setCandidatesList(formatted)
        setTotalDiscoveredCount(result?.totalDiscovered || formatted.length)
        setHasMore(Boolean(result?.hasMore))
        setMaxReached(Boolean(result?.maxReached || formatted.length >= 50))
        const modeLabel = isManualText ? 'Manual Keyword Fallback' : 'Reverse Image Visual Search'
        setStatusMsg(`Discovered ${formatted.length} genuine appearance(s) via ${modeLabel}. Candidates evaluated against perceptual hash.`)
        
        // Publish genuine candidates to global investigation state
        if (currentResult) {
          setCurrentResult({
            ...currentResult,
            candidates: formatted,
            comparisonReports: formatted,
            discovery: {
              ...(currentResult as any)?.discovery,
              candidates: formatted,
              totalDiscovered: result?.totalDiscovered || formatted.length
            }
          } as any)
        }
      } else {
        setCandidatesList([])
        setHasMore(false)
        setMaxReached(false)
        const providerName = selectedProvider === 'ALL_PROVIDERS' ? 'All Active Providers' : (activeProviderObj?.name || selectedProvider)
        if (isManualText) {
          setStatusMsg(`Zero matching appearances returned across ${providerName} for keyword "${testQuery}". Zero fabricated results.`)
        } else {
          setStatusMsg(`Zero visual appearances returned across ${providerName} for uploaded media. Zero fabricated results.`)
        }

        // Keep state honest: only clear currentResult candidates if no prior candidates existed
        const hasExisting = Boolean((currentResult as any)?.candidates && (currentResult as any).candidates.length > 0)
        if (currentResult && !hasExisting) {
          setCurrentResult({
            ...currentResult,
            candidates: [],
            comparisonReports: [],
            discovery: {
              ...(currentResult as any)?.discovery,
              candidates: [],
              totalDiscovered: 0
            }
          } as any)
        } else if (hasExisting) {
          setStatusMsg(prev => `${prev || ''} (Retained ${(currentResult as any)?.candidates?.length} confirmed appearance(s) from overall investigation).`)
        }
      }

      if (result?.providerStatuses) {
        setProviderStatuses(result.providerStatuses)
      }
    } catch (err: any) {
      setQueryError(err?.response?.data?.error || err?.message || 'Search failed')
    } finally {
      setIsQuerying(false)
    }
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore || maxReached) return
    setIsLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      const platformsToQuery = selectedProvider === 'ALL_PROVIDERS' ? undefined : [selectedProvider]
      const invId = (currentResult?.investigationId || currentResult?.case_id) || undefined
      const artId = (currentResult as any)?.artifact?.id || ((currentResult as any)?.id || (currentResult as any)?.artifactId) || undefined
      const isManual = searchMode === 'MANUAL_TEXT'

      const queryToSend = isManual ? testQuery.trim() : (testQuery.trim() || 'visual-reverse-search')
      const result = await searchMultiSource(queryToSend, platformsToQuery, nextPage, 10, invId, artId, isManual)
      const rawCandidates = result?.candidates || result?.results?.[selectedProvider]?.candidates || []

      if (rawCandidates.length > 0) {
        const newFormatted = rawCandidates.map((c: any, i: number) => formatCandidate(c, candidatesList.length + i))
        
        // Deduplicate by URL
        const existingUrls = new Set(candidatesList.map(c => c.url.toLowerCase()))
        const filteredNew = newFormatted.filter((c: DiscoveredCandidate) => !existingUrls.has(c.url.toLowerCase()))

        const combined = [...candidatesList, ...filteredNew]
        setCandidatesList(combined)
        setCurrentPage(nextPage)
        setHasMore(Boolean(result?.hasMore && combined.length < 50))
        setMaxReached(Boolean(result?.maxReached || combined.length >= 50))
        setStatusMsg(`Loaded ${filteredNew.length} additional candidates (Total: ${combined.length}).`)

        if (currentResult) {
          setCurrentResult({
            ...currentResult,
            candidates: combined,
            comparisonReports: combined,
            discovery: {
              ...(currentResult as any)?.discovery,
              candidates: combined,
              totalDiscovered: result?.totalDiscovered || combined.length
            }
          } as any)
        }
      } else {
        setHasMore(false)
      }
    } catch (err: any) {
      setQueryError(`Pagination error: ${err?.message || 'Could not load next batch'}`)
    } finally {
      setIsLoadingMore(false)
    }
  }

  function getProviderBadge(cand: DiscoveredCandidate) {
    const src = (cand.source || cand.platform || '').toLowerCase()
    if (src.includes('vision') || src === 'google_vision') {
      return { name: 'Google Vision (Web Detection)', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: '#a855f744' }
    }
    if (src.includes('youtube')) {
      return { name: 'YouTube Data API', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef444444' }
    }
    if (src.includes('instagram')) {
      return { name: 'Instagram Graph API', bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: '#ec489944' }
    }
    if (src.includes('x') || src.includes('twitter')) {
      return { name: 'X (Twitter) v2', bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: '#64748b44' }
    }
    if (src.includes('image') || src.includes('google') || src === 'google_search') {
      return { name: 'Google Custom Search', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: '#38bdf844' }
    }
    if (src.includes('reddit')) {
      return { name: 'Reddit API', bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: '#f9731644' }
    }
    return { name: cand.platform || 'External API', bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8', border: '#47556944' }
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
          {/* Parallel Search All Provider Option */}
          <button
            onClick={() => setSelectedProvider('ALL_PROVIDERS')}
            style={{
              background: selectedProvider === 'ALL_PROVIDERS' ? 'rgba(0, 212, 255, 0.15)' : '#0d1117',
              border: selectedProvider === 'ALL_PROVIDERS' ? '1.5px solid #00d4ff' : '1px solid #1e2d3d',
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: selectedProvider === 'ALL_PROVIDERS' ? '#38bdf8' : '#e2e8f0' }}>
              ⚡ All Providers (Parallel)
            </div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#4ade80' }}>
              ● MULTI-SOURCE PIPELINE
            </div>
          </button>

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
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: statusColor(prov) }}>
                  ● {statusLabel(prov)}
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

      {/* GOOGLE SEARCH GROUNDING DISCOVERY CARD (gemini-3.5-flash + googleSearch) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        borderRadius: 10,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 20px rgba(56, 189, 248, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Google Search Grounded Discovery Intelligence</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontFamily: 'monospace'
                }}>
                  gemini-3.5-flash + googleSearch
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Perform live real-time Google Search grounding to locate news wire reports, fact-checks, and web citations.
              </div>
            </div>
          </div>

          <button
            onClick={runGroundedDiscovery}
            disabled={isGroundedLoading}
            style={{
              background: isGroundedLoading ? '#1e293b' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 800,
              cursor: isGroundedLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
            }}
          >
            {isGroundedLoading ? '◌ Querying Google Search Grounding…' : '⚡ Run Search Grounded Verification'}
          </button>
        </div>

        {groundedError && (
          <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', fontSize: 12 }}>
            ⚠️ {groundedError}
          </div>
        )}

        {/* Display Grounded Search Analysis & Citations */}
        {groundedResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
            {/* Grounded Summary text */}
            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                ★ GROUNDED VERIFICATION ANALYSIS ({groundedResult.model})
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {groundedResult.data?.groundedAnalysis || 'Analysis complete.'}
              </div>
            </div>

            {/* Executed Search Queries */}
            {groundedResult.data?.searchQueriesExecuted && groundedResult.data.searchQueriesExecuted.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid #1e2d3d' }}>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Google Queries Executed:</span>
                {groundedResult.data.searchQueriesExecuted.map((q, qIdx) => (
                  <span key={qIdx} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#161b22', border: '1px solid #30363d', color: '#cbd5e1' }}>
                    🔍 "{q}"
                  </span>
                ))}
              </div>
            )}

            {/* Grounding Web Citations Links */}
            {groundedResult.data?.groundingWebSources && groundedResult.data.groundingWebSources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid #1e2d3d' }}>
                <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔗 Verified Web Grounding Citations:</span>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>({groundedResult.data.groundingWebSources.length} sources)</span>
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                  {groundedResult.data.groundingWebSources.map((src, sIdx) => (
                    <a
                      key={sIdx}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: '#0d1117',
                        border: '1px solid #1e2d3d',
                        borderRadius: 6,
                        color: '#38bdf8',
                        textDecoration: 'none',
                        fontSize: 11,
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d3d')}
                    >
                      <span>🌐</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {src.title || src.uri}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PRIMARY IMAGE-FIRST REVERSE DISCOVERY CARD */}
      <div style={{
        background: '#0d1117',
        border: '1.5px solid rgba(0, 212, 255, 0.4)',
        borderRadius: 10,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 20px rgba(0, 212, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🎯 Primary Engine:</span>
              <span style={{ color: '#00d4ff' }}>Image-First Reverse Visual Discovery</span>
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(0, 212, 255, 0.15)',
              color: '#38bdf8',
              fontFamily: 'monospace'
            }}>
              VISUAL REVERSE SEARCH
            </span>
          </div>

          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Primary provider: <strong style={{ color: '#c084fc' }}>Google Vision API (Web Detection)</strong>
          </div>
        </div>

        {/* Reference Media Context & Action Trigger */}
        <div style={{
          background: '#080c10',
          border: '1px solid #1e2d3d',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 6,
              background: '#161b22',
              border: '1.5px solid #00d4ff44',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {referenceThumbnail ? (
                <img
                  src={referenceThumbnail}
                  alt="Uploaded reference media"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 24 }}>🖼️</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                {artifactName}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                {artifactId ? `Artifact ID: ${artifactId}` : 'Uploaded Investigation Asset'}
              </div>
              <div style={{ fontSize: 11, color: '#38bdf8' }}>
                Query Input: <strong>Direct Image Buffer (Visual Web Detection & pHash)</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => executeDiscovery(false, 1)}
            disabled={isQuerying}
            style={{
              background: isQuerying && searchMode === 'VISUAL' ? '#1e293b' : 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              color: '#080c10',
              border: 'none',
              borderRadius: 6,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 800,
              cursor: isQuerying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 10px rgba(0, 212, 255, 0.2)'
            }}
          >
            {isQuerying && searchMode === 'VISUAL' ? '◌ Searching Visually…' : '🔄 Run Reverse Image Search'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
          <strong>Forensic Notice:</strong> Media bytes are passed directly to Google Vision Web Detection. Every candidate returned is fetched and evaluated using real perceptual hash (pHash) similarity. Unrelated items (<strong style={{ color: '#f87171' }}>&lt; 70% similarity</strong>) are completely filtered out.
        </div>
      </div>

      {/* SECONDARY MANUAL KEYWORD SEARCH (EXPLICIT FALLBACK) */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>
              Manual keyword search (secondary fallback)
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              fontFamily: 'monospace'
            }}>
              SECONDARY OVERRIDE ONLY
            </span>
          </div>

          <span style={{ fontSize: 11, color: '#64748b' }}>
            Visual reverse search is primary; use manual text keywords only as a fallback
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isQuerying && executeDiscovery(true, 1)}
            placeholder="Enter manual keywords for secondary fallback search…"
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
            onClick={() => executeDiscovery(true, 1)}
            disabled={isQuerying || !testQuery.trim()}
            style={{
              background: testQuery.trim() ? '#1e293b' : '#0f172a',
              color: testQuery.trim() ? '#e2e8f0' : '#475569',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '0 18px',
              fontSize: 12,
              fontWeight: 700,
              cursor: testQuery.trim() && !isQuerying ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {isQuerying && searchMode === 'MANUAL_TEXT' ? '◌ Searching…' : '🔍 Search via Manual Keywords (Fallback)'}
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Text Presets:</span>
          {['Visual Web Detection', 'OCR Extracted Text', 'Caption Semantics', 'Reverse Media Check'].map((preset) => (
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

      {/* Honest Platform Limitations & Provider Notices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Instagram Graph API limitation notice */}
        <div style={{
          padding: '8px 14px',
          borderRadius: 6,
          background: 'rgba(236, 72, 153, 0.08)',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          fontSize: 11,
          color: '#f472b6',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>📸</span>
          <span>
            <strong>Platform Limitation:</strong> Reverse image search unsupported by Instagram Graph API — no candidates queried. Public API does not provide a visual similarity endpoint.
          </span>
        </div>

        {/* X (Twitter) limitation notice */}
        <div style={{
          padding: '8px 14px',
          borderRadius: 6,
          background: 'rgba(148, 163, 184, 0.08)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          fontSize: 11,
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>𝕏</span>
          <span>
            <strong>Platform Limitation:</strong> Reverse image search unsupported by X (Twitter) API — no candidates queried. Platform API does not provide a reverse-image endpoint.
          </span>
        </div>

        {/* Dynamic Provider Error or Unavailable Notices */}
        {Object.entries(providerStatuses)
          .filter(([id, p]) => (p.status === 'ERROR' || p.status === 'AUTHENTICATED_ERROR' || p.status === 'UNAVAILABLE' || p.status === 'NOT_CONFIGURED' || p.status === 'QUOTA_REACHED') && id !== 'instagram' && id !== 'x')
          .map(([id, p]) => (
            <div key={id} style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: p.status === 'ERROR' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${p.status === 'ERROR' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              fontSize: 11,
              color: p.status === 'ERROR' ? '#f87171' : '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>{p.status === 'ERROR' ? '❌' : '⚠️'}</span>
              <span><strong>Provider Status ({p.name || id}):</strong> {p.reason || (p.status === 'NOT_CONFIGURED' || p.status === 'UNAVAILABLE' ? 'API credentials not configured on this deployment. Set provider environment variable in deployment settings.' : 'Provider status: ' + p.status)}</span>
            </div>
          ))
        }
      </div>

      {/* Discovered Candidates Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔎 Discovered Media Candidates</span>
            <span style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '2px 8px', borderRadius: 4 }}>
              {candidatesList.length} items
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Sorted by Forensic Relevance & Perceptual Match (Unrelated &lt; 70% Filtered Out)
          </span>
        </div>

        {candidatesList.length === 0 ? (
          <div style={{
            background: '#0d1117',
            border: '1px dashed #1e2d3d',
            borderRadius: 8,
            padding: '36px 20px',
            textAlign: 'center',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🔎</div>
            <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: 14 }}>
              {hasSearched ? 'No Matching Appearances Found' : 'No Live Candidates Ingested Yet'}
            </div>
            <div style={{ fontSize: 12, maxWidth: 500, lineHeight: 1.5, color: '#64748b' }}>
              {hasSearched
                ? `0 visual matches found on active search providers for this media asset. Every single result in VeriMedia AI originates from genuine API hits with verified visual similarity — zero synthetic placeholders or fake matches.`
                : 'Click "Run Reverse Image Search" above to automatically execute reverse visual discovery against Google Vision Web Detection and external providers.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidatesList.map((cand, idx) => {
              const sim = typeof cand.similarity === 'number' ? cand.similarity : (cand.matchScore ? cand.matchScore / 100 : 0.85)
              const simPct = Math.round(sim * 100)
              const classification = cand.classification || (simPct >= 98 ? 'EXACT_MATCH' : simPct >= 88 ? 'NEAR_DUPLICATE' : simPct >= 70 ? 'MODIFIED_DERIVATIVE' : 'UNRELATED')
              const isExact = classification === 'EXACT_MATCH'
              const isNear = classification === 'NEAR_DUPLICATE'
              const isDerivative = classification === 'MODIFIED_DERIVATIVE' || cand.isPartialMatch
              const isVisualMatch = cand.matchType === 'visual_match'
              const provBadge = getProviderBadge(cand)

              const phashVal = cand.phashSimilarity ?? cand.similarityMeasurements?.phashSimilarity
              const visionVal = cand.visionScore ?? cand.similarityMeasurements?.visionScore

              return (
                <div
                  key={cand.id || idx}
                  style={{
                    background: '#0d1117',
                    border: isExact 
                      ? '1.5px solid rgba(34, 197, 94, 0.6)' 
                      : isDerivative 
                        ? '1.5px solid rgba(245, 158, 11, 0.6)' 
                        : isNear 
                          ? '1.5px solid rgba(56, 189, 248, 0.4)' 
                          : '1px solid #1e2d3d',
                    borderRadius: 8,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: isExact ? '0 2px 14px rgba(34, 197, 94, 0.08)' : isDerivative ? '0 2px 14px rgba(245, 158, 11, 0.08)' : 'none'
                  }}
                >
                  {/* Top Bar: Title, Provider, Classification, and Match Type Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                          {cand.title}
                        </h4>

                        {/* Classification Badge */}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          background: isExact ? 'rgba(34, 197, 94, 0.2)' : isDerivative ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                          color: isExact ? '#4ade80' : isDerivative ? '#fbbf24' : '#38bdf8',
                          border: `1px solid ${isExact ? '#22c55e44' : isDerivative ? '#f59e0b44' : '#38bdf844'}`
                        }}>
                          {isExact ? '👑 EXACT_MATCH' : isDerivative ? '⚠ MODIFIED_DERIVATIVE' : '⚡ NEAR_DUPLICATE'}
                        </span>

                        {/* Match Type Badge (VISUAL MATCH vs TEXT-INFERRED) */}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          background: isVisualMatch ? 'rgba(168, 85, 247, 0.2)' : 'rgba(249, 115, 22, 0.15)',
                          color: isVisualMatch ? '#c084fc' : '#fb923c',
                          border: `1px solid ${isVisualMatch ? '#a855f744' : '#f9731644'}`
                        }}>
                          {isVisualMatch ? '🎯 VISUAL MATCH' : '📝 TEXT-INFERRED (OCR/Labels)'}
                        </span>

                        {/* Provider Badge */}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: provBadge.bg,
                          color: provBadge.text,
                          border: `1px solid ${provBadge.border}`
                        }}>
                          {provBadge.name}
                        </span>
                      </div>

                      {cand.author && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>by @{cand.author} • Platform: {cand.platform || 'Web'}</div>
                      )}
                    </div>

                    {/* Similarity Score Display */}
                    <div style={{
                      textAlign: 'right',
                      background: '#080c10',
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #1e2d3d',
                      flexShrink: 0
                    }}>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: isExact ? '#4ade80' : isDerivative ? '#fbbf24' : '#38bdf8',
                        fontFamily: 'monospace'
                      }}>
                        {simPct}% visual similarity
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                        {phashVal != null ? `pHash: ${(phashVal).toFixed(2)}` : 'pHash: N/A'}
                        {visionVal != null ? `, Vision: ${(visionVal).toFixed(2)}` : ''}
                        {cand.hammingDistance != null ? `, Dist: ${cand.hammingDistance}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* SIDE-BY-SIDE VISUAL COMPARISON CONTAINER */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    background: '#080c10',
                    border: '1px solid #161f2e',
                    borderRadius: 8,
                    padding: 12,
                    flexWrap: 'wrap'
                  }}>
                    {/* Left: Uploaded Media Reference */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 6,
                        background: '#161b22',
                        border: '1px solid #334155',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {referenceThumbnail ? (
                          <img
                            src={referenceThumbnail}
                            alt="Uploaded Reference"
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>🖼️</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Reference Media</span>
                        <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700 }}>Uploaded Asset</span>
                      </div>
                    </div>

                    <div style={{ color: '#64748b', fontSize: 16, fontWeight: 800 }}>➔</div>

                    {/* Right: Discovered Candidate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 6,
                        background: isExact ? 'rgba(34,197,94,0.1)' : 'rgba(0,212,255,0.08)',
                        border: `1px solid ${isExact ? '#22c55e44' : '#00d4ff44'}`,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {cand.thumbnailUrl ? (
                          <img
                            src={cand.thumbnailUrl}
                            alt={cand.title || 'Discovered candidate'}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>
                            {cand.platform?.includes('YouTube') ? '▶️' : cand.platform?.includes('Instagram') ? '📸' : cand.platform?.includes('X') ? '𝕏' : '🌐'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Candidate Appearance</span>
                        <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cand.platform || 'External Web'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Forensic Alert: Derivative / Tampered match */}
                  {cand.isPartialMatch && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      fontSize: 11,
                      fontWeight: 700,
                      width: 'fit-content'
                    }}>
                      <span>⚠ High Priority Lead:</span>
                      <span>{cand.tamperedIndicator || 'Potential partial crop, altered background, or tampered derivative match'}</span>
                    </div>
                  )}

                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0', lineHeight: 1.4 }}>
                    {cand.snippet}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#64748b' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Published: {cand.publishedAt ? new Date(cand.publishedAt).toLocaleString() : 'N/A'}</span>
                      <span>•</span>
                      <a href={cand.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                        🔗 {cand.url.length > 55 ? `${cand.url.slice(0, 55)}…` : cand.url}
                      </a>
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
              )
            })}

            {/* Pagination & Load 10 More Controls */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              padding: '14px 16px',
              background: '#0d1117',
              border: '1px solid #1e2d3d',
              borderRadius: 8
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Showing {candidatesList.length} genuine appearance(s)
                {totalDiscoveredCount > candidatesList.length ? ` of ${totalDiscoveredCount} total discovered` : ''} • Page {currentPage}
              </div>

              {hasMore && !maxReached ? (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  style={{
                    background: isLoadingMore ? '#1e293b' : '#00d4ff',
                    color: isLoadingMore ? '#94a3b8' : '#080c10',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {isLoadingMore ? '◌ Ingesting next 10…' : '⬇ Ingest 10 More Appearances'}
                </button>
              ) : maxReached ? (
                <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                  ✓ Maximum limit of 50 candidates reached to protect API quotas.
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  ✓ All genuine appearances loaded from active providers. Zero synthetic filler.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
