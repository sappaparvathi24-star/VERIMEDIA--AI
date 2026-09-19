import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

const PLATFORM_COLORS: Record<string, string> = {
  'YouTube':    '#ff0000',
  'Instagram':  '#e1306c',
  'TikTok':    '#25f4ee',
  'X / Twitter':'#1da1f2',
  'Facebook':   '#1877f2',
  'Reddit':     '#ff4500',
}

export function PropagationGraph() {
  const { currentResult, setShowEvidenceModal, setShowDMCAModal } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewMode, setViewMode] = useState<'mesh' | 'genealogy'>('mesh')

  useEffect(() => {
    if (viewMode !== 'mesh') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    const render = () => {
      const W = canvas.width = canvas.offsetWidth
      const H = canvas.height = canvas.offsetHeight

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#080c10'
      ctx.fillRect(0, 0, W, H)

      // Grid background
      ctx.strokeStyle = 'rgba(30, 45, 61, 0.35)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 36) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 36) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      const cx = W / 2, cy = H / 2
      const radius = Math.min(W, H) * 0.32
      const now = Date.now() / 1000

      const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit']

      if (!currentResult || !currentResult.propagation) {
        // IDLE DEMO GRAPH STATE
        ctx.save()
        ctx.fillStyle = 'rgba(100, 116, 139, 0.25)'
        ctx.font = '700 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('STANDBY PROPAGATION MESH ACTIVE · ENGINE 4 READY', cx, 30)

        // Draw ambient network
        const idleNodes = PLATFORMS.map((p, i) => {
          const angle = (i / PLATFORMS.length) * Math.PI * 2 + now * 0.05
          return {
            name: p,
            x: cx + Math.cos(angle) * (radius * 0.85),
            y: cy + Math.sin(angle) * (radius * 0.85),
            color: PLATFORM_COLORS[p] || '#00d4ff'
          }
        })

        // Outer ring
        ctx.beginPath()
        ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.12)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 6])
        ctx.stroke()
        ctx.setLineDash([])

        // Mesh connections
        idleNodes.forEach((node, i) => {
          const next = idleNodes[(i + 1) % idleNodes.length]
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(next.x, next.y)
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)'
          ctx.lineWidth = 1
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(node.x, node.y)
          ctx.strokeStyle = `${node.color}20`
          ctx.stroke()

          // Draw platform dots
          ctx.beginPath()
          ctx.arc(node.x, node.y, 8, 0, Math.PI * 2)
          ctx.fillStyle = '#0f172a'
          ctx.fill()
          ctx.strokeStyle = node.color
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.fillStyle = '#e2e8f0'
          ctx.font = '700 10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(node.name, node.x, node.y - 14)
        })

        // Center origin pulse
        ctx.beginPath()
        ctx.arc(cx, cy, 14 + Math.sin(now * 3) * 3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 212, 255, 0.15)'
        ctx.fill()
        ctx.strokeStyle = '#00d4ff'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.restore()
        animId = requestAnimationFrame(render)
        return
      }

      // ACTIVE SCAN TOPOLOGY
      const { propagation, platform } = currentResult
      const urgency = propagation.urgency || 'low'
      const urgencyColor = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e'

      // Platform nodes around center
      const nodes = PLATFORMS.map((p, i) => {
        const angle = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2
        const isTarget = p.toLowerCase().includes(platform.toLowerCase()) || platform.toLowerCase().includes(p.toLowerCase())
        return {
          name: p,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          isTarget,
          color: PLATFORM_COLORS[p] || '#00d4ff'
        }
      })

      // Draw perimeter rings
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(30, 45, 61, 0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Draw pulse waves from center
      const wavePhase = (now * 1.5) % 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius * wavePhase, 0, Math.PI * 2)
      ctx.strokeStyle = `${urgencyColor}${Math.floor((1 - wavePhase) * 60).toString(16).padStart(2, '0')}`
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw connection vectors
      nodes.forEach(node => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(node.x, node.y)
        ctx.strokeStyle = node.isTarget ? urgencyColor : 'rgba(30, 45, 61, 0.6)'
        ctx.lineWidth = node.isTarget ? 2.5 : 1
        ctx.stroke()

        // Vector particle flow if target
        if (node.isTarget) {
          const pProgress = (now * 2) % 1
          const px = cx + (node.x - cx) * pProgress
          const py = cy + (node.y - cy) * pProgress
          ctx.beginPath()
          ctx.arc(px, py, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.shadowColor = urgencyColor
          ctx.shadowBlur = 10
          ctx.fill()
          ctx.shadowBlur = 0
        }

        // Draw Platform Node
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.isTarget ? 14 : 9, 0, Math.PI * 2)
        ctx.fillStyle = node.isTarget ? `${urgencyColor}25` : '#0d1117'
        ctx.fill()
        ctx.strokeStyle = node.isTarget ? urgencyColor : '#334155'
        ctx.lineWidth = node.isTarget ? 2.5 : 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = node.isTarget ? '#fff' : '#8899aa'
        ctx.font = node.isTarget ? '800 11px monospace' : '600 10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.name, node.x, node.y + (node.y > cy ? 22 : -18))
      })

      // Center Origin Node
      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.fillStyle = '#080c10'
      ctx.fill()
      ctx.strokeStyle = urgencyColor
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#00d4ff'
      ctx.font = '800 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('ROOT', cx, cy + 3)

      // Stats HUD (Top Left)
      ctx.textAlign = 'left'
      ctx.font = '800 11px monospace'
      ctx.fillStyle = '#38bdf8'
      ctx.fillText(`VELOCITY: ${propagation.velocity || 42} shares/min`, 16, 28)
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`PPM INDEX: ${propagation.ppm || 120} ppm`, 16, 44)
      ctx.fillStyle = urgencyColor
      ctx.fillText(`URGENCY: ${urgency.toUpperCase()}`, 16, 60)

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [currentResult, viewMode])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#080c10' }}>
      {/* Canvas Title Bar */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid #1e2d3d',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#00d4ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Engine 4 — Propagation Intelligence
          </span>
          {currentResult?.propagation?.urgency && (
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
              background: currentResult.propagation.urgency === 'critical' ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.15)',
              color: currentResult.propagation.urgency === 'critical' ? '#dc2626' : '#4ade80',
              border: `1px solid ${currentResult.propagation.urgency === 'critical' ? '#dc2626' : '#22c55e'}`
            }}>
              {currentResult?.propagation?.urgency?.toUpperCase()} SPREAD
            </span>
          )}
        </div>

        {/* View Mode Toggle: Topology Mesh vs Genealogy Graph */}
        <div style={{ display: 'flex', gap: 6, background: '#080c10', padding: 3, borderRadius: 6, border: '1px solid #1e2d3d' }}>
          <button
            onClick={() => setViewMode('mesh')}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'mesh' ? '#1e293b' : 'transparent',
              border: viewMode === 'mesh' ? '1px solid #00d4ff' : '1px solid transparent',
              color: viewMode === 'mesh' ? '#00d4ff' : '#8899aa',
              cursor: 'pointer'
            }}
          >
            📡 Vector Topology
          </button>
          <button
            onClick={() => setViewMode('genealogy')}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              background: viewMode === 'genealogy' ? '#1e293b' : 'transparent',
              border: viewMode === 'genealogy' ? '1px solid #00d4ff' : '1px solid transparent',
              color: viewMode === 'genealogy' ? '#00d4ff' : '#8899aa',
              cursor: 'pointer'
            }}
          >
            🌳 Content Genealogy
          </button>
        </div>
      </div>

      {/* Main Body */}
      {viewMode === 'mesh' ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* Floating Active Result Overlay Box (Top Right) */}
          {currentResult && (
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 280,
              background: 'rgba(13, 17, 23, 0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #1e2d3d',
              borderRadius: 10,
              padding: 14,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              pointerEvents: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                  JOB ID: {(currentResult.job_id || '').slice(0, 8).toUpperCase()}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                  background: currentResult.ai_analysis?.decision === 'TAKEDOWN' || currentResult.ai_analysis?.decision === 'EMERGENCY_TAKEDOWN' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: currentResult.ai_analysis?.decision === 'TAKEDOWN' || currentResult.ai_analysis?.decision === 'EMERGENCY_TAKEDOWN' ? '#f87171' : '#4ade80',
                  border: `1px solid ${currentResult.ai_analysis?.decision === 'TAKEDOWN' || currentResult.ai_analysis?.decision === 'EMERGENCY_TAKEDOWN' ? '#ef4444' : '#22c55e'}`
                }}>
                  {currentResult.ai_analysis?.decision || 'ANALYZED'}
                </span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{currentResult.username}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                "{currentResult.caption}"
              </div>

              {/* Score Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {Math.round((currentResult.similarity || 0) * 100)}%
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Similarity
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc', fontFamily: 'monospace' }}>
                    {Math.round((currentResult.ai_analysis?.confidence || 0) * 100)}%
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    AI Confidence
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowEvidenceModal(true)}
                  style={{
                    flex: 1,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Inspect Report
                </button>

                {currentResult.ai_analysis?.dmca_needed && (
                  <button
                    onClick={() => setShowDMCAModal(true)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📋 DMCA
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Content Genealogy Tree View */
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 10,
            padding: 20,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Content Genealogy & Propagation Graph
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
              Instead of a flat list of platform search hits, VeriMedia converts observations into a structural multi-generation genealogy answering: <em>How did this piece of content propagate and mutate across the open web?</em>
            </p>

            {/* Hierarchical Genealogy Flow */}
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

                <div style={{ paddingLeft: 28, color: '#64748b' }}>│</div>

                <div style={{ paddingLeft: 28, color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#22c55e' }}>└── SOCIAL DISTRIBUTION CASCADE (42 Syndicated Reposts)</span>
                    <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', padding: '1px 6px', borderRadius: 3, color: '#4ade80' }}>Sybil Deduplicated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
