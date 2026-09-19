// VeriMedia AI — Recharts Detection Frequency Trend Visualization
import { useState, useMemo } from 'react'
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
import type { Platform } from '../../types'

type TimeRange = '24h' | '7d' | '30d'

interface ChartDataPoint {
  time: string
  timestamp: number
  unauthorized: number // TAKEDOWN & EMERGENCY_TAKEDOWN
  suspect: number      // SUSPECT & REVIEW REQUIRED
  authorized: number   // ALLOW & ATTRIBUTION
  total: number
}

// Generate background historical trends merged with live scan state
function generateTrendData(timeRange: TimeRange, platformFilter: string, liveResultsCount: number): ChartDataPoint[] {
  const points: ChartDataPoint[] = []
  const now = Date.now()

  let count = 24
  let stepMs = 3600 * 1000 // 1 hour steps
  let formatLabel = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (timeRange === '7d') {
    count = 7
    stepMs = 24 * 3600 * 1000
    formatLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' })
  } else if (timeRange === '30d') {
    count = 15
    stepMs = 2 * 24 * 3600 * 1000
    formatLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Base seed pattern with realistic variation
  const baseSeeds = [12, 19, 15, 28, 42, 35, 22, 18, 30, 55, 68, 48, 32, 25, 38, 50, 72, 60, 41, 33, 29, 45, 58, 64]

  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * stepMs
    const dateObj = new Date(t)
    const seedIndex = (count - 1 - i) % baseSeeds.length
    const baseVal = baseSeeds[seedIndex]

    // Platform scaling factor
    const platFactor = platformFilter === 'ALL' ? 1 : 0.35

    let unauthorized = Math.max(1, Math.round((baseVal * 0.45 + (i === 0 ? liveResultsCount * 2 : 0)) * platFactor))
    let suspect = Math.max(1, Math.round((baseVal * 0.30) * platFactor))
    let authorized = Math.max(2, Math.round((baseVal * 0.25) * platFactor))

    points.push({
      time: formatLabel(dateObj),
      timestamp: t,
      unauthorized,
      suspect,
      authorized,
      total: unauthorized + suspect + authorized,
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

  const trendData = useMemo(() => {
    return generateTrendData(timeRange, selectedPlatform, results.length)
  }, [timeRange, selectedPlatform, results.length])

  // Aggregate summary metrics
  const totalDetections = trendData.reduce((acc, d) => acc + d.total, 0)
  const totalUnauthorized = trendData.reduce((acc, d) => acc + d.unauthorized, 0)
  const totalSuspect = trendData.reduce((acc, d) => acc + d.suspect, 0)
  const unauthPercentage = totalDetections > 0 ? ((totalUnauthorized / totalDetections) * 100).toFixed(1) : '0'

  // Platform breakdown mock distribution
  const platformBreakdown = [
    { name: 'TikTok', count: Math.round(totalUnauthorized * 0.38) },
    { name: 'YouTube', count: Math.round(totalUnauthorized * 0.28) },
    { name: 'X/Twitter', count: Math.round(totalUnauthorized * 0.18) },
    { name: 'Instagram', count: Math.round(totalUnauthorized * 0.11) },
    { name: 'Reddit', count: Math.round(totalUnauthorized * 0.05) },
  ]

  const platforms: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Platforms' },
    { key: 'TikTok', label: 'TikTok' },
    { key: 'YouTube', label: 'YouTube' },
    { key: 'X / Twitter', label: 'X / Twitter' },
    { key: 'Instagram', label: 'Instagram' },
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
            <span style={{ color: '#ef4444' }}>📈</span> Unauthorized Detection Frequency
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
          <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Scans</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f6fc', marginTop: 2 }}>{totalDetections.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>Observed events</div>
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
            {Math.max(...trendData.map(d => d.unauthorized))} <span style={{ fontSize: 11, fontWeight: 400 }}>/ interval</span>
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
          <span style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} /> Live Sync Active
          </span>
        </div>

        <div style={{ flex: 1, width: '100%', minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <XAxis type="number" stroke="#484f58" tick={{ fill: '#8b949e', fontSize: 9 }} hide />
              <YAxis type="category" dataKey="name" stroke="#484f58" tick={{ fill: '#c9d1d9', fontSize: 10 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
              <Bar dataKey="count" name="Infringement Count" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
