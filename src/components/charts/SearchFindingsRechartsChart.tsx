import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Globe,
  Layers,
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react'
import { useStore } from '../../store'
import type { VerificationJobHistoryItem, GoogleSearchFindingItem } from '../../types'

interface SearchFindingsRechartsChartProps {
  selectedJob?: VerificationJobHistoryItem | null
  jobs?: VerificationJobHistoryItem[]
  compact?: boolean
  className?: string
  onSelectJob?: (jobId: string) => void
}

type ChartViewMode = 'composed' | 'frequency' | 'confidence'

export interface FindingChartDatum {
  key: string
  label: string
  fullName: string
  findingsCount: number
  avgConfidencePct: number
  veracityScore?: number
  primaryType?: string
  color: string
}

const DOMAIN_PALETTE: Record<string, string> = {
  'reuters.com': '#22c55e',
  'apnews.com': '#38bdf8',
  'snopes.com': '#ef4444',
  'bbc.com': '#f59e0b',
  'youtube.com': '#dc2626',
  'nasa.gov': '#06b6d4',
  'bloomberg.com': '#8b5cf6',
  'theverge.com': '#ec4899',
  'history.com': '#eab308',
  'khaleejtimes.com': '#10b981',
  'google.com': '#00d4ff',
  'factcheck.org': '#f97316'
}

const CATEGORY_COLORS: Record<string, string> = {
  fact_check: '#ef4444',
  grounded_source: '#00d4ff',
  cse_web: '#38bdf8',
  youtube_video: '#f59e0b',
  social_citation: '#a855f7'
}

// Custom Recharts Dark Tooltip
function CustomFindingsTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null

  return (
    <div style={{
      background: 'rgba(8, 12, 16, 0.96)',
      border: '1px solid rgba(0, 212, 255, 0.35)',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minWidth: 200,
      zIndex: 100
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Globe size={13} color="#00d4ff" />
        <span>{label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((item: any, idx: number) => {
          const isConfidence = item.dataKey === 'avgConfidencePct' || item.dataKey === 'confidencePct'
          return (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 11 }}>
              <span style={{ color: item.color || '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color || '#38bdf8', display: 'inline-block' }} />
                {item.name || item.dataKey}:
              </span>
              <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                {isConfidence ? `${item.value}%` : `${item.value} findings`}
              </strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SearchFindingsRechartsChart({
  selectedJob: propsSelectedJob,
  jobs: propsJobs,
  compact = false,
  className = '',
  onSelectJob
}: SearchFindingsRechartsChartProps) {
  const {
    verificationHistory,
    selectedVerificationJobId,
    setSelectedVerificationJobId
  } = useStore()

  const allJobs = propsJobs || verificationHistory
  const activeJobId = propsSelectedJob?.id || selectedVerificationJobId || allJobs[0]?.id

  const [filterJobId, setFilterJobId] = useState<string>('active')
  const [viewMode, setViewMode] = useState<ChartViewMode>('composed')
  const [groupingMode, setGroupingMode] = useState<'domain' | 'category'>('domain')

  // Find the active single job or calculate aggregate
  const currentJob = useMemo(() => {
    if (filterJobId === 'all') return null
    if (filterJobId === 'active') {
      return allJobs.find(j => j.id === activeJobId) || allJobs[0] || null
    }
    return allJobs.find(j => j.id === filterJobId) || null
  }, [filterJobId, activeJobId, allJobs])

  // Extract all relevant findings based on selection
  const relevantFindings = useMemo((): GoogleSearchFindingItem[] => {
    if (currentJob) {
      return currentJob.findings || []
    }
    // Aggregate from all session jobs
    const allFindings: GoogleSearchFindingItem[] = []
    allJobs.forEach(job => {
      if (job.findings) {
        allFindings.push(...job.findings)
      }
    })
    return allFindings
  }, [currentJob, allJobs])

  // Aggregate by Source Domain
  const domainData = useMemo((): FindingChartDatum[] => {
    const map = new Map<string, { count: number; totalConf: number; veracity: number; type: string }>()

    relevantFindings.forEach(f => {
      const d = f.domain || 'google.com'
      const existing = map.get(d) || { count: 0, totalConf: 0, veracity: f.veracityScore || 50, type: f.sourceType }
      existing.count += 1
      existing.totalConf += (f.confidenceScore || 0.85)
      existing.type = f.sourceType || existing.type
      map.set(d, existing)
    })

    const items: FindingChartDatum[] = []
    map.forEach((val, domain) => {
      const avgConf = val.count > 0 ? val.totalConf / val.count : 0.8
      items.push({
        key: domain,
        label: domain.replace('.com', '').replace('.org', '').replace('.gov', '').slice(0, 14),
        fullName: domain,
        findingsCount: val.count,
        avgConfidencePct: Math.round(avgConf * 100),
        veracityScore: val.veracity,
        primaryType: val.type,
        color: DOMAIN_PALETTE[domain] || '#38bdf8'
      })
    })

    // Sort by findings frequency descending
    return items.sort((a, b) => b.findingsCount - a.findingsCount).slice(0, compact ? 6 : 10)
  }, [relevantFindings, compact])

  // Aggregate by Finding Category
  const categoryData = useMemo((): FindingChartDatum[] => {
    const catMap: Record<string, { label: string; count: number; totalConf: number; color: string }> = {
      fact_check: { label: 'Fact Checks', count: 0, totalConf: 0, color: '#ef4444' },
      grounded_source: { label: 'Grounded Web', count: 0, totalConf: 0, color: '#00d4ff' },
      cse_web: { label: 'Google Search CSE', count: 0, totalConf: 0, color: '#38bdf8' },
      youtube_video: { label: 'YouTube Video', count: 0, totalConf: 0, color: '#f59e0b' },
      social_citation: { label: 'Social Wires', count: 0, totalConf: 0, color: '#a855f7' },
    }

    relevantFindings.forEach(f => {
      const target = catMap[f.sourceType] || catMap.grounded_source
      target.count += 1
      target.totalConf += (f.confidenceScore || 0.85)
    })

    return Object.entries(catMap)
      .map(([key, val]) => ({
        key,
        label: val.label,
        fullName: val.label,
        findingsCount: val.count,
        avgConfidencePct: val.count > 0 ? Math.round((val.totalConf / val.count) * 100) : 0,
        color: val.color,
        primaryType: key
      }))
      .filter(item => item.findingsCount > 0)
      .sort((a, b) => b.findingsCount - a.findingsCount)
  }, [relevantFindings])

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalFindings = relevantFindings.length
    const avgConfidence = totalFindings > 0
      ? Math.round((relevantFindings.reduce((acc, f) => acc + (f.confidenceScore || 0.85), 0) / totalFindings) * 100)
      : (currentJob ? Math.round(currentJob.confidence * 100) : 92)

    const googleGroundedCount = relevantFindings.filter(
      f => f.sourceType === 'grounded_source' || f.sourceType === 'fact_check'
    ).length

    const topDomain = domainData[0]?.fullName || 'snopes.com'

    return {
      totalFindings,
      avgConfidence,
      googleGroundedCount,
      topDomain,
      verdictLabel: currentJob ? currentJob.verdictLabel : 'Multi-Job Aggregated Evidence',
      status: currentJob ? currentJob.status : 'COMPLETED'
    }
  }, [relevantFindings, currentJob, domainData])

  const chartData: FindingChartDatum[] = groupingMode === 'domain' ? domainData : categoryData
  const xDataKey = 'label'

  return (
    <div
      id="search-findings-recharts-container"
      className={`rounded-xl border border-cyan-500/25 bg-[#070b12] ${compact ? 'p-3' : 'p-5'} ${className}`}
      style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)' }}
    >
      {/* Top Header & Interactive Mode Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00d4ff] animate-pulse" />
            <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-cyan-300">
              Google Search Grounding Analytics & Confidence Matrix
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time finding frequency and calibrated confidence scores from Google Search API grounding
          </p>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grouping Toggle */}
          <div className="flex items-center bg-[#0d1622] border border-cyan-500/20 rounded-lg p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setGroupingMode('domain')}
              className={`px-2 py-1 rounded transition-colors ${groupingMode === 'domain' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
              title="Group findings by source publisher domain"
            >
              By Domain
            </button>
            <button
              onClick={() => setGroupingMode('category')}
              className={`px-2 py-1 rounded transition-colors ${groupingMode === 'category' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
              title="Group findings by discovery channel category"
            >
              By Category
            </button>
          </div>

          {/* Visualization Mode Toggle */}
          <div className="flex items-center bg-[#0d1622] border border-cyan-500/20 rounded-lg p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('composed')}
              className={`px-2 py-1 rounded transition-colors ${viewMode === 'composed' ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              title="Composed: Frequency bars & Confidence curve"
            >
              Dual Metric
            </button>
            <button
              onClick={() => setViewMode('frequency')}
              className={`px-2 py-1 rounded transition-colors ${viewMode === 'frequency' ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              title="Frequency count only"
            >
              Frequency
            </button>
            <button
              onClick={() => setViewMode('confidence')}
              className={`px-2 py-1 rounded transition-colors ${viewMode === 'confidence' ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              title="Confidence scores only"
            >
              Confidence
            </button>
          </div>

          {/* Job Filter Dropdown */}
          <select
            value={filterJobId}
            onChange={(e) => {
              setFilterJobId(e.target.value)
              if (e.target.value !== 'all' && e.target.value !== 'active') {
                setSelectedVerificationJobId(e.target.value)
                if (onSelectJob) onSelectJob(e.target.value)
              }
            }}
            className="bg-[#0c141f] border border-cyan-500/30 text-cyan-300 text-[11px] rounded-lg px-2.5 py-1 outline-none font-mono cursor-pointer"
          >
            <option value="active">Active Selected Job</option>
            <option value="all">Aggregate All Session Jobs ({allJobs.length})</option>
            {allJobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.query.length > 28 ? job.query.slice(0, 28) + '…' : job.query} ({Math.round(job.confidence * 100)}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="bg-[#0a1018] border border-cyan-500/15 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Avg Confidence</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {summaryMetrics.avgConfidence}%
            </span>
            <span className="text-[10px] text-emerald-500/80">calibrated</span>
          </div>
        </div>

        <div className="bg-[#0a1018] border border-cyan-500/15 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Google Findings</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-extrabold text-cyan-300 font-mono">
              {summaryMetrics.totalFindings}
            </span>
            <span className="text-[10px] text-slate-400">citations</span>
          </div>
        </div>

        <div className="bg-[#0a1018] border border-cyan-500/15 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Grounded Wires</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-extrabold text-sky-400 font-mono">
              {summaryMetrics.googleGroundedCount}
            </span>
            <span className="text-[10px] text-slate-400">verified sources</span>
          </div>
        </div>

        <div className="bg-[#0a1018] border border-cyan-500/15 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Top Evidence Wire</div>
          <div className="text-xs font-bold text-amber-300 font-mono truncate mt-1" title={summaryMetrics.topDomain}>
            {summaryMetrics.topDomain}
          </div>
        </div>
      </div>

      {/* Selected Job Banner if single job chosen */}
      {currentJob && (
        <div className="flex items-center justify-between gap-3 bg-[#0a1019] border-l-2 border-cyan-400 rounded-r-lg px-3 py-2 mb-3 text-[11px]">
          <div className="min-w-0 flex-1">
            <span className="text-slate-400 font-mono">Query Target: </span>
            <span className="text-white font-semibold">{currentJob.query}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {currentJob.verdictLabel}
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {Math.round(currentJob.confidence * 100)}% Conf
            </span>
          </div>
        </div>
      )}

      {/* Recharts Chart Stage */}
      <div className="w-full" style={{ height: compact ? 220 : 280 }}>
        {chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <BarChart3 size={28} className="mb-2 text-cyan-500/40" />
            <span>No search findings available for current selection</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'composed' ? (
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 16, bottom: 20, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                <XAxis
                  dataKey={xDataKey}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: compact ? 9 : 10, fontFamily: 'monospace' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  allowDecimals={false}
                  label={{ value: 'Findings Count', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 15 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#22c55e"
                  domain={[0, 100]}
                  tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }}
                  unit="%"
                  label={{ value: 'Confidence %', angle: 90, position: 'insideRight', fill: '#4ade80', fontSize: 10, offset: 10 }}
                />
                <Tooltip content={<CustomFindingsTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 11, fontFamily: 'monospace' }}
                  iconType="circle"
                />
                <ReferenceLine
                  yAxisId="right"
                  y={75}
                  stroke="rgba(234, 179, 8, 0.5)"
                  strokeDasharray="3 3"
                  label={{ value: '75% Threshold', fill: '#eab308', fontSize: 9, position: 'insideTopRight' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="findingsCount"
                  name="Findings Frequency"
                  radius={[4, 4, 0, 0]}
                  fill="#00d4ff"
                  barSize={compact ? 16 : 24}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={(entry as any).color || '#00d4ff'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgConfidencePct"
                  name="Confidence Score (%)"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#22c55e', stroke: '#080c10', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#4ade80' }}
                />
              </ComposedChart>
            ) : viewMode === 'frequency' ? (
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 16, bottom: 20, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                <XAxis
                  dataKey={xDataKey}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: compact ? 9 : 10, fontFamily: 'monospace' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomFindingsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11, fontFamily: 'monospace' }} />
                <Bar
                  dataKey="findingsCount"
                  name="Findings Frequency"
                  radius={[4, 4, 0, 0]}
                  fill="#00d4ff"
                  barSize={compact ? 18 : 28}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-freq-${index}`}
                      fill={(entry as any).color || '#00d4ff'}
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 16, bottom: 20, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                <XAxis
                  dataKey={xDataKey}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: compact ? 9 : 10, fontFamily: 'monospace' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#22c55e"
                  domain={[0, 100]}
                  tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }}
                  unit="%"
                />
                <Tooltip content={<CustomFindingsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11, fontFamily: 'monospace' }} />
                <ReferenceLine
                  y={85}
                  stroke="rgba(34, 197, 94, 0.5)"
                  strokeDasharray="3 3"
                  label={{ value: '85% High Trust', fill: '#4ade80', fontSize: 9, position: 'insideTopRight' }}
                />
                <Bar
                  dataKey="avgConfidencePct"
                  name="Calibrated Confidence (%)"
                  radius={[4, 4, 0, 0]}
                  fill="#22c55e"
                  barSize={compact ? 18 : 28}
                >
                  {chartData.map((entry, index) => {
                    const conf = (entry as any).avgConfidencePct || 80
                    const color = conf >= 90 ? '#22c55e' : conf >= 75 ? '#38bdf8' : '#eab308'
                    return (
                      <Cell
                        key={`cell-conf-${index}`}
                        fill={color}
                        fillOpacity={0.9}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Finding Details Snippets */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-mono font-bold">Engine Source:</span>
          <span>Google Search API (`@google/genai` Grounding) + Fact Check Tools</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>&ge;90% High Confidence</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            <span>75-89% Corroborated</span>
          </span>
        </div>
      </div>
    </div>
  )
}
