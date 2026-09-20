import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { getInvestigationPropagation } from '../../services/api'
import type { Platform } from '../../types'

const PLATFORMS: Platform[] = ['YouTube', 'Reddit', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook']

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#ef4444',
  Reddit: '#f97316',
  Instagram: '#ec4899',
  TikTok: '#00d4ff',
  'X / Twitter': '#94a3b8',
  X: '#94a3b8',
  Facebook: '#3b82f6'
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

export function PropagationGraph() {
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

      // Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - radius - 20, cy)
      ctx.lineTo(cx + radius + 20, cy)
      ctx.moveTo(cx, cy - radius - 20)
      ctx.lineTo(cx, cy + radius + 20)
      ctx.stroke()

      const targetPlatform = currentResult?.platform || 'YouTube'
      const urgency = activePropagation?.urgency || 'high'
      const urgencyColor = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e'

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

  const totalReach = cascadeEvents.reduce((acc, n) => acc + n.reachEstimate, 0)
  const velocity = activePropagation?.velocity ?? 4.8
  const urgency = activePropagation?.urgency ?? 'high'
  const ppm = activePropagation?.ppm ?? 142

  return (
    <div style={{ padding: '20px 24px', width: '100%', minHeight: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 18 }}>

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
          <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>
            ▲ +34% spike in last 60m
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PPM Velocity Index</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171', fontFamily: 'monospace', marginTop: 4 }}>
            {ppm} <span style={{ fontSize: 12, color: '#94a3b8' }}>ppm</span>
          </div>
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
            High viral dissemination
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Combined Reach</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#c084fc', fontFamily: 'monospace', marginTop: 4 }}>
            {(totalReach / 1000).toFixed(0)}k <span style={{ fontSize: 12, color: '#94a3b8' }}>views</span>
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
            Across 5 monitored platforms
          </div>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Replication Factor R₀</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace', marginTop: 4 }}>
            2.4x <span style={{ fontSize: 12, color: '#94a3b8' }}>exponential</span>
          </div>
          <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>
            Secondary reposts accelerating
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
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
              Cross-Platform Vector Spread Mesh
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
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
              ⏱️ Cross-Platform Repost & Mutation Cascade Timeline
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>5 nodes traced in cascade order</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cascadeEvents.map((node) => {
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            })}
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
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Content Genealogy & Propagation Graph
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
            VeriMedia converts observations into a structural multi-generation genealogy answering: <em>How did this piece of content propagate and mutate across the open web?</em>
          </p>

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
                ORIGINAL MASTER
              </span>
              <span style={{ color: '#cbd5e1' }}>Source A (YouTube Official · 10 Jan 08:14 UTC)</span>
            </div>

            <div style={{ paddingLeft: 20, color: '#64748b' }}>│</div>

            <div style={{ paddingLeft: 20, color: '#cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#38bdf8' }}>├── REPOST (Source B · Reddit /r/sports · 11 Jan)</span>
                <span style={{ fontSize: 10, background: '#1e293b', padding: '1px 6px', borderRadius: 3, color: '#94a3b8' }}>Re-encoded H.264</span>
              </div>

              <div style={{ paddingLeft: 28, color: '#64748b' }}>│</div>

              <div style={{ paddingLeft: 28, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#f59e0b' }}>└── CROP MUTATION (Source C · TikTok @viralclips · 12 Jan)</span>
                  <span style={{ fontSize: 10, background: '#1e293b', padding: '1px 6px', borderRadius: 3, color: '#f59e0b' }}>Aspect 9:16 Crop</span>
                </div>

                <div style={{ paddingLeft: 28, color: '#64748b' }}>│</div>

                <div style={{ paddingLeft: 28, color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#a855f7' }}>└── CAPTION CHANGE & SYNTHESIS (Source D · X / Twitter · 13 Jan)</span>
                    <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.2)', padding: '1px 6px', borderRadius: 3, color: '#c084fc' }}>Deepfake Audio Dubbed</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ paddingLeft: 20, color: '#64748b' }}>│</div>

            <div style={{ paddingLeft: 20, color: '#cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#38bdf8' }}>└── RE-ENCODE (Source E · Instagram Reels · 13 Jan)</span>
                <span style={{ fontSize: 10, background: '#1e293b', padding: '1px 6px', borderRadius: 3, color: '#94a3b8' }}>Bitrate -55%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
