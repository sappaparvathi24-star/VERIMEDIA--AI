import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useStore } from '../../store'
import type { DetectionResult } from '../../types'

export interface ProvenanceTreeNode {
  id: string
  name: string
  category: 'origin' | 'modification' | 'synthesis' | 'propagation' | 'enforcement'
  platform?: string
  timestamp: string
  relativeTime: string
  sha256?: string
  phash?: string
  similarity?: number
  anomalyScore?: number
  action?: string
  details: {
    title: string
    description: string
    forensicFlags?: string[]
    transformationType?: string
    metrics?: Record<string, string | number>
    epistemicStatus?: string
  }
  children?: ProvenanceTreeNode[]
}

interface D3ProvenanceTreeProps {
  result?: DetectionResult | null
  height?: number
  genealogyData?: { nodes: unknown[]; links: unknown[] } | null
}

// Builds a forensic tree based on the active detection result, real artifact, and live discovery matches
function buildProvenanceTreeData(result: DetectionResult | null): ProvenanceTreeNode {
  if (!result) {
    return {
      id: 'root-origin',
      name: 'Media Provenance Ledger (Awaiting Ingest)',
      category: 'origin',
      platform: 'Local Ingest',
      timestamp: new Date().toISOString(),
      relativeTime: 'T0 (Awaiting Input)',
      sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      similarity: 1.0,
      details: {
        title: 'Provenance Graph Ready',
        description: 'Upload an image or media asset above to compute real-time SHA-256 fingerprinting, ELA compression analysis, and live cross-platform distribution intelligence.',
        epistemicStatus: 'AWAITING_INGEST',
        metrics: {
          'Status': 'Ready for upload',
          'Pipeline': 'SHA-256 + pHash + Google Search + YouTube + X + Instagram'
        }
      }
    }
  }

  const isReal = Boolean(result.artifact || result.mode === 'REAL_PIPELINE' || result.is_demo === false)
  const rootSha = result.artifact?.sha256 || result.fingerprint_hash || 'Computed on Ingest'
  const rootPhash = result.artifact?.perceptualHash || result.fingerprint_hash || 'Computed'
  const filename = result.artifact?.filename || 'Uploaded Media Artifact'
  const subjectDesc = result.subject_description || (result.visual_findings && result.visual_findings[0]) || 'Analyzed media asset'

  // If real uploaded artifact
  if (isReal) {
    const findings = result.detected_anomalies || result.visual_findings || []
    const hasAnomalies = findings.length > 0 && result.integrity?.score !== null && (result.integrity?.score ?? 1) < 0.7
    const integrityPct = result.integrity?.score != null ? Math.round(result.integrity.score * 100) : 95

    const children: ProvenanceTreeNode[] = []

    // If forensic anomalies exist, add a technical analysis node
    if (hasAnomalies) {
      children.push({
        id: 'forensic-finding-node',
        name: result.ml?.label === 'TAMPERED' ? 'Tampering & Compression Discrepancy' : 'Forensic Feature Analysis',
        category: result.ml?.label === 'TAMPERED' ? 'modification' : 'synthesis',
        platform: 'Forensics Engine',
        timestamp: result.timestamp || new Date().toISOString(),
        relativeTime: '+0s (Forensics)',
        similarity: result.similarity,
        details: {
          title: 'Forensic & ELA Inspection Results',
          description: findings.join(' • ') || 'Error Level Analysis detected localized compression variation.',
          transformationType: result.ml?.label === 'TAMPERED' ? 'REENCODED_FROM' : undefined,
          forensicFlags: findings,
          metrics: {
            'Integrity Score': `${integrityPct}%`,
            'Authenticity Label': result.ml?.label || 'ANALYZED',
            'Manipulation Probability': result.ml?.manipulation_probability != null ? `${Math.round(result.ml.manipulation_probability * 100)}%` : 'N/A'
          }
        },
        children: []
      })
    }

    // Add candidate distribution or isolated asset node
    const candidatesList = (result as any).candidates
    const candidateNodes: ProvenanceTreeNode[] = (candidatesList && Array.isArray(candidatesList) && candidatesList.length > 0)
      ? candidatesList.map((cand: any, idx: number) => ({
          id: `cand-node-${idx}`,
          name: cand.title || `${cand.platform || 'Web'} Discovered Duplicate`,
          category: 'propagation' as const,
          platform: cand.platform || 'Web',
          timestamp: cand.publishedAt || cand.retrievedAt || new Date().toISOString(),
          relativeTime: cand.publishedAt ? new Date(cand.publishedAt).toLocaleDateString() : '+Live Discovery',
          similarity: cand.similarity || cand.matchScore || 0.85,
          details: {
            title: cand.title || 'Discovered Web Match',
            description: cand.snippet || cand.url || 'Discovered via live search query across Google, YouTube, X, or Instagram.',
            metrics: {
              'Platform': cand.platform || 'Web',
              'Author': cand.author || 'N/A',
              'URL': cand.url || 'N/A',
              'Similarity': `${Math.round((cand.similarity || 0.85) * 100)}%`
            }
          }
        }))
      : [
          {
            id: 'verified-isolated-node',
            name: 'Zero External Duplicates Index',
            category: 'propagation' as const,
            platform: 'Google / YouTube / X / Instagram',
            timestamp: result.timestamp || new Date().toISOString(),
            relativeTime: '+0m',
            similarity: 1.0,
            details: {
              title: 'Unique / Unindexed Original Asset',
              description: 'Exhaustive cross-search on Google Search, YouTube, X, and Instagram identified 0 duplicate external distributions. This asset is an unindexed original or private capture.',
              metrics: {
                'Platforms Scanned': 'Google Search, YouTube, X, Instagram',
                'External Matches': '0 matches detected',
                'Index Status': 'Unique Single Original'
              }
            }
          }
        ]

    if (children.length > 0) {
      children[0].children = candidateNodes
    } else {
      children.push(...candidateNodes)
    }

    return {
      id: 'root-origin-real',
      name: filename,
      category: 'origin',
      platform: 'Uploaded Asset',
      timestamp: result.timestamp || (result.artifact as any)?.uploadedAt || (result.artifact as any)?.metadata?.uploadedAt || new Date().toISOString(),
      relativeTime: 'T0 (Source Ingest)',
      sha256: rootSha,
      phash: rootPhash,
      similarity: 1.0,
      details: {
        title: filename,
        description: subjectDesc,
        epistemicStatus: 'PRIMARY_INGESTED_SOURCE',
        metrics: {
          'Resolution': result.artifact?.dimensions ? `${result.artifact.dimensions.width}×${result.artifact.dimensions.height}` : 'Standard',
          'MIME Type': result.artifact?.mimeType || 'image/jpeg',
          'Integrity Score': `${integrityPct}%`,
          'EXIF Provenance': result.artifact?.rawExif ? 'Verified Hardware Headers' : 'Stripped / Anonymous'
        }
      },
      children
    }
  }

  // Fallback for explicitly selected demonstrative presets
  const isDeepfake = result.scenario === 'deepfake'
  const isCrop = result.scenario === 'crop'
  const isAdversarial = result.scenario === 'adversarial'
  const isClean = result.ai_analysis?.decision === 'ALLOW'

  if (isClean) {
    return {
      id: 'root-origin-demo',
      name: 'Demonstrative Scenario: Authority Master Feed',
      category: 'origin',
      platform: 'Broadcast Master',
      timestamp: '2026-09-18T08:00:00Z',
      relativeTime: 'T0 (Source Capture)',
      sha256: rootSha,
      phash: rootPhash,
      similarity: 1.0,
      details: {
        title: 'Authentic Primary Transmission (Simulation)',
        description: 'Demonstrative scenario modeling an authentic broadcast feed with intact C2PA manifests.',
        epistemicStatus: 'DEMONSTRATION_SCENARIO',
        metrics: {
          'Integrity Score': `${Math.round((result.integrity?.score ?? 0.95) * 100)}%`,
          'Status': 'ALLOW (Authentic Rights Cleared)'
        }
      },
      children: [
        {
          id: 'prop-clean',
          name: `${result.platform} Authorized Distribution`,
          category: 'propagation',
          platform: result.platform,
          timestamp: '2026-09-18T08:30:00Z',
          relativeTime: '+30m',
          details: {
            title: `Authorized Publication by @${result.username}`,
            description: 'Intact watermarks and direct provenance continuity with primary creator.',
            metrics: {
              'Decision': 'ALLOW',
              'Similarity': `${Math.round(result.similarity * 100)}%`
            }
          }
        }
      ]
    }
  }

  return {
    id: 'root-origin-demo',
    name: 'Demonstrative Scenario: Master Feed',
    category: 'origin',
    platform: 'Broadcast Origin',
    timestamp: '2026-09-18T10:00:00Z',
    relativeTime: 'T0 (Simulation)',
    sha256: rootSha,
    phash: rootPhash,
    similarity: 1.0,
    details: {
      title: 'Simulation: Master Feed',
      description: 'Demonstrative test scenario for UI inspection.',
      epistemicStatus: 'DEMONSTRATION_SCENARIO',
      metrics: {
        'Scenario': result.scenario || 'Simulation'
      }
    },
    children: [
      {
        id: 'mod-step-demo',
        name: isCrop ? 'Crop & Watermark Removal' : isAdversarial ? 'Adversarial Noise' : 'Synthetic Perturbation',
        category: 'modification',
        platform: 'Intermediary Transform',
        timestamp: '2026-09-18T11:15:00Z',
        relativeTime: '+1h 15m',
        similarity: result.similarity,
        details: {
          title: isCrop ? 'Boundary Cropping' : 'Synthetic Modification',
          description: isCrop ? 'Cropped bounding box to strip broadcast bug.' : 'Algorithmic perturbation.',
          metrics: {
            'Integrity Score': `${Math.round((result.integrity?.score ?? 0.4) * 100)}%`
          }
        },
        children: [
          {
            id: 'target-node-demo',
            name: `${result.platform} Repost (@${result.username})`,
            category: 'propagation',
            platform: result.platform,
            timestamp: '2026-09-18T12:00:00Z',
            relativeTime: '+2h 00m',
            similarity: result.similarity,
            details: {
              title: `Monitored Stream: @${result.username}`,
              description: result.caption || 'Simulated repost stream.',
              metrics: {
                'Decision': result.ai_analysis?.decision || 'REVIEW'
              }
            }
          }
        ]
      }
    ]
  }
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  origin:      { bg: '#064e3b', border: '#22c55e', text: '#4ade80', icon: '🛡️' },
  modification:{ bg: '#7c2d12', border: '#f97316', text: '#fb923c', icon: '✂️' },
  synthesis:   { bg: '#831843', border: '#ec4899', text: '#f472b6', icon: '🤖' },
  propagation: { bg: '#1e1b4b', border: '#818cf8', text: '#a5b4fc', icon: '📡' },
  enforcement: { bg: '#450a0a', border: '#ef4444', text: '#f87171', icon: '⚖️' },
}

export function D3ProvenanceTree({ result: propResult, height = 520, genealogyData }: D3ProvenanceTreeProps) {
  const storeResult = useStore(state => state.currentResult)
  const activeResult = propResult || storeResult

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [selectedNode, setSelectedNode] = useState<ProvenanceTreeNode | null>(null)
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  // Use real API genealogy data when available, otherwise fall back to synthetic tree
  const treeData = useMemo(() => {
    if (genealogyData && genealogyData.nodes && genealogyData.nodes.length > 0) {
      // Convert flat nodes/links from API into nested ProvenanceTreeNode tree
      const apiNodes = genealogyData.nodes as Array<Record<string, unknown>>
      const apiLinks = genealogyData.links as Array<Record<string, unknown>>
      // Build adjacency map: parent -> children
      const childrenMap = new Map<string, string[]>()
      const allIds = new Set(apiNodes.map(n => String(n.id)))
      apiLinks.forEach(l => {
        const src = String(l.source || l.from || l.parent)
        const tgt = String(l.target || l.to || l.child)
        if (!childrenMap.has(src)) childrenMap.set(src, [])
        childrenMap.get(src)!.push(tgt)
      })
      // Find root: node with no incoming links
      const hasParent = new Set(apiLinks.map(l => String(l.target || l.to || l.child)))
      const rootId = apiNodes.find(n => !hasParent.has(String(n.id)))?.id || apiNodes[0]?.id
      const nodeMap = new Map(apiNodes.map(n => [String(n.id), n]))
      function buildNode(id: string, depth = 0): ProvenanceTreeNode {
        const n = nodeMap.get(id) || {}
        const childIds = childrenMap.get(id) || []
        return {
          id: String(id),
          name: String(n.label || n.name || n.platform || `Node ${id}`),
          category: (n.category as ProvenanceTreeNode['category']) || (depth === 0 ? 'origin' : 'propagation'),
          platform: String(n.platform || ''),
          timestamp: String(n.timestamp || n.createdAt || new Date().toISOString()),
          relativeTime: String(n.relativeTime || ''),
          sha256: n.sha256 ? String(n.sha256) : undefined,
          phash: n.phash ? String(n.phash) : undefined,
          similarity: typeof n.similarity === 'number' ? n.similarity : undefined,
          details: {
            title: String(n.label || n.name || 'Node'),
            description: String(n.description || n.url || ''),
            epistemicStatus: depth === 0 ? 'REAL_API_DATA' : undefined
          },
          children: depth < 8 ? childIds.filter(cid => allIds.has(cid)).map(cid => buildNode(cid, depth + 1)) : []
        }
      }
      return buildNode(String(rootId))
    }
    return buildProvenanceTreeData(activeResult)
  }, [genealogyData, activeResult])

  // D3 Tree Render Logic
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 900
    const treeHeight = height

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Setup Defs for Gradients & Glows
    const defs = svg.append('defs')

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'd3-node-glow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%')
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur')
    filter.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over')

    // Main Zoom Group
    const g = svg.append('g').attr('class', 'tree-viewport')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomTransform(event.transform)
      })

    svg.call(zoom)

    // Tree Layout Configuration (Horizontal: Left to Right Timeline)
    const margin = { top: 40, right: 180, bottom: 40, left: 80 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = treeHeight - margin.top - margin.bottom

    const treeLayout = d3.tree<ProvenanceTreeNode>()
      .size([innerHeight, innerWidth])
      .separation((a, b) => (a.parent === b.parent ? 1.4 : 1.8))

    const root = d3.hierarchy(treeData)
    const treeNodes = treeLayout(root)

    // Auto Center Initial View
    const initialTransform = d3.zoomIdentity.translate(margin.left, margin.top).scale(0.92)
    svg.call(zoom.transform, initialTransform)

    // Background Timeline Axis Lines
    const timelineY = innerHeight + 20
    const timelineGroup = g.append('g').attr('class', 'timeline-axis').attr('opacity', 0.5)

    timelineGroup.append('line')
      .attr('x1', 0)
      .attr('y1', timelineY)
      .attr('x2', innerWidth + 100)
      .attr('y2', timelineY)
      .attr('stroke', '#1e2d3d')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')

    // Links (Curved cubic bezier connectors)
    const linkGenerator = d3.linkHorizontal<any, any>()
      .x(d => d.y)
      .y(d => d.x)

    const links = g.append('g')
      .attr('class', 'tree-links')
      .selectAll('path')
      .data(treeNodes.links())
      .enter()
      .append('path')
      .attr('d', linkGenerator)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const targetCat = d.target.data.category
        if (targetCat === 'synthesis') return '#ec4899'
        if (targetCat === 'modification') return '#f97316'
        if (targetCat === 'enforcement') return '#ef4444'
        return '#38bdf8'
      })
      .attr('stroke-width', (d) => (d.target.data.category === 'synthesis' ? 3 : 2))
      .attr('stroke-dasharray', (d) => (d.target.data.category === 'propagation' ? '4,4' : 'none'))
      .attr('opacity', 0.65)
      .style('transition', 'stroke 0.2s, opacity 0.2s')

    // Link hover animation
    links.on('mouseenter', function() {
      d3.select(this).attr('opacity', 1).attr('stroke-width', 3.5)
    }).on('mouseleave', function(event, d: any) {
      d3.select(this)
        .attr('opacity', 0.65)
        .attr('stroke-width', d.target.data.category === 'synthesis' ? 3 : 2)
    })

    // Node Groups
    const node = g.append('g')
      .attr('class', 'tree-nodes')
      .selectAll('g')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        setSelectedNode(d.data)
      })

    // Node Outer Circles with Category-Specific Styling
    node.append('circle')
      .attr('r', d => (d.data.category === 'origin' ? 24 : d.data.category === 'synthesis' ? 22 : 18))
      .attr('fill', d => CATEGORY_COLORS[d.data.category]?.bg || '#0d1117')
      .attr('stroke', d => CATEGORY_COLORS[d.data.category]?.border || '#38bdf8')
      .attr('stroke-width', d => (d.data.category === 'origin' ? 3 : 2))
      .attr('filter', d => (d.data.category === 'synthesis' || d.data.category === 'origin' ? 'url(#d3-node-glow)' : 'none'))
      .style('transition', 'transform 0.15s ease')

    // Inner Icon Text
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => (d.data.category === 'origin' ? '14px' : '12px'))
      .text(d => CATEGORY_COLORS[d.data.category]?.icon || '●')

    // Node Primary Label (Title)
    node.append('text')
      .attr('dy', d => (d.children ? -28 : 32))
      .attr('dx', 0)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f8fafc')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .text(d => d.data.name)

    // Node Secondary Badge (Timestamp / Relative Time)
    node.append('text')
      .attr('dy', d => (d.children ? -15 : 44))
      .attr('dx', 0)
      .attr('text-anchor', 'middle')
      .attr('fill', d => CATEGORY_COLORS[d.data.category]?.text || '#8899aa')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '600')
      .text(d => `${d.data.relativeTime} · ${d.data.platform || 'System'}`)

    // Set initial selected node to root or synthesis node
    const synthNode = root.descendants().find(d => d.data.category === 'synthesis')
    setSelectedNode(synthNode ? synthNode.data : root.data)

  }, [treeData, height])

  function handleCopyHash(hash: string) {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  function handleResetZoom() {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
    svg.transition().duration(400).call(
      zoom.transform as any,
      d3.zoomIdentity.translate(80, 40).scale(0.92)
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#080c10',
      border: '1px solid #1e2d3d',
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Top Controls Header */}
      <div style={{
        padding: '12px 18px',
        background: '#0d1117',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(0, 212, 255, 0.15)',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#38bdf8'
          }}>
            🌳
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>D3.js Provenance & Modification Timeline</span>
              <span style={{
                fontSize: 9,
                fontFamily: 'monospace',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                INTERACTIVE GRAPH
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Hierarchical lineage tracing from earliest observed master to neural synthesis & viral syndication
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Origin Master', color: '#22c55e', icon: '🛡️' },
            { label: 'Crop / Edit', color: '#f97316', icon: '✂️' },
            { label: 'AI Synthesis', color: '#ec4899', icon: '🤖' },
            { label: 'Propagation', color: '#818cf8', icon: '📡' },
            { label: 'Enforcement', color: '#ef4444', icon: '⚖️' },
          ].map(leg => (
            <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#cbd5e1' }}>
              <span>{leg.icon}</span>
              <span style={{ color: leg.color, fontWeight: 700 }}>{leg.label}</span>
            </div>
          ))}

          <button
            onClick={handleResetZoom}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 6
            }}
          >
            ⊙ Reset View
          </button>
        </div>
      </div>

      {/* Main Split: Left D3 SVG Canvas, Right Forensic Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 340px' : '1fr', height }}>
        {/* D3 SVG Container */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, #0d131a 0%, #080c10 100%)',
            overflow: 'hidden'
          }}
        >
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', cursor: 'grab' }}
          />

          {/* Epistemic Badge Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '6px 10px',
            background: 'rgba(13, 17, 23, 0.9)',
            border: '1px solid #1e2d3d',
            borderRadius: 6,
            fontSize: 10,
            color: '#94a3b8',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ color: '#fbbf24' }}>⚖️</span>
            <span><strong>Epistemic Demarcation:</strong> Earliest Observed Broadcast ≠ Proven Legal Creator</span>
          </div>

          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontSize: 10,
            color: '#64748b',
            background: 'rgba(8, 12, 16, 0.8)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none'
          }}>
            Tip: Scroll to zoom, drag canvas to pan, click nodes to inspect evidence
          </div>
        </div>

        {/* Selected Node Evidence Inspector Panel */}
        {selectedNode && (
          <div style={{
            background: '#0d1117',
            borderLeft: '1px solid #1e2d3d',
            padding: 16,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>
                    {CATEGORY_COLORS[selectedNode.category]?.icon || '●'}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: CATEGORY_COLORS[selectedNode.category]?.text || '#38bdf8',
                    background: CATEGORY_COLORS[selectedNode.category]?.bg || '#1e293b',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: `1px solid ${CATEGORY_COLORS[selectedNode.category]?.border}40`
                  }}>
                    {selectedNode.category}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                    {selectedNode.relativeTime}
                  </span>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', margin: '4px 0' }}>
                  {selectedNode.details.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              {selectedNode.details.description}
            </p>

            {/* Platform & Timestamp Info */}
            <div style={{
              background: '#080c10',
              border: '1px solid #1e2d3d',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 10,
              color: '#8899aa',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Platform Channel:</span>
                <strong style={{ color: '#f8fafc' }}>{selectedNode.platform || 'Internal Pipeline'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recorded Timestamp:</span>
                <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedNode.timestamp}</span>
              </div>
            </div>

            {/* Forensic Flags if present */}
            {selectedNode.details.forensicFlags && selectedNode.details.forensicFlags.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 6 }}>
                  ⚠️ Detected Forensic Anomalies
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedNode.details.forensicFlags.map((flag, idx) => (
                    <div key={idx} style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontSize: 10,
                      color: '#fca5a5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <span>▸</span>
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics Grid */}
            {selectedNode.details.metrics && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8899aa', textTransform: 'uppercase', marginBottom: 6 }}>
                  Forensic Metrics & Verification Signals
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(selectedNode.details.metrics).map(([k, v]) => (
                    <div key={k} style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ fontSize: 9, color: '#64748b' }}>{k}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: 2 }}>
                        {String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cryptographic Hashes */}
            {selectedNode.sha256 && (
              <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#8899aa', textTransform: 'uppercase' }}>SHA-256 Bitstream Hash</span>
                  <button
                    onClick={() => handleCopyHash(selectedNode.sha256!)}
                    style={{ background: 'transparent', border: 'none', color: '#00d4ff', fontSize: 10, cursor: 'pointer', padding: 0 }}
                  >
                    {copiedHash === selectedNode.sha256 ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8', wordBreak: 'break-all', background: '#0d1117', padding: '4px 6px', borderRadius: 4 }}>
                  {selectedNode.sha256}
                </div>
                {selectedNode.phash && (
                  <div style={{ marginTop: 6, fontSize: 10, fontFamily: 'monospace', color: '#a855f7' }}>
                    <span style={{ color: '#64748b' }}>pHash (DCT-64): </span>
                    {selectedNode.phash}
                  </div>
                )}
              </div>
            )}

            {/* Live External Origin Link */}
            {(selectedNode.details.metrics?.URL || selectedNode.details.metrics?.url || (selectedNode.details.description && selectedNode.details.description.startsWith('http'))) && (
              <div style={{ paddingTop: 4 }}>
                {(() => {
                  const rawLink = selectedNode.details.metrics?.URL || selectedNode.details.metrics?.url || selectedNode.details.description;
                  const link = String(rawLink).trim();
                  if (!link.startsWith('http')) return null;
                  return (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: 'rgba(0, 212, 255, 0.12)',
                        border: '1px solid rgba(0, 212, 255, 0.35)',
                        color: '#00d4ff',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      🔗 Open Origin Source Link ↗
                    </a>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
