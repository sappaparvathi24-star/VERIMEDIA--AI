import { useState, useEffect, useMemo, useRef } from 'react'
import { networkLogger, type NetworkLogEntry, type DataFidelity, type HttpMethod } from '../../services/networkLogger'
import { getHealth, listInvestigations, detect, getProviders } from '../../services/api'

export function DebugPanel() {
  const [logs, setLogs] = useState<NetworkLogEntry[]>(networkLogger.getLogs())
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id || null)
  const [isRecording, setIsRecording] = useState<boolean>(networkLogger.getRecordingStatus())
  const [autoScroll, setAutoScroll] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'response' | 'request' | 'headers' | 'curl'>('audit')
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [isProbing, setIsProbing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR' | 'PENDING'>('ALL')
  const [methodFilter, setMethodFilter] = useState<'ALL' | HttpMethod>('ALL')
  const [fidelityFilter, setFidelityFilter] = useState<'ALL' | 'REAL_ONLY' | 'FALLBACK_ONLY' | DataFidelity>('ALL')

  const listEndRef = useRef<HTMLDivElement>(null)

  // Subscribe to real-time network logs
  useEffect(() => {
    const unsubscribe = networkLogger.subscribe((updatedLogs) => {
      setLogs(updatedLogs)
      if (!selectedLogId && updatedLogs.length > 0) {
        setSelectedLogId(updatedLogs[0].id)
      }
    })
    return () => unsubscribe()
  }, [selectedLogId])

  // Selected Log Entry
  const selectedLog = useMemo(() => {
    return logs.find(l => l.id === selectedLogId) || logs[0] || null
  }, [logs, selectedLogId])

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchUrl = log.url.toLowerCase().includes(q) || log.fullUrl.toLowerCase().includes(q)
        const matchSummary = log.fidelitySummary.toLowerCase().includes(q)
        const matchReq = log.requestBody ? JSON.stringify(log.requestBody).toLowerCase().includes(q) : false
        const matchRes = log.responseBody ? JSON.stringify(log.responseBody).toLowerCase().includes(q) : false
        if (!matchUrl && !matchSummary && !matchReq && !matchRes) return false
      }

      // Status
      if (statusFilter === 'SUCCESS' && (log.state !== 'success' || (log.status && log.status >= 400))) return false
      if (statusFilter === 'ERROR' && (log.state !== 'error' && (!log.status || log.status < 400))) return false
      if (statusFilter === 'PENDING' && log.state !== 'pending') return false

      // Method
      if (methodFilter !== 'ALL' && log.method !== methodFilter) return false

      // Fidelity
      if (fidelityFilter === 'REAL_ONLY' && !log.isRealData) return false
      if (fidelityFilter === 'FALLBACK_ONLY' && log.isRealData) return false
      if (fidelityFilter !== 'ALL' && fidelityFilter !== 'REAL_ONLY' && fidelityFilter !== 'FALLBACK_ONLY' && log.fidelity !== fidelityFilter) return false

      return true
    })
  }, [logs, searchQuery, statusFilter, methodFilter, fidelityFilter])

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length
    if (total === 0) return { total: 0, realCount: 0, realRatio: 0, avgDuration: 0, errorCount: 0 }

    const realCount = logs.filter(l => l.isRealData).length
    const errorCount = logs.filter(l => l.state === 'error' || (l.status && l.status >= 400)).length
    const completed = logs.filter(l => l.state !== 'pending')
    const avgDuration = completed.length > 0 
      ? Math.round(completed.reduce((acc, l) => acc + l.durationMs, 0) / completed.length) 
      : 0

    return {
      total,
      realCount,
      realRatio: Math.round((realCount / total) * 100),
      avgDuration,
      errorCount
    }
  }, [logs])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const handleToggleRecord = () => {
    const active = networkLogger.toggleRecording()
    setIsRecording(active)
  }

  const handleClearLogs = () => {
    networkLogger.clear()
    setSelectedLogId(null)
  }

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verimedia-network-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Live Forensic Probe — sends real backend requests to demonstrate verification
  const handleRunLiveProbe = async () => {
    setIsProbing(true)
    try {
      // 1. Health check
      await getHealth()
      // 2. Query investigations database
      await listInvestigations()
      // 3. Provider discovery status
      await getProviders()
      // 4. Sample real detection scan
      await detect({
        platform: 'YouTube',
        username: 'live_network_probe',
        caption: 'Automated live verification probe for data fidelity audit',
        content_type: 'news',
        scenario: 'normal',
      })
    } catch (err) {
      console.warn('Probe error:', err)
    } finally {
      setIsProbing(false)
    }
  }

  const getMethodBadgeClass = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'bg-sky-950 text-sky-400 border-sky-800'
      case 'POST': return 'bg-emerald-950 text-emerald-400 border-emerald-800'
      case 'PATCH': return 'bg-amber-950 text-amber-400 border-amber-800'
      case 'DELETE': return 'bg-rose-950 text-rose-400 border-rose-800'
      default: return 'bg-slate-900 text-slate-300 border-slate-700'
    }
  }

  const getFidelityBadge = (fidelity: DataFidelity, isReal: boolean) => {
    if (!isReal) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-800/80">
          ⚠️ FALLBACK
        </span>
      )
    }
    switch (fidelity) {
      case 'REAL_FORENSICS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-700/80">
            🔬 REAL FORENSICS
          </span>
        )
      case 'GEMINI_AI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-950/90 text-purple-300 border border-purple-700/80">
            ✨ GEMINI MULTIMODAL
          </span>
        )
      case 'CLOUD_DATABASE':
      case 'PERSISTENCE_STORE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-700/80">
            🗄️ PERSISTED STORE
          </span>
        )
      case 'DISCOVERY_PROVIDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-950/90 text-blue-300 border border-blue-700/80">
            🌐 PROVIDER SEARCH
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900 text-slate-300 border border-slate-700">
            ✅ VERIFIED API
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#070b12] text-slate-100 overflow-hidden font-sans">
      {/* ── Top Header & Telemetry Dashboard ─────────────────────────────── */}
      <div className="bg-[#0b121e] border-b border-slate-800/80 px-4 py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Recording status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-lg shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              🪲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">API Network Traffic & Backend Fidelity Inspector</h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${isRecording ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40 animate-pulse' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {isRecording ? 'LIVE INTERCEPTOR ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect real-time HTTP payloads, verify binary forensic computation fidelity (Sharp/ELA/EXIF), and audit fallback vs real responses.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunLiveProbe}
              disabled={isProbing}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md border border-cyan-400/40 flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isProbing ? '⚡ Probing Backend...' : '⚡ Trigger Live Test Probe'}
            </button>

            <button
              onClick={handleToggleRecord}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${isRecording ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600'}`}
            >
              {isRecording ? '⏸ Pause' : '▶ Resume'}
            </button>

            <button
              onClick={handleClearLogs}
              className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title="Clear all recorded entries"
            >
              🗑️ Clear
            </button>

            <button
              onClick={handleExportLogs}
              className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title="Export network logs as JSON"
            >
              📥 Export JSON
            </button>
          </div>
        </div>

        {/* Real-time Telemetry Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Total Intercepted</div>
              <div className="text-lg font-bold font-mono text-white">{stats.total}</div>
            </div>
            <span className="text-xl opacity-60">📡</span>
          </div>

          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Backend Fidelity Rate</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono text-emerald-400">{stats.realRatio}%</span>
                <span className="text-[10px] text-slate-400">({stats.realCount}/{stats.total} real)</span>
              </div>
            </div>
            <span className="text-xl opacity-60">🛡️</span>
          </div>

          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Avg Round-Trip Latency</div>
              <div className="text-lg font-bold font-mono text-cyan-400">{stats.avgDuration} ms</div>
            </div>
            <span className="text-xl opacity-60">⚡</span>
          </div>

          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Error / Rejected Rate</div>
              <div className="text-lg font-bold font-mono text-rose-400">{stats.errorCount}</div>
            </div>
            <span className="text-xl opacity-60">⚠️</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls Bar ─────────────────────────────────── */}
      <div className="bg-[#0a0f19] border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by endpoint, body, hash, or parameter..."
              className="w-full bg-[#0e1626] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#0e1626] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">Status: All ({logs.length})</option>
            <option value="SUCCESS">Success (2xx/3xx)</option>
            <option value="ERROR">Errors (4xx/5xx)</option>
            <option value="PENDING">In Flight / Pending</option>
          </select>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="bg-[#0e1626] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">Method: All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          {/* Fidelity Filter */}
          <select
            value={fidelityFilter}
            onChange={(e) => setFidelityFilter(e.target.value as any)}
            className="bg-[#0e1626] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">Fidelity: All Sources</option>
            <option value="REAL_ONLY">Verified Real Data Only</option>
            <option value="FALLBACK_ONLY">Fallback Defaults Only</option>
            <option value="REAL_FORENSICS">Binary Forensics (Sharp/ELA)</option>
            <option value="GEMINI_AI">Gemini Multimodal Reasoning</option>
            <option value="PERSISTENCE_STORE">Database Store Queries</option>
            <option value="DISCOVERY_PROVIDER">Discovery Provider</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            Auto-select newest
          </label>
          <span className="text-xs font-mono text-slate-400">
            Showing {filteredLogs.length} of {logs.length}
          </span>
        </div>
      </div>

      {/* ── Main Master-Detail Work Area ─────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Log Stream List */}
        <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 border-r border-slate-800/80 bg-[#080d17] flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-[#0a101d] border-b border-slate-800/60 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>METHOD & ENDPOINT</span>
            <span>STATUS · TIME · LATENCY</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <div className="text-3xl">📭</div>
                <div className="text-sm font-semibold">No Network Logs Match Filter</div>
                <div className="text-xs max-w-xs mx-auto">
                  Perform any action in the dashboard or click &quot;Trigger Live Test Probe&quot; above to capture requests.
                </div>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id
                const isSuccess = log.state === 'success' && (!log.status || log.status < 400)
                const isError = log.state === 'error' || (log.status && log.status >= 400)
                const isPending = log.state === 'pending'

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`p-3 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-400 shadow-inner'
                        : isError
                        ? 'hover:bg-rose-950/20 border-rose-500/40'
                        : isSuccess
                        ? 'hover:bg-slate-800/40 border-emerald-500/30'
                        : 'hover:bg-slate-800/40 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${getMethodBadgeClass(log.method)}`}>
                          {log.method}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-200 truncate" title={log.url}>
                          {log.url}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPending ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700 animate-pulse">
                            ...
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isError ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}>
                            {log.status || (isError ? 'ERR' : 200)}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">{log.durationMs}ms</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
                      <div className="truncate">
                        {getFidelityBadge(log.fidelity, log.isRealData)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {log.formattedTime}
                      </span>
                    </div>

                    {/* Detected signals preview */}
                    {log.detectedSignals.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {log.detectedSignals.slice(0, 3).map((sig, i) => (
                          <span key={i} className="text-[9px] font-mono px-1 rounded bg-slate-900/90 text-slate-300 border border-slate-700/60">
                            {sig}
                          </span>
                        ))}
                        {log.detectedSignals.length > 3 && (
                          <span className="text-[9px] font-mono text-slate-400">
                            +{log.detectedSignals.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={listEndRef} />
          </div>
        </div>

        {/* Right Column: Deep Inspection Details Pane */}
        <div className="flex-1 bg-[#090e18] flex flex-col overflow-hidden">
          {selectedLog ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Selected Log Header Banner */}
              <div className="bg-[#0d1424] border-b border-slate-800 px-4 py-3 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${getMethodBadgeClass(selectedLog.method)}`}>
                      {selectedLog.method}
                    </span>
                    <h2 className="text-sm font-bold font-mono text-white truncate" title={selectedLog.fullUrl}>
                      {selectedLog.fullUrl}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                      selectedLog.state === 'error' ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}>
                      {selectedLog.status || (selectedLog.state === 'error' ? 'Network Error' : 200)} {selectedLog.statusText}
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      ⏱ {selectedLog.durationMs} ms
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      🕒 {selectedLog.formattedTime}
                    </span>
                  </div>
                </div>

                {/* Data Fidelity Verdict Banner */}
                <div className={`mt-3 p-2.5 rounded-lg border flex items-start gap-3 ${
                  selectedLog.isRealData 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}>
                  <span className="text-lg">{selectedLog.isRealData ? '🛡️' : '⚠️'}</span>
                  <div className="flex-1 text-xs">
                    <div className="font-bold flex items-center gap-2">
                      <span>{selectedLog.isRealData ? 'VERIFIED REAL BACKEND DATA' : 'FALLBACK / HEURISTIC RESPONSE'}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-current">
                        {selectedLog.fidelity}
                      </span>
                    </div>
                    <div className="text-slate-300 mt-0.5">{selectedLog.fidelitySummary}</div>
                  </div>
                </div>

                {/* Sub-Tab Navigation */}
                <div className="flex items-center gap-2 mt-3 border-b border-slate-800/80 -mb-3 pb-0">
                  <button
                    onClick={() => setActiveSubTab('audit')}
                    className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'audit'
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔍 Fidelity Audit ({selectedLog.detectedSignals.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('response')}
                    className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'response'
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📦 Response Payload
                  </button>
                  <button
                    onClick={() => setActiveSubTab('request')}
                    className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'request'
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📤 Request Payload
                  </button>
                  <button
                    onClick={() => setActiveSubTab('headers')}
                    className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'headers'
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📋 Headers & Trace
                  </button>
                  <button
                    onClick={() => setActiveSubTab('curl')}
                    className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'curl'
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💻 cURL Replay
                  </button>
                </div>
              </div>

              {/* Sub-Tab Content View */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. AUDIT & FIDELITY TAB */}
                {activeSubTab === 'audit' && (
                  <div className="space-y-4">
                    {/* Signal Breakdown Checklist */}
                    <div className="bg-[#0d1524] border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span>🧪 Detected Data Fidelity Signals & Proof of Real Execution</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selectedLog.detectedSignals.map((sig, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded bg-[#070d17] border border-slate-800 text-xs font-mono">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-slate-200">{sig}</span>
                          </div>
                        ))}
                      </div>

                      {selectedLog.detectedSignals.length === 0 && (
                        <div className="text-xs text-slate-500 font-mono italic">
                          No specific cryptographic or forensic markers parsed for this generic payload.
                        </div>
                      )}
                    </div>

                    {/* Forensic Verification Criteria Matrix */}
                    <div className="bg-[#0d1524] border border-slate-800 rounded-xl p-4">
                      <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-3">
                        📊 Forensic Integrity Checks
                      </h3>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded bg-[#070d17] border border-slate-800">
                          <span className="text-slate-300">Cryptographic Hash Digest (SHA-256):</span>
                          <span className="font-mono text-slate-200">
                            {selectedLog.responseBody?.artifact?.sha256 || selectedLog.responseBody?.fingerprint_hash || selectedLog.requestBody?.sha256 || 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-[#070d17] border border-slate-800">
                          <span className="text-slate-300">Perceptual Image Hash (dHash):</span>
                          <span className="font-mono text-slate-200">
                            {selectedLog.responseBody?.artifact?.perceptualHash || selectedLog.responseBody?.forensics?.perceptualHash || 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-[#070d17] border border-slate-800">
                          <span className="text-slate-300">Sharp Error Level Analysis (ELA) Variance:</span>
                          <span className="font-mono text-slate-200">
                            {selectedLog.responseBody?.forensics?.ela?.meanError !== undefined 
                              ? `${selectedLog.responseBody.forensics.ela.meanError} dB` 
                              : 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-[#070d17] border border-slate-800">
                          <span className="text-slate-300">Backend Server Architecture:</span>
                          <span className="font-mono text-cyan-300">
                            {selectedLog.fullUrl.includes('localhost') || selectedLog.fullUrl.startsWith('/') || selectedLog.fullUrl.includes('.run.app')
                              ? 'Same-Origin Express & Cloud Run Container'
                              : 'External Render Cluster'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. RESPONSE BODY TAB */}
                {activeSubTab === 'response' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">Response Payload (JSON / Text)</span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.responseBody, null, 2), 'response')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-all cursor-pointer"
                      >
                        {copiedSection === 'response' ? '✓ Copied!' : '📋 Copy JSON'}
                      </button>
                    </div>

                    <pre className="p-4 bg-[#050911] border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto max-h-[500px]">
                      {selectedLog.responseBody !== undefined 
                        ? JSON.stringify(selectedLog.responseBody, null, 2)
                        : '// No response body received'}
                    </pre>
                  </div>
                )}

                {/* 3. REQUEST BODY TAB */}
                {activeSubTab === 'request' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">Request Data / Payload</span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.requestBody || {}, null, 2), 'request')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-all cursor-pointer"
                      >
                        {copiedSection === 'request' ? '✓ Copied!' : '📋 Copy JSON'}
                      </button>
                    </div>

                    <pre className="p-4 bg-[#050911] border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto max-h-[500px]">
                      {selectedLog.requestBody !== undefined 
                        ? JSON.stringify(selectedLog.requestBody, null, 2)
                        : '// No request body attached (GET / Empty)'}
                    </pre>
                  </div>
                )}

                {/* 4. HEADERS & TRACE TAB */}
                {activeSubTab === 'headers' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold font-mono text-slate-300 mb-2">Request Headers</h4>
                      <div className="p-3 bg-[#050911] border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-1">
                        {Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-cyan-400 font-semibold">{k}:</span>
                            <span className="text-slate-400 truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedLog.responseHeaders && (
                      <div>
                        <h4 className="text-xs font-bold font-mono text-slate-300 mb-2">Response Headers</h4>
                        <div className="p-3 bg-[#050911] border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-1">
                          {Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-emerald-400 font-semibold">{k}:</span>
                              <span className="text-slate-400 truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. CURL / REPLAY TAB */}
                {activeSubTab === 'curl' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">Terminal cURL Reproduction Command</span>
                      <button
                        onClick={() => copyToClipboard(selectedLog.curlCommand, 'curl')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-all cursor-pointer"
                      >
                        {copiedSection === 'curl' ? '✓ Copied!' : '📋 Copy cURL'}
                      </button>
                    </div>

                    <pre className="p-4 bg-[#050911] border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                      {selectedLog.curlCommand}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500">
              <div className="space-y-2">
                <div className="text-3xl">👈</div>
                <div className="text-sm font-semibold">Select a Request from the Stream</div>
                <div className="text-xs">Inspect headers, latency timing, payload content, and forensic integrity.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
