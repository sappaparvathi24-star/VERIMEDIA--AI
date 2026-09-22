import React from 'react'
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { DataConfidence } from '../../types'

export interface DataConfidenceBannerProps {
  confidence: DataConfidence
  source?: string
  reason?: string
  isSystemAnalysisOnly?: boolean
  customMessage?: string
  className?: string
  compact?: boolean
  style?: React.CSSProperties
}

const SYSTEM_ANALYSIS_DISCLAIMER =
  "This analysis is based on VeriMedia's internal system heuristics, not a live third-party API response, and may be incomplete or incorrect. Treat it as a starting point, not a verdict."

export function DataConfidenceBanner({
  confidence,
  source = 'External API',
  reason,
  isSystemAnalysisOnly = false,
  customMessage,
  className = '',
  compact = false,
  style
}: DataConfidenceBannerProps) {
  // 1. LIVE: Small green chip or subtle notification
  if (confidence === 'LIVE') {
    if (compact) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 ${className}`}
          style={style}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live API result ({source})</span>
        </span>
      )
    }

    return (
      <div
        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs ${className}`}
        style={style}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
          <span>
            {customMessage || `Live API response verified via ${source}`}
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
          LIVE API
        </span>
      </div>
    )
  }

  // 2. DEGRADED: Amber banner
  if (confidence === 'DEGRADED') {
    const mainMessage =
      customMessage ||
      `⚠ ${source} is running slower/limited right now — showing partial results.`

    return (
      <div
        className={`flex flex-col gap-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs ${className}`}
        style={style}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">{mainMessage}</span>
              {reason && (
                <span className="text-amber-400/90 ml-1.5 font-normal">
                  ({reason})
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            DEGRADED
          </span>
        </div>

        {isSystemAnalysisOnly && (
          <div className="pt-1.5 mt-1 border-t border-amber-500/20 text-[11px] text-amber-400/80 leading-relaxed italic">
            {SYSTEM_ANALYSIS_DISCLAIMER}
          </div>
        )}
      </div>
    )
  }

  // 3. UNAVAILABLE / INSUFFICIENT_DATA: Gray banner
  const isUnavailable = confidence === 'UNAVAILABLE'
  const defaultText = `ⓘ Insufficient data — ${source} did not return a usable result for this item.`
  const mainMessage = customMessage || defaultText

  return (
    <div
      className={`flex flex-col gap-1.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs ${className}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {isUnavailable ? (
            <ShieldAlert size={15} className="shrink-0 text-slate-400 mt-0.5" />
          ) : (
            <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
          )}
          <div>
            <span className="font-semibold text-slate-200">{mainMessage}</span>
            {reason && (
              <span className="text-slate-400 ml-1.5 font-normal">
                ({reason})
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-bold shrink-0">
          {confidence}
        </span>
      </div>

      {isSystemAnalysisOnly && (
        <div className="pt-1.5 mt-1 border-t border-slate-700/50 text-[11px] text-slate-400 leading-relaxed italic">
          {SYSTEM_ANALYSIS_DISCLAIMER}
        </div>
      )}
    </div>
  )
}

export default DataConfidenceBanner
