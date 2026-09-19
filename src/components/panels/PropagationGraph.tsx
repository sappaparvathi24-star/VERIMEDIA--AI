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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  useEffect(() => {
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
        // Render an ambient mesh topology
        ctx.save()
        ctx.fillStyle = 'rgba(100, 116, 139, 0.15)'
        ctx.font = '700 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('STANDBY MESH ACTIVE · SELECT SCENARIO OR RUN DETECTION', cx, 30)

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
          ctx.lineWidth = 1.5
          ctx.stroke()

          ctx.fillStyle = '#94a3b8'
          ctx.font = '10px monospace'
          ctx.fillText(node.name.split(' ')[0], node.x, node.y + 20)
        })

        // Center origin
        ctx.beginPath()
        ctx.arc(cx, cy, 14, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 212, 255, 0.15)'
        ctx.fill()
        ctx.strokeStyle = '#00d4ff'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = '#38bdf8'
        ctx.font = '800 9px monospace'
        ctx.fillText('VERIMEDIA', cx, cy + 3)

        ctx.restore()
        animId = requestAnimationFrame(render)
        return
      }

      // ACTIVE SCAN DETECTION STATE
      const urgency = currentResult.propagation.urgency || 'low'
      const velocity = currentResult.propagation.velocity || 0
      const decision = currentResult.ai_analysis?.decision || 'REVIEW REQUIRED'

      const originColor =
        decision === 'ALLOW' ? '#22c55e' :
        decision === 'EMERGENCY_TAKEDOWN' ? '#dc2626' :
        decision === 'TAKEDOWN' ? '#ef4444' :
        decision === 'SUSPECT' ? '#f97316' : '#f59e0b'

      const platformNodes = PLATFORMS.map((p, i) => {
        const angle = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2
        return {
          name: p,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          color: PLATFORM_COLORS[p] || '#00d4ff',
          active: velocity > 0.15 || p === currentResult.platform,
        }
      })

      // Draw connections & stream particles
      platformNodes.forEach(node => {
        if (!node.active) return
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(node.x, node.y)
        const grad = ctx.createLinearGradient(cx, cy, node.x, node.y)
        grad.addColorStop(0, `${originColor}aa`)
        grad.addColorStop(1, `${node.color}55`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5 + velocity * 2.5
        ctx.stroke()

        // Multiple animated dots along edges
        const count = 3
        for (let j = 0; j < count; j++) {
          const phase = (now * (0.8 + velocity * 1.2) + j / count) % 1
          const dotX = cx + (node.x - cx) * phase
          const dotY = cy + (node.y - cy) * phase

          ctx.beginPath()
          ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
          ctx.fillStyle = node.color
          ctx.shadowColor = node.color
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })

      // Outer boundary mesh circle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `${originColor}30`
      ctx.setLineDash([3, 6])
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      // Draw platform nodes
      platformNodes.forEach(node => {
        const isFocus = node.name === currentResult.platform
        const size = isFocus ? 16 : 12

        ctx.beginPath()
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2)
        ctx.fillStyle = node.active ? `${node.color}25` : '#0f172a'
        ctx.fill()
        ctx.strokeStyle = node.active ? node.color : '#334155'
        ctx.lineWidth = isFocus ? 2.5 : 1.5
        ctx.stroke()

        if (isFocus) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, size + 6 + Math.sin(now * 4) * 3, 0, Math.PI * 2)
          ctx.strokeStyle = `${node.color}66`
          ctx.stroke()
        }

        ctx.fillStyle = node.active ? node.color : '#64748b'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.name.split(' ')[0], node.x, node.y + size + 14)
      })

      // Draw origin node
      const pulse = Math.sin(now * 3) * 6
      const glowSize = 18 + velocity * 22 + pulse
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
      glow.addColorStop(0, `${originColor}66`)
      glow.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.arc(cx, cy, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
      ctx.strokeStyle = originColor
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = originColor
      ctx.font = '800 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('ORIGIN', cx, cy + 4)

      // HUD overlay info in top left corner of canvas
      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748b'
      ctx.font = '700 9px monospace'
      ctx.fillText('FORENSIC METRICS', 16, 24)

      ctx.fillStyle = '#e2e8f0'
      ctx.font = '700 11px monospace'
      ctx.fillText(`VELOCITY: ${(velocity * 100).toFixed(0)}%`, 16, 40)
      ctx.fillText(`PPM SPREAD: ${currentResult.propagation.ppm} ppm`, 16, 56)

      ctx.fillStyle = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e'
      ctx.fillText(`URGENCY: ${urgency.toUpperCase()}`, 16, 72)

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [currentResult])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Canvas Title Bar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #1e2d3d',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tooltip content="Live cross-platform viral spread & vector topology mesh" position="bottom">
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'default' }}>
              📡 Viral Propagation Topology
            </span>
          </Tooltip>
          {currentResult?.propagation?.urgency && (
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
              background: currentResult.propagation.urgency === 'critical' ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.15)',
              color: currentResult.propagation.urgency === 'critical' ? '#dc2626' : '#4ade80',
              border: `1px solid ${currentResult.propagation.urgency === 'critical' ? '#dc2626' : '#22c55e'}`
            }}>
              {currentResult?.propagation?.urgency?.toUpperCase()}
            </span>
          )}
        </div>

        {currentResult && (
          <button
            onClick={() => setShowEvidenceModal(true)}
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#38bdf8',
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🔍 Deep Evidence Review
          </button>
        )}
      </div>

      {/* Canvas Display */}
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
    </div>
  )
}
