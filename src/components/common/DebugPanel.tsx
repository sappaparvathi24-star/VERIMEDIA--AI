import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Radio,
  FileCode,
  Zap,
  Info
} from 'lucide-react'
import { networkLogger, NetworkLogEntry, DataFidelity } from '../../services/networkLogger'
import { getHealth, getDetectStats } from '../../services/api'

export function DebugPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<NetworkLogEntry[]>([])
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('ALL')
  const [fidelityFilter, setFidelityFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRecording, setIsRecording] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'response' | 'request' | 'curl' | 'fidelity'>('response')
  const [isTestingProbe, setIsTestingProbe] = useState(false)

  // Subscribe to real-time network logs
  useEffect(() => {
    setIsRecording(networkLogger.getRecordingStatus())
    const unsubscribe = networkLogger.subscribe((allLogs) => {
      setLogs(allLogs)
      if (!selectedLogId && allLogs.length > 0) {
        setSelectedLogId(allLogs[0].id)
      }
    })
    return () => unsubscribe()
  }, [])

  // Auto-select latest log when new ones arrive if none selected
  useEffect(() => {
    if (logs.length > 0 && !selectedLogId) {
      setSelectedLogId(logs[0].id)
    }
  }, [logs, selectedLogId])

  const selectedLog = useMemo(() => {
    return logs.find(l => l.id === selectedLogId) || logs[0] || null
  }, [logs, selectedLogId])

  // Filtered log list
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Status filter
      if (activeFilter === 'SUCCESS' && (log.state !== 'success' || (log.status && log.status >= 400))) return false
      if (activeFilter === 'ERROR' && log.state !== 'error' && (!log.status || log.status < 400)) return false
      if (activeFilter === 'REAL_DATA' && !log.isRealData) return false
      if (activeFilter === 'FALLBACK' && log.fidelity !== 'FALLBACK_HEURISTIC' && log.fidelity !== 'CLIENT_SIMULATION') return false

      // Fidelity filter
      if (fidelityFilter !== 'ALL' && log.fidelity !== fidelityFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchUrl = log.url.toLowerCase().includes(q)
        const matchMethod = log.method.toLowerCase().includes(q)
        const matchFidelity = log.fidelitySummary.toLowerCase().includes(q)
        const matchBody = log.responseBody ? JSON.stringify(log.responseBody).toLowerCase().includes(q) : false
        if (!matchUrl && !matchMethod && !matchFidelity && !matchBody) return false
      }

      return true
    })
  }, [logs, activeFilter, fidelityFilter, searchQuery])

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length
    const realForensicCount = logs.filter(l => l.fidelity === 'REAL_FORENSICS' || l.fidelity === 'GEMINI_AI').length
    const fallbackCount = logs.filter(l => l.fidelity === 'FALLBACK_HEURISTIC' || l.fidelity === 'CLIENT_SIMULATION').length
    const errorCount = logs.filter(l => l.state === 'error' || (l.status && l.status >= 400)).length
    const avgLatency = total > 0 ? Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / total) : 0

    return { total, realForensicCount, fallbackCount, errorCount, avgLatency }
  }, [logs])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSendProbe = async () => {
    setIsTestingProbe(true)
    try {
      await getHealth()
      await getDetectStats()
    } catch (_) {
    } finally {
      setIsTestingProbe(false)
    }
  }

  const getFidelityBadge = (fidelity: DataFidelity, isReal: boolean) => {
    switch (fidelity) {
      case 'REAL_FORENSICS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            REAL FORENSIC ENGINE (SHARP/EXIF)
          </span>
        )
      case 'GEMINI_AI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
            <Zap className="w-3 h-3 text-cyan-400" />
            LIVE GEMINI AI REASONING
          </span>
        )
      case 'CLOUD_DATABASE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-500/40">
            <Activity className="w-3 h-3 text-blue-400" />
            SUPABASE / POSTGRESQL DB
          </span>
        )
      case 'DISCOVERY_PROVIDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40">
            <Search className="w-3 h-3 text-purple-400" />
            LIVE SEARCH / OSINT API
          </span>
        )
      case 'FALLBACK_HEURISTIC':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            HEURISTIC FALLBACK ACTIVE
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">
            <Info className="w-3 h-3 text-slate-400" />
            SYSTEM TELEMETRY
          </span>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div
      id="verimedia-debug-panel"
      className={`fixed inset-x-0 bottom-0 z-50 bg-slate-950/98 border-t border-cyan-500/30 backdrop-blur-xl shadow-2xl transition-all duration-300 flex flex-col font-mono text-xs ${
        isExpanded ? 'h-[90vh]' : 'h-[500px]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wide">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>NETWORK & FORENSIC FIDELITY AUDIT PANEL</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {stats.total} Requests
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              {stats.realForensicCount} Real Signals
            </span>
            {stats.fallbackCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                {stats.fallbackCount} Fallbacks
              </span>
            )}
            {stats.errorCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/30">
                {stats.errorCount} Errors
              </span>
            )}
            <span className="text-slate-400">Avg {stats.avgLatency}ms</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            id="debug-panel-send-probe-btn"
            onClick={handleSendProbe}
            disabled={isTestingProbe}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Send real-time health and detect statistics probe to backend"
          >
            <RefreshCw className={`w-3 h-3 ${isTestingProbe ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{isTestingProbe ? 'Probing...' : 'Ping Backend'}</span>
          </button>

          <button
            id="debug-panel-toggle-recording-btn"
            onClick={() => setIsRecording(networkLogger.toggleRecording())}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
              isRecording
                ? 'bg-rose-950/60 text-rose-300 border-rose-500/40 hover:bg-rose-900/60'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title="Pause or resume recording network calls"
          >
            <Radio className={`w-3 h-3 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{isRecording ? 'Recording' : 'Paused'}</span>
          </button>

          <button
            id="debug-panel-clear-btn"
            onClick={() => networkLogger.clear()}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Clear all request logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            id="debug-panel-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand full height'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            id="debug-panel-close-btn"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close debug inspector"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">Status:</span>
          {[
            { key: 'ALL', label: 'All' },
            { key: 'REAL_DATA', label: 'Real Forensics & DB' },
            { key: 'FALLBACK', label: 'Fallbacks' },
            { key: 'SUCCESS', label: '2xx OK' },
            { key: 'ERROR', label: 'Errors' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeFilter === f.key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search url, payload, headers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 text-slate-200 placeholder-slate-500 pl-7 pr-2.5 py-1 rounded border border-slate-700/80 focus:outline-none focus:border-cyan-500 w-64 text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Main Split Body: Left List + Right Inspector */}
      <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        
        {/* Left Column: Network Requests List (col-span-5) */}
        <div className="col-span-5 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Terminal className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No network calls match the current filter.</p>
              <p className="text-[10px] text-slate-400">Trigger an investigation, search, or ping backend to capture traffic.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = selectedLog?.id === log.id
              const is2xx = log.status && log.status >= 200 && log.status < 300
              const isError = log.state === 'error' || (log.status && log.status >= 400)

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`p-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                      : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                          log.method === 'GET'
                            ? 'bg-sky-950 text-sky-400 border border-sky-800'
                            : log.method === 'POST'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : log.method === 'PATCH'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="font-semibold text-slate-200 truncate">{log.url}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          is2xx
                            ? 'bg-emerald-950/80 text-emerald-400'
                            : isError
                            ? 'bg-rose-950/80 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {log.status || (log.state === 'pending' ? '...' : 'ERR')}
                      </span>
                      <span className="text-slate-400 text-[10px]">{log.durationMs}ms</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className="truncate">
                      {log.fidelity === 'REAL_FORENSICS' ? (
                        <span className="text-emerald-400 font-medium">🔬 Real ELA & EXIF</span>
                      ) : log.fidelity === 'GEMINI_AI' ? (
                        <span className="text-cyan-400 font-medium">🧠 Live Gemini AI</span>
                      ) : log.fidelity === 'CLOUD_DATABASE' ? (
                        <span className="text-blue-400 font-medium">☁️ Supabase PostgreSQL</span>
                      ) : log.fidelity === 'FALLBACK_HEURISTIC' ? (
                        <span className="text-amber-400 font-medium">⚠️ Heuristic Fallback</span>
                      ) : (
                        <span className="text-slate-400">{log.fidelitySummary}</span>
                      )}
                    </div>
                    <span className="text-slate-400 shrink-0">{log.formattedTime}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right Column: Selected Request Inspector (col-span-7) */}
        <div className="col-span-7 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
          {selectedLog ? (
            <>
              {/* Header Info of Selected Request */}
              <div className="p-3 bg-slate-900/60 border-b border-slate-800 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">{selectedLog.method}</span>
                    <span className="text-slate-100 font-mono font-semibold truncate text-[12px]">
                      {selectedLog.fullUrl}
                    </span>
                  </div>
                  <div>
                    {getFidelityBadge(selectedLog.fidelity, selectedLog.isRealData)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <div className="flex items-center gap-4">
                    <span>Status: <strong className={selectedLog.status && selectedLog.status < 400 ? 'text-emerald-400' : 'text-rose-400'}>{selectedLog.status || 'Error'}</strong></span>
                    <span>Duration: <strong className="text-slate-200">{selectedLog.durationMs}ms</strong></span>
                    <span>Time: <strong className="text-slate-200">{selectedLog.timestamp}</strong></span>
                  </div>
                  <span className="text-slate-400 text-[10px]">Trace ID: {selectedLog.traceId}</span>
                </div>

                {/* Detected Signals Banner */}
                {selectedLog.detectedSignals.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Verified Signals:</span>
                    {selectedLog.detectedSignals.map((sig, i) => (
                      <span key={i} className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px]">
                        ✓ {sig}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Inspector Sub-Tabs */}
              <div className="flex items-center justify-between px-3 bg-slate-900/30 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  {[
                    { key: 'response', label: 'Response Body' },
                    { key: 'request', label: 'Request Payload' },
                    { key: 'fidelity', label: 'Fidelity Analysis' },
                    { key: 'curl', label: 'cURL Command' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`py-2 px-2.5 font-medium border-b-2 text-[11px] transition-colors ${
                        activeTab === tab.key
                          ? 'text-cyan-400 border-cyan-400 bg-cyan-950/20'
                          : 'text-slate-400 border-transparent hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const content =
                      activeTab === 'response' ? JSON.stringify(selectedLog.responseBody, null, 2)
                      : activeTab === 'request' ? JSON.stringify(selectedLog.requestBody, null, 2)
                      : activeTab === 'curl' ? selectedLog.curlCommand
                      : selectedLog.fidelitySummary
                    handleCopy(content || '', activeTab)
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                >
                  {copiedKey === activeTab ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy {activeTab}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Inspector Tab Content Area */}
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] bg-slate-950">
                {activeTab === 'response' && (
                  <div>
                    {selectedLog.responseBody ? (
                      <pre className="text-slate-200 whitespace-pre-wrap break-all leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800">
                        {JSON.stringify(selectedLog.responseBody, null, 2)}
                      </pre>
                    ) : selectedLog.errorMessage ? (
                      <div className="p-3 bg-rose-950/40 border border-rose-800 rounded text-rose-300">
                        <div className="font-bold mb-1">Request Error:</div>
                        <div>{selectedLog.errorMessage}</div>
                      </div>
                    ) : (
                      <div className="text-slate-500 py-6 text-center">No response body captured.</div>
                    )}
                  </div>
                )}

                {activeTab === 'request' && (
                  <div className="space-y-3">
                    {/* Headers */}
                    <div>
                      <div className="text-slate-400 font-semibold mb-1 text-[10px] uppercase">Request Headers:</div>
                      <pre className="text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                      </pre>
                    </div>

                    {/* Query Params */}
                    {selectedLog.queryParams && Object.keys(selectedLog.queryParams).length > 0 && (
                      <div>
                        <div className="text-slate-400 font-semibold mb-1 text-[10px] uppercase">Query Parameters:</div>
                        <pre className="text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.queryParams, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Body */}
                    <div>
                      <div className="text-slate-400 font-semibold mb-1 text-[10px] uppercase">Request Body:</div>
                      {selectedLog.requestBody ? (
                        <pre className="text-slate-200 bg-slate-900/50 p-2.5 rounded border border-slate-800 whitespace-pre-wrap break-all">
                          {typeof selectedLog.requestBody === 'object'
                            ? JSON.stringify(selectedLog.requestBody, null, 2)
                            : String(selectedLog.requestBody)}
                        </pre>
                      ) : (
                        <div className="text-slate-500 text-[10px] italic">No request payload sent.</div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'fidelity' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-900/70 border border-slate-800 rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-[12px]">Data Fidelity Evaluation</span>
                        {getFidelityBadge(selectedLog.fidelity, selectedLog.isRealData)}
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {selectedLog.fidelitySummary}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-900/40 border border-slate-800 rounded space-y-2">
                      <span className="font-semibold text-cyan-400 text-[11px]">How VeriMedia Verifies Backend Realness:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                        <li><strong className="text-slate-100">Sharp ELA Analysis:</strong> Checks for DCT coefficient re-quantization matrix, error maps, and luminance anomaly variance.</li>
                        <li><strong className="text-slate-100">Cryptographic Bitstream:</strong> Confirms SHA-256 byte digest and 64-bit dHash perceptual fingerprint.</li>
                        <li><strong className="text-slate-100">EXIF & C2PA Hardware Signatures:</strong> Verifies real sensor noise patterns and digital identity claims.</li>
                        <li><strong className="text-slate-100">Deterministic Fallback Flag:</strong> Flags when synthetic fallback is active if upstream API keys are unconfigured.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'curl' && (
                  <div>
                    <pre className="text-cyan-300 bg-slate-900/80 p-3 rounded border border-slate-800 whitespace-pre-wrap break-all leading-relaxed">
                      {selectedLog.curlCommand}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a request from the left column to inspect its forensic payload.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
