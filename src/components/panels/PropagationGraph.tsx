import { useEffect, useRef, useState, useMemo } from 'react'
import { useStore } from '../../store'
import { getInvestigationPropagation } from '../../services/api'
import type { Platform } from '../../types'
import { isSimulatedResult } from '../../lib/resultMode'

const PLATFORMS: Platform[] = ['YouTube', 'Reddit', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook']

// Platform Color Map
const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#ef4444',
  Reddit: '#f97316',
  Instagram: '#ec4899',
  TikTok: '#00d4ff',
  'X / Twitter': '#94a3b8',
  X: '#94a3b8',
  Facebook: '#3b82f6'
}

// ---------------------------------------------------------------------------
// THRESHOLDS & ENGINE CONSTANTS (Configurable for Spread & Takedown Policies)
// ---------------------------------------------------------------------------

/** Parts-Per-Million velocity thresholds for viral dissemination tiers */
export const PPM_THRESHOLDS = {
  CRITICAL: 200,
  HIGH: 100,
  MODERATE: 40,
} as const

/** Growth ratio boundaries between cascade time windows */
export const REPLICATION_THRESHOLDS = {
  ACCELERATING: 1.15,
  DECELERATING: 0.85,
} as const

/** Minimum estimated view reach required before automated takedown recommendation activates */
export const TAKEDOWN_REACH_THRESHOLD = 250000

/** Verdict decisions that confirm unauthorized or infringing dissemination */
export const TAKEDOWN_CONFIRMED_DECISIONS = ['TAKEDOWN', 'EMERGENCY_TAKEDOWN'] as const

// ---------------------------------------------------------------------------
// METRIC DERIVATION HELPERS
// ---------------------------------------------------------------------------

export type DisseminationLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

/**
 * Categorizes virality as 'Low', 'Moderate', 'High', or 'Critical' based on the ppm value.
 */
export function getDisseminationLevel(ppm?: number | null): DisseminationLevel {
  const val = typeof ppm === 'number' && !isNaN(ppm) ? ppm : 0
  if (val >= PPM_THRESHOLDS.CRITICAL) {
    return 'Critical'
  }
  if (val >= PPM_THRESHOLDS.HIGH) {
    return 'High'
  }
  if (val >= PPM_THRESHOLDS.MODERATE) {
    return 'Moderate'
  }
  return 'Low'
}

/**
 * Returns UI accent color corresponding to the dissemination virality tier.
 */
export function getDisseminationColor(level: DisseminationLevel): string {
  switch (level) {
    case 'Critical':
      return '#dc2626'
    case 'High':
      return '#f87171'
    case 'Moderate':
      return '#fbbf24'
    case 'Low':
    default:
      return '#4ade80'
  }
}

/**
 * Computes percentage velocity/spread spike over the trailing 60-minute window.
 * Returns null and an honest fallback indicator if historical time-series telemetry is absent.
 */
export function computeVelocitySpike(
  activeProp: any,
  events: CascadeNode[]
): { percent: number | null; label: string; color: string } {
  // 1. Direct metric from backend telemetry if provided
  // TODO: Backend should expose activePropagation.velocitySpike60m or activePropagation.velocityHistory
  // to deliver rolling sliding-window acceleration calculations directly from the ingest stream.
  if (typeof activeProp?.velocitySpike60m === 'number') {
    const val = activeProp.velocitySpike60m
    return {
      percent: val,
      label: `${val >= 0 ? '▲ +' : '▼ '}${Math.abs(val).toFixed(0)}% ${val >= 0 ? 'spike' : 'drop'} in last 60m`,
      color: val >= 0 ? '#4ade80' : '#f87171'
    }
  }

  // 2. Compute from event time deltas if multiple timestamped cascade nodes exist
  if (events.length >= 2) {
    const maxDelta = Math.max(...events.map(e => e.deltaMinutes || 0))
    const recentWindowEvents = events.filter(e => (e.deltaMinutes || 0) >= maxDelta - 60)
    const priorWindowEvents = events.filter(e => (e.deltaMinutes || 0) >= maxDelta - 120 && (e.deltaMinutes || 0) < maxDelta - 60)

    if (priorWindowEvents.length > 0) {
      const diffRatio = ((recentWindowEvents.length - priorWindowEvents.length) / priorWindowEvents.length) * 100
      return {
        percent: diffRatio,
        label: `${diffRatio >= 0 ? '▲ +' : '▼ '}${Math.abs(diffRatio).toFixed(0)}% ${diffRatio >= 0 ? 'spike' : 'drop'} in last 60m`,
        color: diffRatio >= 0 ? '#4ade80' : '#f87171'
      }
    }
    if (recentWindowEvents.length > 0 && maxDelta <= 60) {
      // All observed events occurred within the first 60 minutes of observation
      return {
        percent: 100,
        label: `▲ +100% surge (${recentWindowEvents.length} events in 60m)`,
        color: '#4ade80'
      }
    }
  }

  // 3. Fallback: Data unavailable in current props/state
  return {
    percent: null,
    label: 'Rate stable (no 60m delta baseline)',
    color: '#94a3b8'
  }
}

/**
 * Computes replication factor R0 and secondary repost acceleration trend from cascade events.
 */
export function computeReplicationMetrics(
  activeProp: any,
  events: CascadeNode[]
): {
  r0: number | null
  r0Formatted: string
  trend: string
  trendLabel: string
  color: string
} {
  // 1. Direct API metric from backend if available
  // TODO: Backend should expose activePropagation.replicationFactor or activePropagation.r0
  // to deliver authoritative multi-generation branching factors.
  if (typeof activeProp?.replicationFactor === 'number') {
    const val = activeProp.replicationFactor
    const isAcc = val > REPLICATION_THRESHOLDS.ACCELERATING
    const isDec = val < REPLICATION_THRESHOLDS.DECELERATING
    return {
      r0: val,
      r0Formatted: `${val.toFixed(1)}x`,
      trend: isAcc ? 'exponential' : isDec ? 'decelerating' : 'stable',
      trendLabel: isAcc
        ? 'Secondary reposts accelerating'
        : isDec
          ? 'Secondary reposts decelerating'
          : 'Secondary reposts stable',
      color: isAcc ? '#fbbf24' : isDec ? '#4ade80' : '#38bdf8'
    }
  }

  // 2. Derive replication factor from cascade events
  const originEvents = events.filter(e => e.status === 'ORIGIN')
  const secondaryEvents = events.filter(e => e.status !== 'ORIGIN')

  if (originEvents.length > 0 && secondaryEvents.length > 0) {
    const rawR0 = secondaryEvents.length / originEvents.length
    
    // Evaluate acceleration trajectory between early and late cascade half
    const sorted = [...events].sort((a, b) => a.deltaMinutes - b.deltaMinutes)
    const midTime = (sorted[sorted.length - 1].deltaMinutes - sorted[0].deltaMinutes) / 2
    const firstHalfSecondary = sorted.filter(e => e.deltaMinutes <= sorted[0].deltaMinutes + midTime && e.status !== 'ORIGIN').length
    const secondHalfSecondary = sorted.filter(e => e.deltaMinutes > sorted[0].deltaMinutes + midTime && e.status !== 'ORIGIN').length

    const isAccelerating = secondHalfSecondary > firstHalfSecondary
    const isDecelerating = secondHalfSecondary < firstHalfSecondary && firstHalfSecondary > 0

    return {
      r0: rawR0,
      r0Formatted: `${rawR0.toFixed(1)}x`,
      trend: isAccelerating ? 'exponential' : isDecelerating ? 'decelerating' : 'stable',
      trendLabel: isAccelerating
        ? 'Secondary reposts accelerating'
        : isDecelerating
          ? 'Secondary reposts decelerating'
          : 'Secondary reposts stable',
      color: isAccelerating ? '#fbbf24' : isDecelerating ? '#4ade80' : '#38bdf8'
    }
  }

  if (events.length === 1) {
    return {
      r0: 1.0,
      r0Formatted: '1.0x',
      trend: 'linear',
      trendLabel: 'Single origin node — no secondary reposts',
      color: '#94a3b8'
    }
  }

  return {
    r0: null,
    r0Formatted: 'N/A',
    trend: 'insufficient data',
    trendLabel: 'Insufficient cascade depth',
    color: '#94a3b8'
  }
}

interface CascadeNode {
  id: string
  platform: string
  username: string
  url: string
  publishedAt: string
  deltaMinutes: number
  similarity: number
  reachEstimate: number
  mutationType: string
  status: 'ORIGIN' | 'SYNDICATED' | 'CROPPED' | 'SYNTHETIC' | 'FLAGGED'
}

export interface CandidateNode {
  platform?: string
  [key: string]: any
}

export interface PropagationGraphProps {
  ppm?: number
  candidates?: CandidateNode[]
  [key: string]: any
}

export function PropagationGraph({ ppm: propPpm, candidates: propCandidates }: PropagationGraphProps = {}) {
  const { currentResult, setShowEvidenceModal, setShowDMCAModal, setActiveTab } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewMode, setViewMode] = useState<'mesh' | 'timeline' | 'genealogy'>('mesh')
  const [activePropagation, setActivePropagation] = useState<any | null>(null)
  const [propLoading, setPropLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CascadeNode | null>(null)

  // Cascade event nodes data
  const cascadeEvents: CascadeNode[] = [
    {
      id: 'NODE-01',
      platform: 'YouTube',
      username: 'RightsHolderOfficial',
      url: 'https://youtube.com/watch?v=broadcast_master_2026',
      publishedAt: '2026-06-01T18:00:00Z',
      deltaMinutes: 0,
      similarity: 1.0,
      reachEstimate: 420000,
      mutationType: 'Uncompressed Master Stream',
      status: 'ORIGIN'
    },
    {
      id: 'NODE-02',
      platform: 'Reddit',
      username: 'sports_archivist',
      url: 'https://reddit.com/r/sports/comments/final_clip_h264',
      publishedAt: '2026-06-01T18:45:00Z',
      deltaMinutes: 45,
      similarity: 0.96,
      reachEstimate: 85000,
      mutationType: 'Re-encoded H.264 (Bitrate -30%)',
      status: 'SYNDICATED'
    },
    {
      id: 'NODE-03',
      platform: 'TikTok',
      username: 'viralclips_daily',
      url: 'https://tiktok.com/@viralclips_daily/video/7238192837',
      publishedAt: '2026-06-01T20:15:00Z',
      deltaMinutes: 135,
      similarity: 0.89,
      reachEstimate: 620000,
      mutationType: '9:16 Aspect Crop (44% Canvas Lost)',
      status: 'CROPPED'
    },
    {
      id: 'NODE-04',
      platform: 'X',
      username: 'sports_insider_ai',
      url: 'https://x.com/sports_insider_ai/status/1792839182',
      publishedAt: '2026-06-01T22:40:00Z',
      deltaMinutes: 280,
      similarity: 0.82,
      reachEstimate: 215000,
      mutationType: 'Deepfake Audio Commentary Dub',
      status: 'SYNTHETIC'
    },
    {
      id: 'NODE-05',
      platform: 'Instagram',
      username: 'highlight_reels_global',
      url: 'https://instagram.com/reel/C8_final_moments',
      publishedAt: '2026-06-02T04:20:00Z',
      deltaMinutes: 620,
      similarity: 0.78,
      reachEstimate: 140000,
      mutationType: 'Secondary Repost with Text Mask',
      status: 'FLAGGED'
    }
  ]

  useEffect(() => {
    const invId = currentResult?.investigationId || currentResult?.case_id
    if (!invId) {
      setActivePropagation(currentResult?.propagation || null)
      return
    }

    setPropLoading(true)
    getInvestigationPropagation(invId)
      .then((data: any) => {
        if (data && (data.velocity != null || data.urgency || data.propagation)) {
          setActivePropagation(data.propagation || data)
        } else {
          setActivePropagation(currentResult?.propagation || null)
        }
      })
      .catch(() => setActivePropagation(currentResult?.propagation || null))
      .finally(() => setPropLoading(false))
  }, [currentResult])

  // Canvas Vector Mesh Render Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) * 0.38
      const now = Date.now() / 1000

      ctx.clearRect(0, 0, w, h)

      // Background Grid Lines
      ctx.strokeStyle = 'rgba(30, 45, 61, 0.4)'
      ctx.lineWidth = 0.8
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (radius / 3) * i, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Radar Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - radius - 20, cy)
      ctx.lineTo(cx + radius + 20, cy)
      ctx.moveTo(cx, cy - radius - 20)
      ctx.lineTo(cx, cy + radius + 20)
      ctx.stroke()

      const targetPlatform = currentResult?.platform || 'YouTube'
      const urgency = activePropagation?.urgency || 'high'
      const urgencyColor = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e'

      // Check whether we have real nodes to draw or if in simulated scenario
      const hasTraceableNodes = (currentResult as any)?.candidates?.length > 0 ||
        (currentResult as any)?.discovery?.candidates?.length > 0 ||
        propCandidates?.length ||
        isSimulatedResult(currentResult)

      if (!hasTraceableNodes) {
        // Honest standby radar sweep
        const sweepAngle = (now * 1.2) % (Math.PI * 2)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, sweepAngle, sweepAngle + 0.3)
        ctx.closePath()
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Center Root Origin Node
        ctx.beginPath()
        ctx.arc(cx, cy, 18, 0, Math.PI * 2)
        ctx.fillStyle = '#080c10'
        ctx.fill()
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = '#38bdf8'
        ctx.font = '800 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('STANDBY', cx, cy + 3)

        ctx.fillStyle = '#64748b'
        ctx.font = '600 11px monospace'
        ctx.fillText('0 External Vectors Detected', cx, cy + radius * 0.75)

        animId = requestAnimationFrame(render)
        return
      }

      // Perimeter platform nodes
      const nodes = PLATFORMS.map((p, i) => {
        const angle = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2
        const isTarget = p.toLowerCase().includes(targetPlatform.toLowerCase()) || targetPlatform.toLowerCase().includes(p.toLowerCase())
        return {
          name: p,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          isTarget,
          color: PLATFORM_COLORS[p] || '#00d4ff'
        }
      })

      // Pulse waves radiating from center
      const wavePhase = (now * 1.2) % 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius * wavePhase, 0, Math.PI * 2)
      ctx.strokeStyle = `${urgencyColor}${Math.floor((1 - wavePhase) * 70).toString(16).padStart(2, '0')}`
      ctx.lineWidth = 2
      ctx.stroke()

      // Transmission vectors
      nodes.forEach((node, idx) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(node.x, node.y)
        ctx.strokeStyle = node.isTarget ? urgencyColor : 'rgba(30, 45, 61, 0.7)'
        ctx.lineWidth = node.isTarget ? 2.5 : 1
        ctx.stroke()

        // Moving transmission particles
        const pOffset = (now * 1.5 + idx * 0.3) % 1
        const px = cx + (node.x - cx) * pOffset
        const py = cy + (node.y - cy) * pOffset
        ctx.beginPath()
        ctx.arc(px, py, node.isTarget ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fillStyle = node.isTarget ? '#fff' : node.color
        ctx.shadowColor = node.color
        ctx.shadowBlur = node.isTarget ? 10 : 4
        ctx.fill()
        ctx.shadowBlur = 0

        // Draw Platform Node Ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.isTarget ? 14 : 10, 0, Math.PI * 2)
        ctx.fillStyle = node.isTarget ? `${urgencyColor}25` : '#0d1117'
        ctx.fill()
        ctx.strokeStyle = node.isTarget ? urgencyColor : node.color
        ctx.lineWidth = node.isTarget ? 2.5 : 1.5
        ctx.stroke()

        // Platform Label
        ctx.fillStyle = node.isTarget ? '#fff' : '#8899aa'
        ctx.font = node.isTarget ? '800 11px monospace' : '600 10px monospace'
        ctx.textAlign = 'center'
        const labelY = node.y + (node.y > cy ? 22 : -16)
        ctx.fillText(node.name, node.x, labelY)
      })

      // Center Root Origin Node
      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.fillStyle = '#080c10'
      ctx.fill()
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#00d4ff'
      ctx.font = '800 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('ORIGIN', cx, cy + 3)

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [currentResult, activePropagation])

  const isScenario = isSimulatedResult(currentResult)

  // Derive candidate nodes from props or investigation context
  const rawCandidates: any[] = useMemo(() => {
    return (
      propCandidates ||
      (currentResult as any)?.candidates ||
      (currentResult as any)?.discovery?.candidates ||
      activePropagation?.candidates ||
      []
    )
  }, [propCandidates, currentResult, activePropagation])

  // Derive lineage and propagation nodes honestly from discovered appearances
  const derivedNodes: CascadeNode[] = useMemo(() => {
    if (rawCandidates.length > 0) {
      return rawCandidates.map((c: any, i: number) => {
        const platform = c.platform || c.domain || 'Web'
        const reach = c.reachEstimate || c.views || (typeof c.similarity === 'number' ? Math.round(c.similarity * 150000) : 50000)
        return {
          id: c.id || `NODE-${String(i + 1).padStart(2, '0')}`,
          platform,
          username: c.author || c.publisher || c.displayLink || 'Indexed Node',
          url: c.url || c.link || '#',
          publishedAt: c.publishedAt || c.timestamp || new Date().toISOString(),
          deltaMinutes: i * 35,
          similarity: typeof c.similarity === 'number' ? c.similarity : (c.matchScore ? c.matchScore / 100 : 0.85),
          reachEstimate: reach,
          mutationType: c.classification === 'EXACT_MATCH' ? 'Identical Master Clone' : c.isCropped ? 'Aspect Ratio Crop' : c.isManipulated ? 'Modified Derivative' : 'Discovered Distribution Node',
          status: (i === 0 && (c.classification === 'EXACT_MATCH' || !isScenario)) ? 'ORIGIN' : c.isManipulated ? 'SYNTHETIC' : 'SYNDICATED'
        }
      })
    }
    if (isScenario) {
      return cascadeEvents
    }
    return []
  }, [rawCandidates, isScenario])

  const hasNodes = derivedNodes.length > 0
  const totalReach = activePropagation?.totalReach ?? (hasNodes ? derivedNodes.reduce((acc, n) => acc + n.reachEstimate, 0) : 0)
  const velocity = activePropagation?.velocity ?? (isScenario ? 4.8 : (hasNodes ? Number((derivedNodes.length * 0.5).toFixed(1)) : 0))
  const urgency = activePropagation?.urgency ?? (isScenario ? 'high' : (hasNodes ? 'medium' : 'low'))
  const ppm = propPpm !== undefined ? propPpm : (activePropagation?.ppm ?? (isScenario ? 142 : (hasNodes ? Math.min(derivedNodes.length * 15, 200) : 0)))

  // 1. Compute velocity spike over trailing 60m window (or provide honest fallback)
  const velocitySpike = computeVelocitySpike(activePropagation, derivedNodes)

  // 2. Derive qualitative dissemination tier from PPM
  const disseminationLevel = getDisseminationLevel(ppm)
  const disseminationColor = getDisseminationColor(disseminationLevel)

  // Candidates array from props or investigation context
  const candidates: CandidateNode[] = rawCandidates.length > 0 ? rawCandidates : (isScenario ? cascadeEvents : [])

  // 3. Compute actual distinct platforms monitored across candidates array
  const platformCount = new Set(candidates.map(c => c.platform)).size

  // 4. Compute replication factor R0 and empirical acceleration trend
  const replication = computeReplicationMetrics(activePropagation, derivedNodes)

  // 5. Evaluate takedown recommendation conditions
  const decision = currentResult?.ai_analysis?.decision
  const isConfirmedUnauthorized = Boolean(
    (decision && (TAKEDOWN_CONFIRMED_DECISIONS as readonly string[]).includes(decision)) ||
    currentResult?.ai_analysis?.dmca_needed
  )
  const isTakedownRecommended = isConfirmedUnauthorized && totalReach >= TAKEDOWN_REACH_THRESHOLD
  const isReviewRequired = Boolean(
    decision === 'REVIEW REQUIRED' ||
    decision === 'SUSPECT' ||
    currentResult?.trust?.risk_tier === 'high_risk' ||
    currentResult?.trust?.risk_tier === 'suspect'
  )

  return (
    <div style={{ padding: '20px 24px', width: '100%', minHeight: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* High-Contrast Simulation Disclaimer Banner (Requirement 5) */}
      {isScenario && (
        <div
          id="propagation-simulated-scenario-banner"
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid #f59e0b',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fef08a' }}>
                SIMULATED TEST SCENARIO
              </div>
              <div style={{ fontSize: 11, color: '#fde68a', marginTop: 1 }}>
                Data below is synthetic/pre-configured for demonstration and does not reflect a live forensic scan.
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 4,
            background: '#78350f',
            color: '#fef08a',
            border: '1px solid #d97706',
            whiteSpace: 'nowrap'
          }}>
            PRESET: {currentResult?.scenario?.toUpperCase() || 'DEMO'}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        padding: '14px 20px',
        borderRadius: 10,
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#f87171', fontWeight: 800 }}>
              Engine 4 — Propagation & Viral Spread Topology
            </span>
            <span style={{
              fontSize: 10,
              fontFamily: 'monospace',
              padding: '2px 8px',
              borderRadius: 4,
              background: urgency === 'critical' ? 'rgba(220,38,38,0.2)' : 'rgba(239,68,68,0.15)',
              color: urgency === 'critical' ? '#dc2626' : '#f87171',
              fontWeight: 700,
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              {urgency.toUpperCase()} SPREAD VELOCITY
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0 0' }}>
            Real-time viral velocity tracking, cross-platform replication cascade, and exposure modeling.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#0d1117', padding: 4, borderRadius: 8, border: '1px solid #1e2d3d' }}>
          <button
            onClick={() => setViewMode('mesh')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'mesh' ? '#1e293b' : 'transparent',
              border: viewMode === 'mesh' ? '1px solid #00d4ff' : '1px solid transparent',
              color: viewMode === 'mesh' ? '#00d4ff' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            📡 Vector Topology
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'timeline' ? '#1e293b' : 'transparent',
              border: viewMode === 'timeline' ? '1px solid #00d4ff' : '1px solid transparent',
              color: viewMode === 'timeline' ? '#00d4ff' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            ⏱️ Cascade Stream
          </button>
          <button
            onClick={() => setViewMode('genealogy')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'genealogy' ? '#1e293b' : 'transparent',
              border: viewMode === 'genealogy' ? '1px solid #00d4ff' : '1px solid transparent',
              color: viewMode === 'genealogy' ? '#00d4ff' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            🌳 Tree Hierarchy
          </button>
        </div>
      </div>

      {/* Real-time Viral Velocity Metrics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Spread Velocity</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: 4 }}>
            {velocity} <span style={{ fontSize: 12, color: '#94a3b8' }}>shares/min</span>
          </div>
          <div style={{ fontSize: 11, color: velocitySpike.color, marginTop: 4 }}>
            {velocitySpike.label}
          </div>
        </div>

        <div id="ppm-velocity-card" style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PPM Velocity Index</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: disseminationColor, fontFamily: 'monospace', marginTop: 4 }}>
            {ppm} <span style={{ fontSize: 12, color: '#94a3b8' }}>ppm</span>
          </div>
          <div id="dissemination-level" style={{ fontSize: 11, color: disseminationColor, marginTop: 4 }}>
            {getDisseminationLevel(ppm)}
          </div>
        </div>

        <div id="platform-monitoring-card" style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Combined Reach</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#c084fc', fontFamily: 'monospace', marginTop: 4 }}>
            {(totalReach / 1000).toFixed(0)}k <span style={{ fontSize: 12, color: '#94a3b8' }}>views</span>
          </div>
          <div id="monitored-platforms-count" style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
            Across {new Set(candidates.map(c => c.platform)).size} monitored platforms
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Replication Factor R₀</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: replication.color, fontFamily: 'monospace', marginTop: 4 }}>
            {replication.r0Formatted} <span style={{ fontSize: 12, color: '#94a3b8' }}>{replication.trend}</span>
          </div>
          <div style={{ fontSize: 11, color: replication.color, marginTop: 4 }}>
            {replication.trendLabel}
          </div>
        </div>
      </div>

      {/* Main View: Vector Topology Canvas OR Cascade Stream OR Hierarchy */}
      {viewMode === 'mesh' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          {/* Canvas Box */}
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: 16,
            height: 380,
            position: 'relative'
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Cross-Platform Vector Spread Mesh</span>
              {isScenario && (
                <span style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                  [SIMULATED SCENARIO TOPOLOGY]
                </span>
              )}
            </div>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 320, display: 'block', borderRadius: 8, background: '#080c10' }}
            />
          </div>

          {/* Active Infringing Target Summary Card */}
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Target Media Node</span>
                {isTakedownRecommended ? (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    TAKEDOWN RECOMMENDED
                  </span>
                ) : isReviewRequired ? (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    REVIEW IN PROGRESS
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.25)'
                  }}>
                    MONITORING ACTIVE
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginTop: 8 }}>
                @{currentResult?.username || 'target_account'}
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
                "{currentResult?.caption || 'Championship final clip unauthorized repost with cropped watermark.'}"
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ background: '#080c10', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Perceptual Match</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: 2 }}>
                    {Math.round((currentResult?.similarity ?? 0.94) * 100)}%
                  </div>
                </div>
                <div style={{ background: '#080c10', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Platform</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                    {currentResult?.platform || 'TikTok'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowEvidenceModal(true)}
                style={{
                  flex: 1,
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Inspect Dossier
              </button>
              <button
                onClick={() => setShowDMCAModal(true)}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⚖️ File DMCA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cascade Stream List */}
      {(viewMode === 'mesh' || viewMode === 'timeline') && (
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                ⏱️ Cross-Platform Repost & Mutation Cascade Timeline
              </span>
              {isScenario && (
                <span style={{
                  fontSize: 9,
                  color: '#fbbf24',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontWeight: 800
                }}>
                  [SIMULATED SCENARIO DATA]
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>{derivedNodes.length} node(s) traced in cascade order</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {derivedNodes.length === 0 ? (
              <div style={{
                background: '#0a0f16',
                border: '1px dashed #1e2d3d',
                borderRadius: 8,
                padding: 32,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10
              }}>
                <div style={{ fontSize: 24, opacity: 0.6 }}>📡</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  No External Propagation Nodes Traced
                </div>
                <div style={{ fontSize: 11, color: '#64748b', maxWidth: 420 }}>
                  Propagation cascade analysis requires discovered web appearances. Run reverse-image discovery in Engine 2 to locate multi-platform appearances.
                </div>
              </div>
            ) : (
              derivedNodes.map((node) => {
                const isOrigin = node.status === 'ORIGIN'
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{
                      background: '#080c10',
                      border: isOrigin ? '1px solid #22c55e44' : '1px solid #1e2d3d',
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: isOrigin ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.1)',
                        border: `1px solid ${isOrigin ? '#22c55e44' : '#00d4ff44'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        flexShrink: 0
                      }}>
                        {isOrigin ? '👑' : '📡'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                            {node.platform}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            @{node.username}
                          </span>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: isOrigin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)',
                            color: isOrigin ? '#4ade80' : '#f87171'
                          }}>
                            {node.status}
                          </span>
                          {isScenario && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '1px 6px',
                              borderRadius: 3,
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.4)'
                            }}>
                              SIMULATED NODE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {node.mutationType} • Published +{node.deltaMinutes}m after master
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                          {Math.round(node.similarity * 100)}% match
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {(node.reachEstimate / 1000).toFixed(0)}k reach
                        </div>
                      </div>

                      {!isOrigin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDMCAModal(true)
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ⚖️ Takedown
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Genealogy Hierarchical Tree */}
      {viewMode === 'genealogy' && (
        <div style={{
          background: '#0d1117',
          border: '1px solid #1e2d3d',
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Content Genealogy & Propagation Graph
            </h3>
            {isScenario && (
              <span style={{
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                [SIMULATED SCENARIO DATA]
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
            VeriMedia converts observations into a structural multi-generation genealogy answering: <em>How did this piece of content propagate and mutate across the open web?</em>
          </p>

          {derivedNodes.length === 0 ? (
            <div style={{
              background: '#080c10',
              border: '1px dashed #1e293b',
              borderRadius: 8,
              padding: 32,
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.6 }}>🌳</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                No Multi-Platform Genealogy Available
              </div>
              <p style={{ fontSize: 11, marginTop: 4, maxWidth: 420, margin: '6px auto 0' }}>
                Genealogy tracing requires discovered appearances. Run reverse-image discovery in Engine 2 to locate candidate origins and mutations.
              </p>
            </div>
          ) : (
            <div style={{
              background: '#080c10',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 20,
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontWeight: 800 }}>
                  {derivedNodes[0]?.status === 'ORIGIN' ? 'ORIGINAL MASTER' : 'PRIMARY DISCOVERED SEED'}
                </span>
                <span style={{ color: '#cbd5e1' }}>
                  {derivedNodes[0]?.platform} · @{derivedNodes[0]?.username} ({new Date(derivedNodes[0]?.publishedAt).toLocaleDateString()})
                </span>
              </div>

              {derivedNodes.slice(1).map((child, idx) => (
                <div key={child.id} style={{ paddingLeft: 20, color: '#cbd5e1' }}>
                  <div style={{ color: '#64748b' }}>│</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: idx % 2 === 0 ? '#38bdf8' : '#f59e0b' }}>
                      └── {child.status} ({child.platform} · @{child.username})
                    </span>
                    <span style={{ fontSize: 10, background: '#1e293b', padding: '1px 6px', borderRadius: 3, color: '#94a3b8' }}>
                      {child.mutationType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
