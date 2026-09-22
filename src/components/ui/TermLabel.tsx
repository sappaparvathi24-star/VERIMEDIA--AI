import React from 'react'
import { TERM_EXPLANATIONS } from '../../data/termExplanations'

interface TermLabelProps {
  term: string
  label?: string
  explanation?: string
  className?: string
  labelClassName?: string
  subtextClassName?: string
  badge?: string
  showIcon?: boolean
}

export function TermLabel({
  term,
  label,
  explanation,
  className = '',
  labelClassName = '',
  subtextClassName = '',
  badge,
}: TermLabelProps) {
  const normKey = term.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const textExplanation = explanation || TERM_EXPLANATIONS[normKey] || TERM_EXPLANATIONS[term] || ''
  const displayLabel = label || term.toUpperCase()

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`font-semibold text-slate-200 ${labelClassName}`}>
          {displayLabel}
        </span>
        {badge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            {badge}
          </span>
        )}
      </div>
      {textExplanation && (
        <p className={`text-xs text-slate-400 font-normal leading-snug ${subtextClassName}`}>
          {textExplanation}
        </p>
      )}
    </div>
  )
}
