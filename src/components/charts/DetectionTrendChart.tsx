// VeriMedia AI — Recharts Detection Frequency Trend Visualization
// Implements Prompt 12: Real Database-Backed Historical Telemetry (Zero Undisclosed Fabrication)
import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { useStore } from '../../store'
import { getDetectionTrends } from '../../services/api'
import { SearchFindingsRechartsChart } from './SearchFindingsRechartsChart'

type TimeRange = '24h' | '7d' | '30d'

interface ChartDataPoint {
  time: string
  timestamp: number
  unauthorized: number // TAKEDOWN & EMERGENCY_TAKEDOWN
  suspect: number      // SUSPECT & REVIEW REQUIRED
  authorized: number   // ALLOW & ATTRIBUTION
  total: number
}

// Illustrative benchmark curve used ONLY when user explicitly toggles Demo/Sample mode
function getIllustrativeBenchmarkData(timeRange: TimeRange): ChartDataPoint[] {
  const count = timeRange === '7d' ? 7 : timeRange === '30d' ? 15 : 24
  const stepMs = timeRange === '7d' ? 24 * 3600 * 1000 : timeRange === '30d' ? 2 * 24 * 3600 * 1000 : 3600 * 1000
  const now = Date.now()
  const sampleValues = [4, 6, 5, 8, 12, 10, 7, 5, 9, 15, 18, 14, 9, 7, 11, 14, 20, 16, 12, 10, 8, 13, 16, 18]

  const points: ChartDataPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * stepMs
    const d = new Date(t)
    const label = timeRange === '24h'
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const base = sampleValues[(count - 1 - i) % sampleValues.length]
    const unauth = Math.round(base * 0.5)
    const susp = Math.round(base * 0.3)
    const auth = Math.round(base * 0.2)
    points.push({
      time: label,
      timestamp: t,
      unauthorized: unauth,
      suspect: susp,
      authorized: auth,
      total: unauth + susp + auth
    })
  }
  return points
}

// Custom Recharts Dark Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null

  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
  const unauth = payload.find((p: any) => p.dataKey === 'unauthorized')?.value || 0
  const unauthPct = total > 0 ? ((unauth / total) * 100).toFixed(1) : '0'

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      fontSize: 11,
      fontFamily: 'monospace',
    }}>
      <div style={{ color: '#8b949e', marginBottom: 6, fontWeight: 600, borderBottom: '1px solid #21262d', paddingBottom: 4 }}>
        ⏱ {label}
      </div>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, margin: '3px 0' }}>
          <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}:</span>
          <span style={{ color: '#f0f6fc', fontWeight: 700 }}>{entry.value}</span>
        </div>
      ))}
      <div style={{
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        color: '#f87171',
        fontWeight: 700,
      }}>
        <span>Unauthorized Share:</span>
        <span>{unauthPct}%</span>
      </div>
    </div>
  )
}

export function DetectionTrendChart() {
  const { results } = useStore()
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL')
  const [rawDbPoints, setRawDbPoints] = useState<ChartDataPoint[]>([])
  const [rawPlatformBreakdown, setRawPlatformBreakdown] = useState<{ name: string; count: number }[]>([])
  const [hasHistoricalData, setHasHistoricalData] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [showDemoBenchmark, setShowDemoBenchmark] = useState<boolean>(false)

  // Fetch real telemetry from backend analytics endpoint
  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getDetectionTrends(timeRange, selectedPlatform)
      .then((res: any) => {
        if (!isMounted) return
        if (res && res.points) {
          setRawDbPoints(res.points)
          setRawPlatformBreakdown(res.platformBreakdown || [])
          setHasHistoricalData(Boolean(res.hasHistoricalData))
        }
      })
      .catch(() => {
        // If network error, default to zero points
        if (!isMounted) return
        setRawDbPoints([])
        setHasHistoricalData(false)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [timeRange, selectedPlatform])

  // Merge real database points with in-memory live scan results
  const chartData = useMemo(() => {
    if (showDemoBenchmark) {
      return getIllustrativeBenchmarkData(timeRange)
    }

    // Default: Return genuine database points without artificial base seeds
    if (!rawDbPoints || rawDbPoints.length === 0) {
      // Return flat zero points for the interval
      const count = timeRange === '7d' ? 7 : timeRange === '30d' ? 15 : 24
      const stepMs = timeRange === '7d' ? 24 * 3600 * 1000 : timeRange === '30d' ? 2 * 24 * 3600 * 1000 : 3600 * 1000
      const now = Date.now()
      const fallback: ChartDataPoint[] = []
      for (let i = count - 1; i >= 0; i--) {
        const t = now - i * stepMs
        const d = new Date(t)
        const label = timeRange === '24h'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        fallback.push({
          time: label,
          timestamp: t,
          unauthorized: 0,
          suspect: 0,
          authorized: 0,
          total: 0
        })
      }
      return fallback
    }

    // Clone raw points so we can overlay current session scans onto the latest bucket
    const merged = rawDbPoints.map(p => ({ ...p }))
    if (results.length > 0 && merged.length > 0) {
      const latest = merged[merged.length - 1]
      let liveUnauth = 0
      let liveSuspect = 0
      let liveAuth = 0

      for (const r of results) {
        if (selectedPlatform !== 'ALL' && r.platform?.toLowerCase() !== selectedPlatform.toLowerCase()) {
          continue
        }
        const d = r.ai_analysis?.decision
        if (d === 'TAKEDOWN' || d === 'EMERGENCY_TAKEDOWN') liveUnauth++
        else if (d === 'REVIEW REQUIRED' || d === 'SUSPECT') liveSuspect++
        else if (d === 'ALLOW' || d === 'ATTRIBUTION') liveAuth++
      }

      // Add live results to the most recent bucket
      latest.unauthorized += liveUnauth
      latest.suspect += liveSuspect
      latest.authorized += liveAuth
      latest.total = latest.unauthorized + latest.suspect + latest.authorized
    }

    return merged
  }, [rawDbPoints, showDemoBenchmark, timeRange, results, selectedPlatform])

  // Aggregate summary metrics
  const totalDetections = chartData.reduce((acc, d) => acc + d.total, 0)
  const totalUnauthorized = chartData.reduce((acc, d) => acc + d.unauthorized, 0)
  const totalSuspect = chartData.reduce((acc, d) => acc + d.suspect, 0)
  const unauthPercentage = totalDetections > 0 ? ((totalUnauthorized / totalDetections) * 100).toFixed(1) : '0'

  // Platform breakdown based on real data
  const platformBreakdown = useMemo(() => {
    if (showDemoBenchmark) {
      return [
        { name: 'YouTube', count: Math.round(totalUnauthorized * 0.45) || 12 },
        { name: 'Reddit', count: Math.round(totalUnauthorized * 0.30) || 8 },
        { name: 'Mastodon', count: Math.round(totalUnauthorized * 0.15) || 4 },
        { name: 'Wayback Machine', count: Math.round(totalUnauthorized * 0.10) || 2 },
      ]
    }
    if (rawPlatformBreakdown && rawPlatformBreakdown.length > 0) {
      return rawPlatformBreakdown
    }
    // If no events recorded yet, return platforms with 0 counts
    return [
      { name: 'YouTube', count: 0 },
      { name: 'Reddit', count: 0 },
      { name: 'Mastodon', count: 0 },
      { name: 'Wayback Machine', count: 0 },
      { name: 'Google Images', count: 0 },
    ]
  }, [showDemoBenchmark, rawPlatformBreakdown, totalUnauthorized])

  const platforms: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Platforms' },
    { key: 'YouTube', label: 'YouTube' },
    { key: 'Reddit', label: 'Reddit' },
    { key: 'Mastodon', label: 'Mastodon' },
    { key: 'Wayback Machine', label: 'Wayback Machine' },
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '16px',
      background: '#080c10',
      color: '#c9d1d9',
      overflowY: 'auto',
    }}>
      {/* Transparency & Demo Mode Disclaimers */}
      {showDemoBenchmark ? (
        <div style={{
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 6,
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12
        }}>
          <div>
            <span style={{ color: '#fbbf24', fontWeight: 800 }}>⚠️ ILLUSTRATIVE SAMPLE BENCHMARK:</span>{' '}
            <span style={{ color: '#fde68a' }}>
              Displaying simulated sample baseline for interface layout evaluation. Real database records: {rawDbPoints.reduce((s, p) => s + p.total, 0)} detections.
            </span>
          </div>
          <button
            onClick={() => setShowDemoBenchmark(false)}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#f0f6fc',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Switch to Real Data
          </button>
        </div>
      ) : (
        <div style={{
          marginBottom: 12,
          padding: '8px 14px',
          borderRadius: 6,
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 11
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#4ade80', fontWeight: 700 }}>Operational Database Telemetry:</span>
            <span style={{ color: '#94a3b8' }}>
              Chart data is aggregated from SQLite/in-memory audit_events, forensic findings, and live analysis runs. Zero synthetic seeds.
            </span>
          </div>
          <button
            onClick={() => setShowDemoBenchmark(true)}
            style={{
              background: 'transparent',
              border: '1px solid #30363d',
              color: '#8b949e',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer'
            }}
          >
            Preview Demo Benchmark
          </button>
        </div>
      )}

      {/* Header controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid #1e2d3d',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#f0f6fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#ef4444' }}>📈</span> Detection Frequency Trend
            {showDemoBenchmark && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                ILLUSTRATIVE SAMPLE
              </span>
            )}
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#8b949e' }}>
            Real-time & historical trend monitoring for infringed / unauthorized media appearances
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Platform selector */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {platforms.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>

          {/* Time range buttons */}
          <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: 2 }}>
            {(['24h', '7d', '30d'] as TimeRange[]).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  background: timeRange === range ? '#21262d' : 'transparent',
                  color: timeRange === range ? '#f0f6fc' : '#8b949e',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Events</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f6fc', marginTop: 2 }}>{totalDetections.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>
            {showDemoBenchmark ? 'Sample counts' : 'Database detections'}
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unauthorized</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginTop: 2 }}>{totalUnauthorized.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>{unauthPercentage}% takedown rate</div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suspect / Review</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>{totalSuspect.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#fde68a', marginTop: 2 }}>Flagged for inspection</div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak Spike</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
            {chartData.length > 0 ? Math.max(...chartData.map(d => d.unauthorized)) : 0} <span style={{ fontSize: 11, fontWeight: 400 }}>/ interval</span>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>Highest detection rate</div>
        </div>
      </div>

      {/* Main Recharts Area Chart */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: '16px 12px 8px 12px',
        marginBottom: 16,
        flex: 1,
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Detection Volume & Decision Timeline ({timeRange})
          </span>
          <span style={{ fontSize: 10, color: showDemoBenchmark ? '#fbbf24' : '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: showDemoBenchmark ? '#fbbf24' : '#22c55e' }} />
            {showDemoBenchmark ? 'Illustrative Mode' : 'Live Sync Active'}
          </span>
        </div>

        <div style={{ flex: 1, width: '100%', minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUnauthorized" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorSuspect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorAuthorized" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#484f58"
                tick={{ fill: '#8b949e', fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#484f58"
                tick={{ fill: '#8b949e', fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 10, color: '#8b949e', paddingBottom: 8 }}
              />

              <Area
                type="monotone"
                dataKey="unauthorized"
                name="Unauthorized / Takedown"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUnauthorized)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="suspect"
                name="Suspect / Review"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSuspect)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="authorized"
                name="Authorized / Clean"
                stroke="#22c55e"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorAuthorized)"
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {!hasHistoricalData && !showDemoBenchmark && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 4,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid #1e2d3d',
            fontSize: 10,
            color: '#94a3b8',
            textAlign: 'center'
          }}>
            Zero recorded events in this timeframe. Newly completed forensic scans and investigations will immediately plot onto this real timeline.
          </div>
        )}
      </div>

      {/* Platform Distribution BarChart */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: '12px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Unauthorized Detection Distribution by Platform
        </div>
        <div style={{ height: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platformBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
              <XAxis type="number" stroke="#484f58" tick={{ fill: '#8b949e', fontSize: 9 }} hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#484f58" tick={{ fill: '#c9d1d9', fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
              <Bar dataKey="count" name="Detection Count" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Google Search API Grounding Confidence & Finding Frequency Matrix */}
      <SearchFindingsRechartsChart className="mt-4" />
    </div>
  )
}
