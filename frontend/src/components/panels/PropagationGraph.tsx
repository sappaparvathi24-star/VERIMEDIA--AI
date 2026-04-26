import { useEffect, useRef } from 'react'
import { useStore } from '../../store'

const PLATFORM_COLORS: Record<string, string> = {
  'YouTube':    '#ff0000',
  'Instagram':  '#e1306c',
  'TikTok':    '#69c9d0',
  'X / Twitter':'#1da1f2',
  'Facebook':   '#1877f2',
  'Reddit':     '#ff4500',
}

export function PropagationGraph() {
  const { currentResult } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#080c10'
    ctx.fillRect(0, 0, W, H)

    // Background grid
    ctx.strokeStyle = 'rgba(30,45,61,0.5)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    if (!currentResult) {
      ctx.fillStyle = '#4a5568'
      ctx.font = '12px Inter'
      ctx.textAlign = 'center'
      ctx.fillText('Run a detection to view propagation graph', W / 2, H / 2)
      return
    }

    const urgency = currentResult.propagation.urgency
    const velocity = currentResult.propagation.velocity
    const decision = currentResult.ai_analysis.decision

    // Node positions: origin at center, platforms spread out
    const cx = W / 2, cy = H / 2
    const radius = Math.min(W, H) * 0.32

    const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit']
    const platformNodes = PLATFORMS.map((p, i) => {
      const angle = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2
      return {
        name: p,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        color: PLATFORM_COLORS[p] || '#00d4ff',
        active: velocity > 0.2,
      }
    })

    const originColor =
      decision === 'ALLOW' ? '#22c55e' :
      decision === 'EMERGENCY_TAKEDOWN' ? '#dc2626' :
      decision === 'TAKEDOWN' ? '#ef4444' :
      decision === 'SUSPECT' ? '#f97316' : '#f59e0b'

    // Draw connections
    platformNodes.forEach(node => {
      if (!node.active) return
      const intensity = velocity
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(node.x, node.y)
      const grad = ctx.createLinearGradient(cx, cy, node.x, node.y)
      grad.addColorStop(0, `${originColor}88`)
      grad.addColorStop(1, `${node.color}44`)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1 + intensity * 2
      ctx.stroke()

      // Animated dot along edge
      const t = (Date.now() / 1000) % 1
      const dx = node.x - cx, dy = node.y - cy
      const dotX = cx + dx * t, dotY = cy + dy * t
      ctx.beginPath()
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = node.color
      ctx.fill()
    })

    // Draw platform nodes
    platformNodes.forEach(node => {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 12, 0, Math.PI * 2)
      ctx.fillStyle = node.active ? `${node.color}22` : '#1e2d3d'
      ctx.fill()
      ctx.strokeStyle = node.active ? node.color : '#1e2d3d'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.fillStyle = node.active ? node.color : '#4a5568'
      ctx.font = '9px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(node.name.split(' ')[0], node.x, node.y + 22)
    })

    // Draw origin node
    const glowSize = 16 + velocity * 20
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
    glow.addColorStop(0, `${originColor}44`)
    glow.addColorStop(1, 'transparent')
    ctx.beginPath()
    ctx.arc(cx, cy, glowSize, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, 16, 0, Math.PI * 2)
    ctx.fillStyle = `${originColor}22`
    ctx.fill()
    ctx.strokeStyle = originColor
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = originColor
    ctx.font = 'bold 10px JetBrains Mono'
    ctx.textAlign = 'center'
    ctx.fillText('ORIGIN', cx, cy + 4)

    // Stats overlay
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8899aa'
    ctx.font = '10px JetBrains Mono'
    ctx.fillText(`VELOCITY: ${(velocity * 100).toFixed(0)}%`, 12, 20)
    ctx.fillText(`PPM: ${currentResult.propagation.ppm}`, 12, 34)
    ctx.fillStyle = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e'
    ctx.fillText(`URGENCY: ${urgency.toUpperCase()}`, 12, 48)

  }, [currentResult])

  // Animate
  useEffect(() => {
    let raf: number
    const animate = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      // Trigger re-draw by dispatching a fake state change via re-running effect
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #1e2d3d',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Viral Propagation Graph
        </span>
        {currentResult && (
          <span style={{
            padding: '2px 8px', borderRadius: 3, fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            background: currentResult.propagation.urgency === 'critical' ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.1)',
            color: currentResult.propagation.urgency === 'critical' ? '#dc2626' : '#22c55e',
          }}>
            {currentResult.propagation.urgency.toUpperCase()}
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: '100%', display: 'block' }}
      />
    </div>
  )
}
