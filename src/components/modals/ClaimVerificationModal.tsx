import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
  Layers,
  Sparkles,
  Share2,
  RefreshCw,
  FolderPlus,
  Tv,
  MessageSquare,
  FileText,
  X,
  Radio,
  Clock,
  BarChart3,
  Image as ImageIcon
} from 'lucide-react'
import { useStore } from '../../store'
import { verifyMediaClaim, type ClaimVerificationResult } from '../../services/api'

const QUICK_SUGGESTIONS = [
  { label: 'Pope White Puffer Jacket', query: 'Pope Francis in white puffer jacket Midjourney' },
  { label: 'Pentagon Explosion Image', query: 'Deepfake image of Pentagon explosion May 2023' },
  { label: 'Dubai Flood Animal Rescue', query: 'Cat rescued in Dubai flood viral video' },
  { label: 'Apollo Moon Landing Flag', query: 'Apollo 11 moon landing flag waving in vacuum' },
  { label: 'World Leader Deepfake', query: 'Deepfake video of Ukrainian President surrender' },
]

export function ClaimVerificationModal() {
  const {
    showClaimModal,
    closeClaimModal,
    claimInitialQuery,
    claimResult,
    setClaimResult,
    claimLoading,
    setClaimLoading,
    claimError,
    setClaimError,
    setActiveTab,
    setCases,
    cases,
    addVerificationJob,
    updateVerificationJob,
    setSelectedVerificationJobId,
    setShowVerificationHistoryDrawer,
    setActiveHistoryTab
  } = useStore()

  const [query, setQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<'all' | 'google' | 'youtube' | 'reddit'>('all')
  const [activeTab, setActiveTabLocal] = useState<'verdict' | 'factchecks' | 'youtube' | 'images' | 'social' | 'queries'>('verdict')
  const [copied, setCopied] = useState(false)
  const [caseCreated, setCaseCreated] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize query when modal opens
  useEffect(() => {
    if (showClaimModal) {
      const q = claimInitialQuery || query
      if (q) {
        setQuery(q)
        handleVerify(q, selectedSource)
      } else {
        setTimeout(() => inputRef.current?.focus(), 150)
      }
    }
  }, [showClaimModal, claimInitialQuery])

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showClaimModal) {
        closeClaimModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showClaimModal, closeClaimModal])

  const handleVerify = async (searchQuery: string, source: string) => {
    const targetQuery = searchQuery.trim()
    if (!targetQuery) return

    setClaimLoading(true)
    setClaimError(null)
    setCaseCreated(false)

    const jobId = `VERIFY-JOB-${Date.now().toString().slice(-6)}`
    const startTime = Date.now()

    // Add running entry to session history
    addVerificationJob({
      id: jobId,
      query: targetQuery,
      timestamp: new Date().toISOString(),
      status: 'RUNNING',
      verdict: 'UNVERIFIED',
      verdictLabel: 'Verification In Progress...',
      confidence: 0,
      veracityScore: 50,
      headlineSummary: 'Querying Google Search Grounding API, Reuters/Snopes, and video corroboration...',
      totalSourcesCount: 0,
      googleFindingsCount: 0,
      factCheckCount: 0,
      youtubeCount: 0,
      socialCount: 0,
      searchQueriesExecuted: [targetQuery],
      findings: [],
      provider: 'Google Search API Grounding'
    })

    try {
      const platforms = source === 'all' ? ['google', 'youtube', 'reddit', 'mastodon'] : [source]
      const result = await verifyMediaClaim({
        query: targetQuery,
        platforms
      })
      setClaimResult(result)
      setActiveTabLocal('verdict')

      // Record completed job with detailed findings
      updateVerificationJob(jobId, {
        status: 'COMPLETED',
        verdict: result.verdict,
        verdictLabel: result.verdictLabel,
        confidence: result.confidence || 0.92,
        veracityScore: result.veracityScore || 50,
        headlineSummary: result.headlineSummary,
        explanation: result.explanation,
        totalSourcesCount: result.totalSourcesCount || 0,
        googleFindingsCount: result.googleSearch?.cseResults?.length || 0,
        factCheckCount: result.factCheckArticles?.length || 0,
        youtubeCount: result.youtube?.results?.length || 0,
        socialCount: (result.reddit?.count || 0) + (result.mastodon?.count || 0),
        searchQueriesExecuted: result.googleSearch?.searchQueriesExecuted || [targetQuery],
        findings: [
          ...(result.factCheckArticles || []).map((art, idx) => ({
            id: `fc-${idx}-${Date.now()}`,
            title: art.title,
            url: art.url || '#',
            domain: art.publisher ? art.publisher.toLowerCase().replace(/[^a-z0-9.]/g, '') + '.com' : 'factcheck.org',
            sourceType: 'fact_check' as const,
            confidenceScore: Math.min(0.99, Math.max(0.85, (result.confidence || 0.9))),
            veracityScore: result.veracityScore,
            publisher: art.publisher,
            publishedDate: art.publishedDate || undefined,
            snippet: art.summary,
            verdictTag: art.verdict || result.verdictLabel
          })),
          ...(result.googleSearch?.groundedWebSources || []).map((src, idx) => ({
            id: `gw-${idx}-${Date.now()}`,
            title: src.title,
            url: src.uri,
            domain: (() => { try { return new URL(src.uri).hostname.replace('www.', '') } catch { return 'google.com' } })(),
            sourceType: 'grounded_source' as const,
            confidenceScore: Math.min(0.98, Math.max(0.88, (result.confidence || 0.92) - (idx * 0.02))),
            veracityScore: result.veracityScore,
            snippet: 'Grounded citation extracted from real-time Google Search indexing.',
            verdictTag: 'Corroborating Source'
          })),
          ...(result.googleSearch?.cseResults || []).map((cse, idx) => ({
            id: `cse-${idx}-${Date.now()}`,
            title: cse.title,
            url: cse.url || '#',
            domain: cse.publisher || 'news.google.com',
            sourceType: 'cse_web' as const,
            confidenceScore: Math.min(0.95, Math.max(0.75, (result.confidence || 0.85) - (idx * 0.03))),
            snippet: cse.snippet,
            verdictTag: 'Web Result'
          })),
          ...(result.youtube?.results || []).map((yt, idx) => ({
            id: `yt-${idx}-${Date.now()}`,
            title: yt.title,
            url: yt.url || '#',
            domain: 'youtube.com',
            sourceType: 'youtube_video' as const,
            confidenceScore: Math.min(0.92, Math.max(0.7, (result.confidence || 0.8) - (idx * 0.04))),
            snippet: yt.snippet,
            verdictTag: 'Video Corroboration'
          }))
        ],
        latencyMs: Date.now() - startTime,
        rawResult: result
      })
    } catch (err: any) {
      console.error('[ClaimVerify] Verification error:', err)
      const message = err?.response?.data?.error || err?.message || 'Verification request failed'
      setClaimError(message)
      updateVerificationJob(jobId, {
        status: 'FAILED',
        headlineSummary: message,
        confidence: 0
      })
    } finally {
      setClaimLoading(false)
    }
  }

  const handleCreateCaseFromClaim = () => {
    if (!claimResult) return

    const newCaseId = `CASE-VERIFY-${Date.now().toString().slice(-6)}`
    const newCase = {
      id: newCaseId,
      title: `Media Claim: ${claimResult.query.slice(0, 60)}`,
      status: claimResult.verdict === 'CONFIRMED_AUTHENTIC' ? 'RESOLVED' : 'ACTIVE',
      severity: claimResult.veracityScore < 40 ? 'CRITICAL' : 'MEDIUM',
      threatScore: 100 - claimResult.veracityScore,
      platform: 'MULTI_SOURCE_SEARCH',
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: `Verified via Google Search API and YouTube. Verdict: ${claimResult.verdictLabel}. Veracity: ${claimResult.veracityScore}%. Explanation: ${claimResult.explanation.slice(0, 200)}...`,
      claimCount: claimResult.factCheckArticles.length,
      evidenceCount: claimResult.totalSourcesCount,
      artifactCount: (claimResult.youtube?.results?.length || 0) + (claimResult.googleSearch?.cseResults?.length || 0)
    }

    setCases([newCase as any, ...cases])
    setCaseCreated(true)
  }

  const handleCopyReport = () => {
    if (!claimResult) return

    const markdownReport = `# VeriMedia AI — Claim Verification Dossier
**Target Claim / Headline:** "${claimResult.query}"
**Verified At:** ${new Date(claimResult.queriedAt).toLocaleString()}
**Verdict:** ${claimResult.verdictLabel} (${claimResult.verdict})
**Veracity Score:** ${claimResult.veracityScore}/100
**Confidence Rating:** ${Math.round(claimResult.confidence * 100)}%

## Headline Summary
${claimResult.headlineSummary}

## Detailed Grounded Explanation
${claimResult.explanation}

## Key Verification Findings
${claimResult.keyFindings.map((f, idx) => `${idx + 1}. ${f}`).join('\n')}

${claimResult.debunkReason ? `## Manipulation / Debunk Origin\n${claimResult.debunkReason}\n` : ''}

## Verified News & Fact-Check Reports (${claimResult.factCheckArticles.length})
${claimResult.factCheckArticles.map(a => `- **[${a.publisher || 'Source'}]** ${a.title} (${a.url || 'No URL'}) — Verdict: ${a.verdict || 'N/A'}`).join('\n')}

## YouTube Coverage (${claimResult.youtube?.results?.length || 0})
${(claimResult.youtube?.results || []).map(y => `- **[YouTube - ${y.publisher}]** ${y.title} (${y.url})`).join('\n')}

## Grounded Web Citations (${claimResult.googleSearch?.groundedWebSources?.length || 0})
${(claimResult.googleSearch?.groundedWebSources || []).map(g => `- ${g.title}: ${g.uri}`).join('\n')}
`

    navigator.clipboard.writeText(markdownReport).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (!showClaimModal) return null

  const getVerdictVisuals = (verdict?: string) => {
    switch (verdict) {
      case 'CONFIRMED_AUTHENTIC':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: '#10b981',
          text: '#34d399',
          icon: <ShieldCheck size={22} className="text-emerald-400" />,
          label: 'AUTHENTIC & CONFIRMED',
          barColor: '#10b981'
        }
      case 'DEBUNKED_FALSE':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          border: '#ef4444',
          text: '#f87171',
          icon: <ShieldAlert size={22} className="text-rose-400" />,
          label: 'DEBUNKED AS FALSE / HOAX',
          barColor: '#ef4444'
        }
      case 'AI_GENERATED':
        return {
          bg: 'rgba(168, 85, 247, 0.12)',
          border: '#a855f7',
          text: '#c084fc',
          icon: <Sparkles size={22} className="text-purple-400" />,
          label: 'AI-GENERATED SYNTHETIC MEDIA',
          barColor: '#a855f7'
        }
      case 'MISLEADING':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: '#f59e0b',
          text: '#fbbf24',
          icon: <AlertTriangle size={22} className="text-amber-400" />,
          label: 'MISLEADING / OUT OF CONTEXT',
          barColor: '#f59e0b'
        }
      default:
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: '#0284c7',
          text: '#38bdf8',
          icon: <HelpCircle size={22} className="text-sky-400" />,
          label: 'UNDER INVESTIGATION / DEVELOPING',
          barColor: '#38bdf8'
        }
    }
  }

  const visuals = getVerdictVisuals(claimResult?.verdict)

  return (
    <div
      id="claim-verification-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeClaimModal}
    >
      <div
        id="claim-verification-modal-dialog"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b1118] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-100"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <Globe size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Claim & News Headline Verification
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                  Google Search & YouTube API
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cross-references viral claims against Google Grounding index, YouTube broadcasts, and verified fact-check databases.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowVerificationHistoryDrawer(true)
                setActiveHistoryTab('recharts')
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open Recharts analytics matrix in side-panel"
            >
              <BarChart3 size={14} />
              <span className="hidden sm:inline">Recharts Analytics</span>
            </button>

            <button
              id="btn-close-claim-modal"
              onClick={closeClaimModal}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
              title="Close (ESC)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Control Box */}
        <div className="p-5 border-b border-slate-800/80 bg-gradient-to-b from-[#0e1622] to-[#0b1118]">
          <form
            onSubmit={e => {
              e.preventDefault()
              handleVerify(query, selectedSource)
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" size={18} />
                <input
                  ref={inputRef}
                  id="claim-verification-input"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Enter a media claim, viral headline, or rumor (e.g., Pope white puffer jacket, breaking news)..."
                  className="w-full pl-11 pr-10 py-3 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-sm text-white placeholder-slate-500 transition-all shadow-inner outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Source Selector Dropdown / Pill */}
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
                {(
                  [
                    { id: 'all', label: 'All Sources' },
                    { id: 'google', label: 'Google Search' },
                    { id: 'youtube', label: 'YouTube' },
                    { id: 'reddit', label: 'Social' },
                  ] as const
                ).map(src => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => {
                      setSelectedSource(src.id)
                      if (query.trim()) handleVerify(query, src.id)
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      selectedSource === src.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>

              <button
                id="btn-execute-claim-verification"
                type="submit"
                disabled={claimLoading || !query.trim()}
                className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                {claimLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>Verify Claim</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Radio size={12} className="text-cyan-400" /> Trending Claims:
              </span>
              {QUICK_SUGGESTIONS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setQuery(item.query)
                    handleVerify(item.query, selectedSource)
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-cyan-950/60 hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-700/60 text-slate-300 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Loading Animation State */}
          {claimLoading && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <Globe className="absolute inset-0 m-auto text-cyan-400" size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cross-Referencing Multi-Source Evidence...</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Querying live Google Search grounding index, analyzing YouTube video uploads, and retrieving news agency fact-check records.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {claimError && !claimLoading && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-3 text-rose-200">
              <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <div className="font-semibold text-rose-300">Verification Query Interrupted</div>
                <div>{claimError}</div>
              </div>
            </div>
          )}

          {/* Empty State before any search */}
          {!claimResult && !claimLoading && !claimError && (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Search size={28} />
              </div>
              <h3 className="text-base font-bold text-white">Instant News Headline & Claim Verification</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                Type any viral headline, deepfake rumor, or breaking social claim into the search bar above. VeriMedia AI will query the Google Search API, scan YouTube broadcasts, and cross-reference credible news wire fact checks in real time.
              </p>
            </div>
          )}

          {/* Result Presentation */}
          {claimResult && !claimLoading && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Verdict Summary Header Banner */}
              <div
                className="p-5 rounded-2xl border transition-all"
                style={{ backgroundColor: visuals.bg, borderColor: visuals.border }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10 shrink-0 mt-0.5">
                      {visuals.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-0.5 text-xs font-mono font-black uppercase tracking-wider rounded-md"
                          style={{ backgroundColor: `${visuals.border}25`, color: visuals.text, border: `1px solid ${visuals.border}50` }}
                        >
                          {visuals.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Confidence: {Math.round(claimResult.confidence * 100)}%
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1.5 leading-snug">
                        {claimResult.headlineSummary || `Verification analysis completed for "${claimResult.query}"`}
                      </h3>
                    </div>
                  </div>

                  {/* Veracity Score Meter Gauge */}
                  <div className="w-full sm:w-56 p-3 rounded-xl bg-black/50 border border-white/10 shrink-0 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Veracity Score</span>
                      <span className="font-bold font-mono text-white text-sm">
                        {claimResult.veracityScore}/100
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, Math.max(5, claimResult.veracityScore))}%`,
                          backgroundColor: visuals.barColor
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0 Fabricated</span>
                      <span>100 Authentic</span>
                    </div>
                  </div>
                </div>

                {/* Debunk / Origin Callout if available */}
                {claimResult.debunkReason && (
                  <div className="mt-4 p-3 rounded-xl bg-black/40 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">Origin / Alteration Mechanism: </span>
                      {claimResult.debunkReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Tabs for Granular Evidence */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTabLocal('verdict')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'verdict'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText size={14} />
                  <span>Overview & Analysis</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabLocal('factchecks')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'factchecks'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>Fact Checks & Wire Reports ({claimResult.factCheckArticles.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabLocal('youtube')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'youtube'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tv size={14} />
                  <span>YouTube Coverage ({claimResult.youtube?.results?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabLocal('images')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'images'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon size={14} />
                  <span>Image Evidence ({claimResult.googleImages?.results?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabLocal('social')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'social'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>Community Signals ({(claimResult.reddit?.results?.length || 0) + (claimResult.mastodon?.results?.length || 0)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabLocal('queries')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'queries'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers size={14} />
                  <span>Search Citations & Raw Data</span>
                </button>
              </div>

              {/* Tab 1: Detailed Overview */}
              {activeTab === 'verdict' && (
                <div className="space-y-4">
                  {/* Detailed Grounded Explanation */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-cyan-400" /> Grounded Forensic Assessment
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {claimResult.explanation}
                    </p>
                  </div>

                  {/* Key Findings List */}
                  {claimResult.keyFindings?.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-400" /> Key Evidentiary Findings
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {claimResult.keyFindings.map((finding, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200 flex items-start gap-2.5"
                          >
                            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{finding}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Summary Counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                      <div className="text-[11px] text-slate-400 font-medium">Fact Checks</div>
                      <div className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                        {claimResult.factCheckArticles.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                      <div className="text-[11px] text-slate-400 font-medium">YouTube Videos</div>
                      <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                        {claimResult.youtube?.results?.length || 0}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                      <div className="text-[11px] text-slate-400 font-medium">Social Posts</div>
                      <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                        {(claimResult.reddit?.results?.length || 0) + (claimResult.mastodon?.results?.length || 0)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                      <div className="text-[11px] text-slate-400 font-medium">Grounded Sources</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                        {claimResult.googleSearch?.groundedWebSources?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Fact Checks & Wire Reports */}
              {activeTab === 'factchecks' && (
                <div className="space-y-3">
                  {claimResult.factCheckArticles.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                      No standalone fact-check articles retrieved. Review Google Search citations in Tab 5.
                    </div>
                  ) : (
                    claimResult.factCheckArticles.map((article, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                              {article.publisher || 'Verified Publisher'}
                            </span>
                            {article.verdict && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 text-slate-300">
                                Rating: {article.verdict}
                              </span>
                            )}
                            {article.publishedDate && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Clock size={12} /> {article.publishedDate}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {article.title}
                          </h4>
                          {article.summary && (
                            <p className="text-xs text-slate-300 line-clamp-2">
                              {article.summary}
                            </p>
                          )}
                        </div>

                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1.5"
                          >
                            <span>Inspect Article</span>
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: YouTube Broadcasts & Video Evidence */}
              {activeTab === 'youtube' && (
                <div className="space-y-3">
                  {(!claimResult.youtube?.results || claimResult.youtube.results.length === 0) ? (
                    <div className="py-10 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                      No matching YouTube video broadcasts found for this query.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {claimResult.youtube.results.map((video, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 transition-all flex gap-3 group"
                        >
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-28 h-20 object-cover rounded-lg shrink-0 border border-slate-700 bg-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-28 h-20 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-rose-400">
                              <Tv size={24} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                                <Tv size={12} />
                                <span>{video.publisher || 'YouTube Broadcast'}</span>
                              </div>
                              <h5 className="text-xs font-bold text-white line-clamp-2 mt-0.5 group-hover:text-rose-300 transition-colors">
                                {video.title}
                              </h5>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                              <span>{video.publishedDate || 'Recent'}</span>
                              {video.url && (
                                <a
                                  href={video.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                                >
                                  <span>Watch Video</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3.5: Discovered Media & Images */}
              {activeTab === 'images' && (
                <div className="space-y-3">
                  {(!claimResult.googleImages?.results || claimResult.googleImages.results.length === 0) ? (
                    <div className="py-10 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                      No matching image references found for this query. Check Google Citations in Tab 5.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {claimResult.googleImages.results.map((img, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-2">
                            {img.imageUrl ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-700 bg-slate-800 relative">
                                <img
                                  src={img.imageUrl}
                                  alt={img.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none'
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="aspect-video w-full rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                                <ImageIcon size={24} />
                              </div>
                            )}
                            <div className="text-[10px] text-cyan-400 font-mono font-semibold truncate">
                              {img.publisher || 'Web Reference'}
                            </div>
                            <h6 className="text-[11px] font-medium text-slate-200 line-clamp-2 leading-tight">
                              {img.title}
                            </h6>
                          </div>

                          {img.url && (
                            <div className="mt-2 pt-2 border-t border-slate-800 flex justify-end">
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                              >
                                <span>Inspect Source</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Community Signals (Reddit & Mastodon) */}
              {activeTab === 'social' && (
                <div className="space-y-3">
                  {(!claimResult.reddit?.results || claimResult.reddit.results.length === 0) &&
                  (!claimResult.mastodon?.results || claimResult.mastodon.results.length === 0) ? (
                    <div className="py-10 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                      No community discussions or social signals found for this exact query.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Reddit Posts */}
                      {(claimResult.reddit?.results || []).map((post, idx) => (
                        <div
                          key={`reddit-${idx}`}
                          className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 text-[10px] text-amber-400 font-mono font-bold">
                              <span>Reddit ({post.subreddit || 'r/all'})</span>
                              {post.author && <span className="text-slate-500">by {post.author}</span>}
                              {post.publishedDate && <span className="text-slate-500">• {post.publishedDate}</span>}
                            </div>
                            <div className="text-slate-200 font-medium truncate">{post.title}</div>
                          </div>
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[11px] font-medium flex items-center gap-1"
                            >
                              <span>View Post</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}

                      {/* Mastodon Statuses */}
                      {(claimResult.mastodon?.results || []).map((post, idx) => (
                        <div
                          key={`mastodon-${idx}`}
                          className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 text-[10px] text-purple-400 font-mono font-bold">
                              <span>Mastodon Federated</span>
                              {post.publisher && <span className="text-slate-500">{post.publisher}</span>}
                              {post.publishedDate && <span className="text-slate-500">• {post.publishedDate}</span>}
                            </div>
                            <div className="text-slate-200 font-medium truncate">{post.title}</div>
                          </div>
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[11px] font-medium flex items-center gap-1"
                            >
                              <span>View Toot</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Google Grounded Queries & Web Citations */}
              {activeTab === 'queries' && (
                <div className="space-y-4 text-xs">
                  {/* Web Search Queries Executed */}
                  {claimResult.googleSearch?.searchQueriesExecuted?.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Search size={13} className="text-cyan-400" /> Queries Executed by Google Search API
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {claimResult.googleSearch.searchQueriesExecuted.map((q, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md bg-slate-800 text-cyan-300 font-mono text-[11px] border border-cyan-500/20"
                          >
                            "{q}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded Web Sources */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe size={13} className="text-cyan-400" /> Live Google Search Grounded Web Sources
                    </div>
                    {claimResult.googleSearch?.groundedWebSources?.length === 0 ? (
                      <div className="text-slate-500">No raw grounding chunks provided.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {claimResult.googleSearch.groundedWebSources.map((g, idx) => (
                          <a
                            key={idx}
                            href={g.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-cyan-400 hover:text-cyan-300 flex items-center justify-between transition-colors"
                          >
                            <span className="truncate font-medium">{g.title || g.uri}</span>
                            <ExternalLink size={13} className="shrink-0 ml-2" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Controls */}
        <div className="px-5 py-3.5 border-t border-slate-800/80 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Multi-Source Engine: Google Search API Grounding, YouTube Data API & Open Social Feeds</span>
          </div>

          <div className="flex items-center gap-2">
            {claimResult && (
              <>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Dossier Copied!' : 'Copy Dossier'}</span>
                </button>

                <button
                  type="button"
                  disabled={caseCreated}
                  onClick={handleCreateCaseFromClaim}
                  className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FolderPlus size={14} />
                  <span>{caseCreated ? '✓ Case Created' : 'Create Case'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeClaimModal()
                    setActiveTab('intelligence')
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>Ask Gemini</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={closeClaimModal}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
