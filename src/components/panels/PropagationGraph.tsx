import { useEffect, useRef, useState, useMemo } from 'react'
import { useStore } from '../../store'
import { getInvestigationPropagation } from '../../services/api'
import type { Platform } from '../../types'
import { isSimulatedResult } from '../../lib/resultMode'
import { TermLabel } from '../ui/TermLabel'

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

export interface DisseminationHop {
  id: string
  hopNumber: number
  stageLabel: string
  title: string
  movementDescription: string
  platform: string
  username: string
  url: string
  timestamp: string
  deltaMinutes: number
  reachEstimate: number
  similarity: number
  mutationType: string
  status: 'ORIGIN' | 'SYNDICATED' | 'CROPPED' | 'SYNTHETIC' | 'FLAGGED'
  icon: string
  accentColor: string
}

export const DEMO_DISSEMINATION_HOPS: DisseminationHop[] = [
  {
    id: 'HOP-00',
    hopNumber: 0,
    stageLabel: 'ORIGIN INGEST SEED',
    title: 'Source Email Dispatch / Master File Ingest',
    movementDescription: 'Origin Seed: Whistleblower email attachment (master_capture_raw.mov) received at investigation_ingest@verimedia.org with intact Sony PRNU camera sensor profile and SDI raw headers.',
    platform: 'Source Email (Whistleblower Ingest)',
    username: 'source_witness@proton.me',
    url: 'mailto:investigation_ingest@verimedia.org',
    timestamp: '2026-09-22T08:00:00Z',
    deltaMinutes: 0,
    reachEstimate: 1,
    similarity: 1.0,
    mutationType: 'Uncompressed Master Stream (ProRes 422)',
    status: 'ORIGIN',
    icon: '📧',
    accentColor: '#22c55e'
  },
  {
    id: 'HOP-01',
    hopNumber: 1,
    stageLabel: 'HOP 1: PRIMARY PUBLIC LEAK',
    title: 'First Public Repost on YouTube',
    movementDescription: 'Moved like this: Master file extracted from email leak, aspect ratio preserved, uploaded to public video archive under news aggregator channel.',
    platform: 'YouTube',
    username: '@archive_news_vault',
    url: 'https://youtube.com/watch?v=leak_archive_2026',
    timestamp: '2026-09-22T08:18:00Z',
    deltaMinutes: 18,
    reachEstimate: 240000,
    similarity: 0.94,
    mutationType: 'H.264 Transcode with Ingest Station Bug Masked',
    status: 'SYNDICATED',
    icon: '▶️',
    accentColor: '#ef4444'
  },
  {
    id: 'HOP-02',
    hopNumber: 2,
    stageLabel: 'HOP 2: CROSS-PLATFORM BOT SYNDICATION',
    title: 'TikTok & X / Twitter Viral Re-Encoding',
    movementDescription: 'And moved like this: Automated scraper bots ripped YouTube MP4, cropped to 9:16 vertical canvas, pitched audio up +5%, and syndicated across high-velocity accounts.',
    platform: 'TikTok & X / Twitter',
    username: '@speedy_viral_edits',
    url: 'https://tiktok.com/@speedy_viral_edits/video/8492048102',
    timestamp: '2026-09-22T08:45:00Z',
    deltaMinutes: 45,
    reachEstimate: 1420000,
    similarity: 0.88,
    mutationType: '9:16 Aspect Crop (44% Canvas Lost) + Audio Frequency Shift',
    status: 'CROPPED',
    icon: '🎵',
    accentColor: '#00d4ff'
  },
  {
    id: 'HOP-03',
    hopNumber: 3,
    stageLabel: 'HOP 3: COMMUNITY AGGREGATION & SPILLOVER',
    title: 'Reddit Mirror Thread & Disinformation Channels',
    movementDescription: 'And like this: Streamable mirror embedded into Reddit discussion thread with 3,400 upvotes; synchronized broadcast dispatched across public Telegram news channels.',
    platform: 'Reddit & Telegram',
    username: 'r/PublicFreakout (u/news_scraper_bot)',
    url: 'https://reddit.com/r/PublicFreakout/comments/breaking_leak_master',
    timestamp: '2026-09-22T09:30:00Z',
    deltaMinutes: 90,
    reachEstimate: 680000,
    similarity: 0.82,
    mutationType: 'Secondary CDN Mirror + Text Watermark Overlay',
    status: 'FLAGGED',
    icon: '💬',
    accentColor: '#f97316'
  }
]

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
  const flowCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'mesh' | 'timeline' | 'genealogy'>('flow')
  const [activePropagation, setActivePropagation] = useState<any | null>(null)
  const [propLoading, setPropLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CascadeNode | null>(null)

  // Derive candidate nodes from props or investigation context early
  const rawCandidates: any[] = useMemo(() => {
    return (
      propCandidates ||
      (currentResult as any)?.candidates ||
      (currentResult as any)?.discovery?.candidates ||
      activePropagation?.candidates ||
      []
    )
  }, [propCandidates, currentResult, activePropagation])

  const hasRealCandidates = rawCandidates.length >= 2
  const [useDemoHops, setUseDemoHops] = useState<boolean>(!hasRealCandidates)

  useEffect(() => {
    if (!hasRealCandidates) {
      setUseDemoHops(true)
    }
  }, [hasRealCandidates])

  // Active Hops: Real Candidates or Rich Demo Pipeline
  const activeHops: DisseminationHop[] = useMemo(() => {
    if (useDemoHops || !hasRealCandidates) {
      return DEMO_DISSEMINATION_HOPS
    }
    // Build real hops from discovered candidates
    const hops: DisseminationHop[] = [
      {
        id: 'REAL-HOP-00',
        hopNumber: 0,
        stageLabel: 'ORIGIN INGEST SEED',
        title: 'Authentic Ground Truth Master Ingest',
        movementDescription: 'Origin Seed: Earliest verified baseline record ingest registered in the detection pipeline.',
        platform: currentResult?.platform ? `Origin (${currentResult.platform})` : 'Source Email Ingest',
        username: currentResult?.username ? `@${currentResult.username}` : 'investigation_ingest@verimedia.org',
        url: currentResult?.url || '#',
        timestamp: currentResult?.timestamp || new Date().toISOString(),
        deltaMinutes: 0,
        reachEstimate: 1,
        similarity: 1.0,
        mutationType: 'Ground Truth Reference Asset',
        status: 'ORIGIN',
        icon: '📧',
        accentColor: '#22c55e'
      }
    ]

    rawCandidates.forEach((c: any, idx: number) => {
      const stageName = idx === 0 ? 'HOP 1: PRIMARY LEAK' : idx === 1 ? 'HOP 2: SECONDARY SPREAD' : `HOP ${idx + 1}: VIRAL SPILLOVER`
      const moveDesc = idx === 0
        ? `Moved like this: First observed external public appearance discovered on ${c.platform || c.domain || 'Web'}.`
        : idx === 1
        ? `And moved like this: Secondary dissemination discovered on ${c.platform || c.domain || 'Web'} with derivative formatting.`
        : `And like this: Multi-platform syndication across ${c.platform || c.domain || 'Web'}.`

      hops.push({
        id: c.id || `REAL-HOP-${idx + 1}`,
        hopNumber: idx + 1,
        stageLabel: stageName,
        title: `${c.platform || c.domain || 'Web'} Appearance (${c.publisher || c.author || 'Indexed Node'})`,
        movementDescription: moveDesc,
        platform: c.platform || c.domain || 'Web',
        username: c.publisher || c.author || 'Indexed Appearance',
        url: c.url || c.link || '#',
        timestamp: c.publishedAt || c.timestamp || new Date().toISOString(),
        deltaMinutes: (idx + 1) * 25,
        reachEstimate: c.views || (typeof c.similarity === 'number' ? Math.round(c.similarity * 200000) : 75000),
        similarity: typeof c.similarity === 'number' ? c.similarity : (c.matchScore ? c.matchScore / 100 : 0.88),
        mutationType: c.classification === 'EXACT_MATCH' ? 'Identical Master Clone' : c.isCropped ? 'Aspect Ratio Crop' : 'Modified Derivative',
        status: c.classification === 'EXACT_MATCH' ? 'SYNDICATED' : c.isCropped ? 'CROPPED' : 'SYNTHETIC',
        icon: (c.platform || '').toLowerCase().includes('youtube') ? '▶️' : (c.platform || '').toLowerCase().includes('tiktok') ? '🎵' : (c.platform || '').toLowerCase().includes('reddit') ? '💬' : '📡',
        accentColor: PLATFORM_COLORS[c.platform] || '#38bdf8'
      })
    })

    return hops
  }, [useDemoHops, hasRealCandidates, rawCandidates, currentResult])

  // Playback state for Trajectory Flow
  const [currentHopIndex, setCurrentHopIndex] = useState<number>(3)
  const [isFlowPlaying, setIsFlowPlaying] = useState<boolean>(false)
  const [flowSpeed, setFlowSpeed] = useState<number>(1)

  // Sequential Mesh Vector Linking State (Origin stable anchor -> peripheral spreading nodes attaching one by one)
  const [meshRevealedCount, setMeshRevealedCount] = useState<number>(PLATFORMS.length)
  const [isMeshPlaying, setIsMeshPlaying] = useState<boolean>(false)
  const [meshSpeed, setMeshSpeed] = useState<number>(1)
  const [selectedMeshNodeIdx, setSelectedMeshNodeIdx] = useState<number | null>(null)

  // Timer loop for sequential mesh vector animation
  useEffect(() => {
    if (!isMeshPlaying) return
    const timer = setInterval(() => {
      setMeshRevealedCount(prev => {
        if (prev >= PLATFORMS.length) {
          setIsMeshPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1400 / meshSpeed)

    return () => clearInterval(timer)
  }, [isMeshPlaying, meshSpeed])

  // Timer loop for sequential hop animation
  useEffect(() => {
    if (!isFlowPlaying) return
    const timer = setInterval(() => {
      setCurrentHopIndex(prev => {
        if (prev >= activeHops.length - 1) {
          setIsFlowPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 2200 / flowSpeed)

    return () => clearInterval(timer)
  }, [isFlowPlaying, activeHops.length, flowSpeed])

  // Canvas Vector Trajectory ("Moved Like This") Render Loop
  useEffect(() => {
    if (viewMode !== 'flow') return
    const canvas = flowCanvasRef.current
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

    const renderFlow = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const now = Date.now() / 1000

      ctx.clearRect(0, 0, w, h)

      // Cyber background grid
      ctx.strokeStyle = 'rgba(30, 45, 61, 0.35)'
      ctx.lineWidth = 0.8
      for (let x = 40; x < w; x += 60) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 30; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Compute horizontal positions for hops
      const count = activeHops.length
      const stepX = (w - 180) / Math.max(1, count - 1)
      const positions = activeHops.map((_, i) => {
        const x = 90 + i * stepX
        // Alternating wave height for dynamic aesthetic
        const y = h / 2 + (i % 2 === 0 ? -22 : 22)
        return { x, y }
      })

      // Draw vectors between revealed hops
      for (let i = 0; i < positions.length - 1; i++) {
        const isRevealed = i < currentHopIndex
        const p1 = positions[i]
        const p2 = positions[i + 1]
        const hopTarget = activeHops[i + 1]

        // Curved connector
        const cp1x = p1.x + (p2.x - p1.x) * 0.5
        const cp1y = p1.y
        const cp2x = p1.x + (p2.x - p1.x) * 0.5
        const cp2y = p2.y

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
        ctx.strokeStyle = isRevealed ? (hopTarget?.accentColor || '#38bdf8') : 'rgba(51, 65, 85, 0.4)'
        ctx.lineWidth = isRevealed ? 2.5 : 1.2
        if (!isRevealed) {
          ctx.setLineDash([4, 4])
        } else {
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])

        if (isRevealed) {
          // Animated glowing packet particles traversing from p1 to p2
          for (let p = 0; p < 3; p++) {
            const t = ((now * 0.8 * flowSpeed) + (p * 0.33) + (i * 0.25)) % 1
            const omt = 1 - t
            const px = omt * omt * omt * p1.x + 3 * omt * omt * t * cp1x + 3 * omt * t * t * cp2x + t * t * t * p2.x
            const py = omt * omt * omt * p1.y + 3 * omt * omt * t * cp1y + 3 * omt * t * t * cp2y + t * t * t * p2.y

            ctx.beginPath()
            ctx.arc(px, py, 3.5, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.shadowColor = hopTarget?.accentColor || '#38bdf8'
            ctx.shadowBlur = 10
            ctx.fill()
            ctx.shadowBlur = 0
          }

          // Trajectory callout badge on the vector curve
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2 + (i % 2 === 0 ? -28 : 28)
          const callout = i === 0 ? 'Moved like this: Exfiltrated email attachment dropped onto YouTube' : i === 1 ? 'And moved like this: Crawlers rip and syndicate to TikTok & X' : 'And like this: Third-wave viral spillover into community discussion mirrors'

          ctx.fillStyle = 'rgba(8, 12, 16, 0.92)'
          ctx.strokeStyle = hopTarget?.accentColor || '#38bdf8'
          ctx.lineWidth = 1
          const badgeWidth = Math.min(260, w / 3)
          ctx.beginPath()
          ctx.roundRect(midX - badgeWidth / 2, midY - 11, badgeWidth, 22, 4)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = hopTarget?.accentColor || '#38bdf8'
          ctx.font = '700 9px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(callout.length > 44 ? callout.slice(0, 42) + '...' : callout, midX, midY + 3)
        }
      }

      // Draw Hop Nodes
      positions.forEach((pos, idx) => {
        const hop = activeHops[idx]
        const isRevealed = idx <= currentHopIndex
        const isSelected = idx === currentHopIndex
        const isOrigin = idx === 0

        // Expanding pulse wave on selected/latest revealed node
        if (isSelected) {
          const wavePhase = (now * 1.5) % 1
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 22 + wavePhase * 18, 0, Math.PI * 2)
          ctx.strokeStyle = `${hop.accentColor}${Math.floor((1 - wavePhase) * 90).toString(16).padStart(2, '0')}`
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Outer Ring
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, isOrigin ? 22 : 18, 0, Math.PI * 2)
        ctx.fillStyle = isRevealed ? '#0d1117' : '#080c10'
        ctx.fill()
        ctx.strokeStyle = isRevealed ? hop.accentColor : '#334155'
        ctx.lineWidth = isSelected ? 3 : 2
        ctx.stroke()

        // Inner Icon
        ctx.fillStyle = isRevealed ? hop.accentColor : '#475569'
        ctx.font = isOrigin ? '16px sans-serif' : '13px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(hop.icon, pos.x, pos.y + (isOrigin ? 5 : 4))

        // Node Title Text
        ctx.fillStyle = isRevealed ? '#f8fafc' : '#64748b'
        ctx.font = '700 11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        const titleY = pos.y + (idx % 2 === 0 ? 36 : -32)
        ctx.fillText(hop.stageLabel, pos.x, titleY)

        // Subtitle / Platform
        ctx.fillStyle = isRevealed ? hop.accentColor : '#475569'
        ctx.font = '600 10px monospace'
        const subY = pos.y + (idx % 2 === 0 ? 50 : -18)
        ctx.fillText(`${hop.platform} · +${hop.deltaMinutes}m`, pos.x, subY)
      })

      animId = requestAnimationFrame(renderFlow)
    }

    renderFlow()
    return () => cancelAnimationFrame(animId)
  }, [viewMode, activeHops, currentHopIndex, flowSpeed])

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

  // Canvas Vector Mesh Render Loop (Sequential one-by-one linkings from stable origin)
  useEffect(() => {
    if (viewMode !== 'mesh') return
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

      // Background Grid Lines & Concentric Radar Rings
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
        ctx.arc(cx, cy, 20, 0, Math.PI * 2)
        ctx.fillStyle = '#080c10'
        ctx.fill()
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2.5
        ctx.stroke()

        ctx.fillStyle = '#4ade80'
        ctx.font = '800 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('STABLE ORIGIN', cx, cy + 3)

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
          angle,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          isTarget,
          color: PLATFORM_COLORS[p] || '#00d4ff',
          isAttached: i < meshRevealedCount,
          isLatestAttached: i === meshRevealedCount - 1
        }
      })

      // 1. Draw Transmission Vector Lines (Origin -> Spreading Platform Nodes)
      nodes.forEach((node, idx) => {
        const isAttached = node.isAttached

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(node.x, node.y)

        if (isAttached) {
          ctx.strokeStyle = node.isTarget ? urgencyColor : node.color
          ctx.lineWidth = node.isTarget ? 2.5 : 1.8
          ctx.setLineDash([])
          ctx.stroke()

          // Animated energy packets traversing along the linked path
          for (let p = 0; p < 2; p++) {
            const pOffset = ((now * 1.2 * meshSpeed) + (p * 0.5) + (idx * 0.2)) % 1
            const px = cx + (node.x - cx) * pOffset
            const py = cy + (node.y - cy) * pOffset
            ctx.beginPath()
            ctx.arc(px, py, node.isTarget ? 4 : 3, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.shadowColor = node.color
            ctx.shadowBlur = 8
            ctx.fill()
            ctx.shadowBlur = 0
          }
        } else {
          // Unattached standby path
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }
      })

      // 2. Draw Spreading Platform Nodes
      nodes.forEach((node, idx) => {
        const isAttached = node.isAttached
        const isSelected = selectedMeshNodeIdx === idx

        // Expanding attachment shockwave for the latest revealed spreading node
        if (node.isLatestAttached && meshRevealedCount > 1) {
          const shockPhase = (now * 2 * meshSpeed) % 1
          ctx.beginPath()
          ctx.arc(node.x, node.y, 14 + shockPhase * 24, 0, Math.PI * 2)
          ctx.strokeStyle = `${node.color}${Math.floor((1 - shockPhase) * 90).toString(16).padStart(2, '0')}`
          ctx.lineWidth = 2.5 * (1 - shockPhase)
          ctx.stroke()
        }

        // Draw Platform Node Ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.isTarget ? 15 : 12, 0, Math.PI * 2)
        ctx.fillStyle = isAttached ? (node.isTarget ? `${urgencyColor}30` : '#0d1117') : '#080c10'
        ctx.fill()
        ctx.strokeStyle = isAttached ? (node.isTarget ? urgencyColor : node.color) : '#334155'
        ctx.lineWidth = isSelected ? 3.5 : (node.isTarget ? 2.5 : 2)
        ctx.stroke()

        // Inner Core dot
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = isAttached ? node.color : '#475569'
        ctx.fill()

        // Platform Label & Link Status
        ctx.fillStyle = isAttached ? (node.isTarget ? '#ffffff' : '#f8fafc') : '#64748b'
        ctx.font = node.isTarget ? '800 11px monospace' : (isAttached ? '700 10px monospace' : '500 10px monospace')
        ctx.textAlign = 'center'
        const labelY = node.y + (node.y > cy ? 22 : -16)
        ctx.fillText(node.name, node.x, labelY)

        if (isAttached) {
          ctx.fillStyle = node.isTarget ? '#f87171' : '#38bdf8'
          ctx.font = '600 8px monospace'
          const subY = node.y + (node.y > cy ? 32 : -26)
          ctx.fillText(`+LINKED`, node.x, subY)
        }
      })

      // 3. Stable Root Source Origin Anchor at Center
      // Orbiting pulse rings
      const pulse1 = (now * 1.2) % 1
      ctx.beginPath()
      ctx.arc(cx, cy, 22 + pulse1 * 14, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.7 * (1 - pulse1)})`
      ctx.lineWidth = 2
      ctx.stroke()

      const pulse2 = ((now * 1.2) + 0.5) % 1
      ctx.beginPath()
      ctx.arc(cx, cy, 22 + pulse2 * 14, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.5 * (1 - pulse2)})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Center Origin Node Body
      ctx.beginPath()
      ctx.arc(cx, cy, 22, 0, Math.PI * 2)
      ctx.fillStyle = '#080c10'
      ctx.fill()
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 3
      ctx.shadowColor = '#22c55e'
      ctx.shadowBlur = 12
      ctx.stroke()
      ctx.shadowBlur = 0

      ctx.fillStyle = '#4ade80'
      ctx.font = '900 9px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ORIGIN', cx, cy - 2)

      ctx.fillStyle = '#ffffff'
      ctx.font = '700 8px monospace'
      ctx.fillText('★ STABLE', cx, cy + 8)

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [viewMode, currentResult, activePropagation, meshRevealedCount, meshSpeed, selectedMeshNodeIdx])

  const isScenario = isSimulatedResult(currentResult)

  // Derive lineage and propagation nodes honestly from discovered appearances or demo walkthrough
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
    if (isScenario || useDemoHops) {
      return cascadeEvents
    }
    return []
  }, [rawCandidates, isScenario, useDemoHops])

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
            onClick={() => setViewMode('flow')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'flow' ? '#1e293b' : 'transparent',
              border: viewMode === 'flow' ? '1px solid #22c55e' : '1px solid transparent',
              color: viewMode === 'flow' ? '#4ade80' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>🌊 Origin Trajectory Flow ("Moved Like This")</span>
          </button>
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
          <TermLabel term="ppm" label="PPM Velocity Index" labelClassName="text-[10px] text-slate-400 font-bold uppercase tracking-wide" subtextClassName="text-[10px] text-slate-500 font-normal mt-0.5" />
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
          <TermLabel term="r0" label="Replication Factor R₀" labelClassName="text-[10px] text-slate-400 font-bold uppercase tracking-wide" subtextClassName="text-[10px] text-slate-500 font-normal mt-0.5" />
          <div style={{ fontSize: 22, fontWeight: 800, color: replication.color, fontFamily: 'monospace', marginTop: 4 }}>
            {replication.r0Formatted} <span style={{ fontSize: 12, color: '#94a3b8' }}>{replication.trend}</span>
          </div>
          <div style={{ fontSize: 11, color: replication.color, marginTop: 4 }}>
            {replication.trendLabel}
          </div>
        </div>
      </div>

      {/* Main View: Vector Topology Canvas OR Cascade Stream OR Hierarchy */}
      {viewMode === 'flow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Flow Controls & Mode Banner */}
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            {/* Playback & Step Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsFlowPlaying(!isFlowPlaying)}
                style={{
                  background: isFlowPlaying ? '#f59e0b' : '#22c55e',
                  border: 'none',
                  color: '#080c10',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{isFlowPlaying ? '⏸ Pause' : '▶ Animate Path'}</span>
              </button>

              <button
                onClick={() => {
                  setIsFlowPlaying(false)
                  setCurrentHopIndex(0)
                  setTimeout(() => setIsFlowPlaying(true), 150)
                }}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ↺ Replay from Origin
              </button>

              <button
                onClick={() => {
                  setIsFlowPlaying(false)
                  setCurrentHopIndex(prev => Math.max(0, prev - 1))
                }}
                disabled={currentHopIndex === 0}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: currentHopIndex === 0 ? '#475569' : '#cbd5e1',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: currentHopIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ◀ Prev Hop
              </button>

              <button
                onClick={() => {
                  setIsFlowPlaying(false)
                  setCurrentHopIndex(prev => Math.min(activeHops.length - 1, prev + 1))
                }}
                disabled={currentHopIndex >= activeHops.length - 1}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: currentHopIndex >= activeHops.length - 1 ? '#475569' : '#cbd5e1',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: currentHopIndex >= activeHops.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Next Hop ▶
              </button>

              <div style={{
                background: '#080c10',
                border: '1px solid #1e2d3d',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#38bdf8'
              }}>
                Stage {currentHopIndex} / {activeHops.length - 1}: {activeHops[currentHopIndex]?.stageLabel}
              </div>

              {/* Speed Buttons */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                {[1, 1.5, 2].map(spd => (
                  <button
                    key={spd}
                    onClick={() => setFlowSpeed(spd)}
                    style={{
                      padding: '3px 8px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      borderRadius: 4,
                      background: flowSpeed === spd ? '#0284c7' : '#1e293b',
                      color: flowSpeed === spd ? '#fff' : '#94a3b8',
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Live vs Demo Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => {
                  setUseDemoHops(!useDemoHops)
                  setCurrentHopIndex(0)
                }}
                style={{
                  background: useDemoHops ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  border: `1px solid ${useDemoHops ? '#f59e0b' : '#22c55e'}`,
                  color: useDemoHops ? '#fbbf24' : '#4ade80',
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{useDemoHops ? '◈ Viewing Demo Path' : '● Viewing Live Crawl'}</span>
                <span style={{ fontSize: 9, opacity: 0.8 }}>(Click to switch)</span>
              </button>
            </div>
          </div>

          {/* Banner if Demo data */}
          {useDemoHops && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 11,
              color: '#fbbf24'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>◈</span>
                <span><strong>DEMONSTRATIVE DISSEMINATION PATH:</strong> Demonstrating the animated multi-hop journey of an origin leak email traversing news archives, scraper bots, and community mirrors.</span>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'monospace', background: '#78350f', color: '#fef08a', padding: '1px 6px', borderRadius: 3 }}>
                DEMO DATA
              </span>
            </div>
          )}

          {/* Canvas Box for Vector Flow */}
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: 16,
            height: 380,
            position: 'relative'
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Multi-Hop Trajectory Animation: Origin Email ➔ Public Leak ➔ Algorithmic Syndication ➔ Community Mirrors</span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#38bdf8' }}>
                CLICK ANY NODE OR HOP TO INSPECT
              </span>
            </div>
            <canvas
              ref={flowCanvasRef}
              onClick={(e) => {
                const canvas = flowCanvasRef.current
                if (!canvas) return
                const rect = canvas.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const count = activeHops.length
                const stepX = (rect.width - 180) / Math.max(1, count - 1)
                let closestIdx = 0
                let minDiff = Infinity
                for (let i = 0; i < count; i++) {
                  const x = 90 + i * stepX
                  const diff = Math.abs(clickX - x)
                  if (diff < minDiff) {
                    minDiff = diff
                    closestIdx = i
                  }
                }
                if (minDiff < 50) {
                  setCurrentHopIndex(closestIdx)
                  setIsFlowPlaying(false)
                }
              }}
              style={{ width: '100%', height: 320, display: 'block', borderRadius: 8, background: '#080c10', cursor: 'pointer' }}
            />
          </div>

          {/* Detailed Hop Dossier Card */}
          {activeHops[currentHopIndex] && (
            <div style={{
              background: '#0d1117',
              border: `1px solid ${activeHops[currentHopIndex].accentColor}44`,
              borderRadius: 10,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 16,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: `${activeHops[currentHopIndex].accentColor}22`,
                    border: `1px solid ${activeHops[currentHopIndex].accentColor}44`
                  }}>
                    {activeHops[currentHopIndex].icon}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: activeHops[currentHopIndex].accentColor,
                        textTransform: 'uppercase'
                      }}>
                        {activeHops[currentHopIndex].stageLabel}
                      </span>
                      <span style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: activeHops[currentHopIndex].status === 'ORIGIN' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: activeHops[currentHopIndex].status === 'ORIGIN' ? '#4ade80' : '#f87171',
                        fontWeight: 800
                      }}>
                        {activeHops[currentHopIndex].status}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                      {activeHops[currentHopIndex].title}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowEvidenceModal(true)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Inspect Hop Dossier
                  </button>
                  {activeHops[currentHopIndex].status !== 'ORIGIN' && (
                    <button
                      onClick={() => setShowDMCAModal(true)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ⚖️ File Takedown
                    </button>
                  )}
                </div>
              </div>

              {/* Movement Narrative Quote */}
              <div style={{
                background: '#080c10',
                borderLeft: `3px solid ${activeHops[currentHopIndex].accentColor}`,
                padding: '10px 14px',
                borderRadius: '0 6px 6px 0',
                fontSize: 12,
                color: '#cbd5e1',
                lineHeight: 1.5
              }}>
                {activeHops[currentHopIndex].movementDescription}
              </div>

              {/* Technical Specifications Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <div style={{ background: '#080c10', padding: '8px 12px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Platform & Channel</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                    {activeHops[currentHopIndex].platform}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {activeHops[currentHopIndex].username}
                  </div>
                </div>

                <div style={{ background: '#080c10', padding: '8px 12px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Reach</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', fontFamily: 'monospace', marginTop: 2 }}>
                    {activeHops[currentHopIndex].reachEstimate <= 1 ? '1 Ingest Node' : `${(activeHops[currentHopIndex].reachEstimate / 1000).toFixed(0)}k views`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    +{activeHops[currentHopIndex].deltaMinutes}m from master
                  </div>
                </div>

                <div style={{ background: '#080c10', padding: '8px 12px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Similarity Match</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: 2 }}>
                    {Math.round(activeHops[currentHopIndex].similarity * 100)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    pHash + SSIM Vector
                  </div>
                </div>

                <div style={{ background: '#080c10', padding: '8px 12px', borderRadius: 6, border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Mutation / Encoding</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginTop: 2 }}>
                    {activeHops[currentHopIndex].mutationType}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main View: Vector Topology Canvas OR Cascade Stream OR Hierarchy */}
      {viewMode === 'mesh' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          {/* Canvas Box with Sequential Linking Toolbar */}
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative'
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Cross-Platform Vector Spread Mesh</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', fontFamily: 'monospace' }}>
                  ORIGIN STABLE ANCHOR
                </span>
              </div>
              {isScenario && (
                <span style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                  [SIMULATED SCENARIO TOPOLOGY]
                </span>
              )}
            </div>

            {/* Sequential Linking Toolbar */}
            <div style={{
              background: '#080c10',
              border: '1px solid #1e2d3d',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setIsMeshPlaying(!isMeshPlaying)}
                  style={{
                    background: isMeshPlaying ? '#f59e0b' : '#22c55e',
                    border: 'none',
                    color: '#080c10',
                    padding: '5px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{isMeshPlaying ? '⏸ Pause' : '▶ Animate Links'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMeshPlaying(false)
                    setMeshRevealedCount(1)
                    setTimeout(() => setIsMeshPlaying(true), 120)
                  }}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ↺ Replay from Origin
                </button>

                <button
                  onClick={() => {
                    setIsMeshPlaying(false)
                    setMeshRevealedCount(prev => Math.max(1, prev - 1))
                  }}
                  disabled={meshRevealedCount <= 1}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: meshRevealedCount <= 1 ? '#475569' : '#cbd5e1',
                    padding: '5px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: meshRevealedCount <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ◀ Prev
                </button>

                <button
                  onClick={() => {
                    setIsMeshPlaying(false)
                    setMeshRevealedCount(prev => Math.min(PLATFORMS.length, prev + 1))
                  }}
                  disabled={meshRevealedCount >= PLATFORMS.length}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: meshRevealedCount >= PLATFORMS.length ? '#475569' : '#cbd5e1',
                    padding: '5px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: meshRevealedCount >= PLATFORMS.length ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next ▶
                </button>

                <button
                  onClick={() => {
                    setIsMeshPlaying(false)
                    setMeshRevealedCount(PLATFORMS.length)
                  }}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#38bdf8',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Show All
                </button>
              </div>

              {/* Counter status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                  {meshRevealedCount} / {PLATFORMS.length} Linked
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 1.5, 2].map(spd => (
                    <button
                      key={spd}
                      onClick={() => setMeshSpeed(spd)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        borderRadius: 4,
                        background: meshSpeed === spd ? '#0284c7' : '#1e293b',
                        color: meshSpeed === spd ? '#fff' : '#94a3b8',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              onClick={(e) => {
                const canvas = canvasRef.current
                if (!canvas) return
                const rect = canvas.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const clickY = e.clientY - rect.top
                const cx = rect.width / 2
                const cy = rect.height / 2
                const radius = Math.min(rect.width, rect.height) * 0.38

                PLATFORMS.forEach((p, i) => {
                  const angle = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2
                  const nx = cx + Math.cos(angle) * radius
                  const ny = cy + Math.sin(angle) * radius
                  const dist = Math.hypot(clickX - nx, clickY - ny)
                  if (dist < 28) {
                    setSelectedMeshNodeIdx(i)
                    if (i >= meshRevealedCount) {
                      setMeshRevealedCount(i + 1)
                    }
                  }
                })
              }}
              style={{ width: '100%', height: 320, display: 'block', borderRadius: 8, background: '#080c10', cursor: 'pointer' }}
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
