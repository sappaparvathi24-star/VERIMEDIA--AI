import React, { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Sparkles,
  X
} from 'lucide-react'
import { useStore } from '../../store'

export function GlobalProgressBar() {
  const {
    isScanning,
    scanProgress,
    scanStageIndex,
    scanStageTitle,
    scanStageDetail,
    scanStages,
    scanLogs,
    scanStartTime,
    currentResult,
    activeTab,
    setActiveTab,
    setShowEvidenceModal,
    showGlobalProgressDrawer,
    setShowGlobalProgressDrawer
  } = useStore()

  const [elapsed, setElapsed] = useState<number>(0)
  const [isDismissed, setIsDismissed] = useState<boolean>(false)

  // Real-time elapsed stopwatch
  useEffect(() => {
    let timer: any
    if (isScanning && scanStartTime) {
      setIsDismissed(false)
      timer = setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - scanStartTime) / 100) / 10))
      }, 100)
    }
    return () => clearInterval(timer)
  }, [isScanning, scanStartTime])

  // Don't show if not scanning and no active result or user dismissed
  if (!isScanning && isDismissed) {
    return null
  }

  // If not scanning and scan is at 0, hide
  if (!isScanning && scanProgress === 0 && !currentResult) {
    return null
  }

  const isComplete = !isScanning && (scanProgress >= 100 || Boolean(currentResult))

  return (
    <div
      id="global-forensic-progress-bar"
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScanning
          ? 'bg-slate-950/95 border-b border-cyan-500/30 backdrop-blur-md shadow-lg shadow-cyan-950/30'
          : isComplete
          ? 'bg-slate-950/90 border-b border-emerald-500/30 backdrop-blur-md'
          : 'hidden'
      }`}
    >
      {/* 1. Main Top Track Indicator */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Left: Active Module & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            {isScanning ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span
              className={`font-semibold tracking-wider uppercase px-2 py-0.5 rounded text-[10px] ${
                isScanning
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {isScanning ? 'LIVE FORENSIC PIPELINE' : 'ANALYSIS COMPLETE'}
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-slate-100 font-medium truncate">
              {isScanning ? scanStageTitle : 'Forensic Dossier Assembled'}
            </span>
            <span className="hidden sm:inline-block text-slate-400 text-[11px] truncate max-w-xs">
              {isScanning ? scanStageDetail : 'All 6 evidence modules validated & cross-verified'}
            </span>
          </div>
        </div>

        {/* Center: Stage Micro-Pills */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-md border border-slate-800">
          {scanStages.map((st, idx) => {
            const isCurrent = isScanning && idx === scanStageIndex
            const isDone = st.status === 'COMPLETED' || (!isScanning && isComplete)
            const isSkipped = st.status === 'SKIPPED'
            const isFailed = st.status === 'FAILED'

            return (
              <div
                key={st.key || idx}
                title={`${st.label}: ${st.status} ${st.detail ? `(${st.detail})` : ''}`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  isCurrent
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm animate-pulse'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : isSkipped
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : isFailed
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800/40 text-slate-400 border border-slate-700/30'
                }`}
              >
                <span>{st.icon}</span>
                <span className="font-semibold">{idx + 1}</span>
                {isDone && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
              </div>
            )
          })}
        </div>

        {/* Right: Progress %, Elapsed Stopwatch, and Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Progress badge */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className={isScanning ? 'text-cyan-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isScanning ? `${Math.round(scanProgress)}%` : '100%'}
            </span>
            <span className="text-slate-500">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              {elapsed.toFixed(1)}s
            </span>
          </div>

          {/* Log Stream Toggle Button */}
          <button
            id="toggle-live-telemetry-logs-btn"
            onClick={() => setShowGlobalProgressDrawer(!showGlobalProgressDrawer)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors ${
              showGlobalProgressDrawer
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Toggle real-time backend execution logs"
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Telemetry</span>
            {showGlobalProgressDrawer ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {/* Sequential Report / Results action */}
          {isComplete && (
            <button
              id="global-view-sequential-report-btn"
              onClick={() => {
                setShowEvidenceModal(true)
                if (activeTab !== 'scanner') setActiveTab('scanner')
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium shadow-sm transition-all text-[11px]"
            >
              <FileSearch className="w-3 h-3" />
              <span>Inspect 6-Step Dossier</span>
            </button>
          )}

          {/* Dismiss button if completed */}
          {isComplete && (
            <button
              id="dismiss-global-progress-bar-btn"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              title="Dismiss progress banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Global Progress Bar Line */}
      <div className="w-full h-1 bg-slate-900 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isScanning
              ? 'bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 shadow-sm shadow-cyan-400/50'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${isScanning ? Math.min(100, Math.max(5, scanProgress)) : 100}%` }}
        />
        {isScanning && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
        )}
      </div>

      {/* 3. Expandable Live Telemetry & Execution Log Drawer */}
      {showGlobalProgressDrawer && (
        <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-3 max-h-48 overflow-y-auto text-[11px] font-mono">
          <div className="max-w-7xl mx-auto space-y-1.5">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                Backend Forensic Execution Log & Live Module Signals
              </span>
              <span className="text-slate-500 text-[10px]">
                {scanLogs.length} events logged • Auto-updating
              </span>
            </div>

            {scanLogs.length === 0 ? (
              <div className="text-slate-500 py-1">
                Waiting for backend event emission...
              </div>
            ) : (
              scanLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span
                    className={`uppercase font-bold text-[9px] px-1 py-0.2 rounded shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : log.level === 'warn'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : log.level === 'success'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-900 text-cyan-400 border border-slate-700'
                    }`}
                  >
                    {log.stage}
                  </span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
