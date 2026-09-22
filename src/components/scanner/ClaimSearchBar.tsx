import React, { useState } from 'react'
import { Search, Globe, Tv, Sparkles, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react'
import { useStore } from '../../store'

interface ClaimSearchBarProps {
  variant?: 'header' | 'card' | 'compact'
  placeholder?: string
  className?: string
}

export function ClaimSearchBar({
  variant = 'header',
  placeholder = 'Verify media claim or news headline (Google, YouTube)...',
  className = ''
}: ClaimSearchBarProps) {
  const { openClaimModal } = useStore()
  const [localQuery, setLocalQuery] = useState('')

  const handleTrigger = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = localQuery.trim()
    openClaimModal(trimmed)
  }

  if (variant === 'header') {
    return (
      <form
        onSubmit={handleTrigger}
        className={`flex items-center gap-2 bg-[#0c141f] border border-cyan-500/30 hover:border-cyan-400/60 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-xl px-3 py-1.5 transition-all shadow-sm max-w-md w-full ${className}`}
      >
        <div className="flex items-center gap-1 text-cyan-400 shrink-0">
          <Globe size={15} />
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-300 hidden sm:inline">
            Verify
          </span>
        </div>

        <input
          id="header-claim-search-input"
          type="text"
          value={localQuery}
          onChange={e => setLocalQuery(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-xs text-white placeholder-slate-400 outline-none w-full min-w-0 font-normal"
        />

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="submit"
            className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            title="Search Google & YouTube to verify this claim"
          >
            <Search size={12} />
            <span className="hidden md:inline">Verify</span>
          </button>
        </div>
      </form>
    )
  }

  // Card variant (ideal for InvestigationFlow and Dashboard)
  return (
    <div
      id="dashboard-claim-verification-card"
      className={`p-5 rounded-2xl bg-gradient-to-br from-[#0c1420] via-[#090f17] to-[#0d1624] border border-cyan-500/30 shadow-lg shadow-cyan-950/40 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Cross-Platform Media & Headline Verification
              <span className="px-2 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                Google Search API + YouTube
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cross-examine viral claims and breaking headlines against live Google search, YouTube broadcasts, and global fact checkers.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleTrigger} className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" size={16} />
          <input
            id="card-claim-search-input"
            type="text"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder="Paste a viral headline or rumor (e.g., Pope white puffer jacket, breaking news claim)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
          />
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 shrink-0 cursor-pointer"
        >
          <span>Verify Across All Sources</span>
          <ArrowRight size={14} />
        </button>
      </form>

      {/* Suggested Quick Verification Prompts */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
        <span className="text-slate-500 font-medium">Try verifying:</span>
        {[
          'Pope Francis white puffer jacket',
          'Pentagon explosion viral image',
          'Apollo moon landing flag waving',
          'Cat rescued in Dubai flood'
        ].map(sample => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setLocalQuery(sample)
              openClaimModal(sample)
            }}
            className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-cyan-950/70 hover:text-cyan-300 border border-slate-700/60 text-slate-300 transition-colors"
          >
            "{sample}"
          </button>
        ))}
      </div>
    </div>
  )
}
