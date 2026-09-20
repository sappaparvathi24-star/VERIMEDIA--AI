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

// Builds a realistic forensic tree based on the active detection result and scenario
function buildProvenanceTreeData(result: DetectionResult | null): ProvenanceTreeNode {
  if (!result) {
    return {
      id: 'root-origin',
      name: 'Authoritative Broadcast Master Feed',
      category: 'origin',
      platform: 'Broadcast Master',
      timestamp: '2026-09-18T10:15:00Z',
      relativeTime: 'T0 (Original Feed)',
      sha256: '9f83a2e1d74b9c8e12a0d8e6a5f2e3c1b4d8a7c2e6f5d4b3a2c1e0f9a8b7c6d5',
      phash: 'A4F8C12B9D0E3F5A',
      similarity: 1.0,
      details: {
        title: 'Earliest Observed Broadcast Archive',
        description: 'Original high-bitrate broadcast master with valid EXIF headers, linear PRNU sensor noise, and intact digital watermarks.',
        epistemicStatus: 'EARLIEST_OBSERVED_SOURCE',
        metrics: {
          'Resolution': '3840x2160 (4K UHD)',
          'Color Gamut': 'Rec.709 (4:2:2)',
          'Integrity Score': '98.5%',
          'PRNU Uniformity': 'Nominal (0.02)'
        }
      },
      children: [
        {
          id: 'mod-1',
          name: 'Spatial Crop & Re-encoding',
          category: 'modification',
          platform: 'Local Workstation',
          timestamp: '2026-09-18T11:42:00Z',
          relativeTime: '+1h 27m',
          sha256: '5d4e3f2a1b0c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4',
          phash: 'A4F8C12B9D0E77FF',
          similarity: 0.94,
          details: {
            title: 'Watermark Removal & Aspect Ratio Crop',
            description: '16:9 widescreen cropped to 9:16 vertical short format. Lower-right broadcast bug removed using bilinear boundary inpainting.',
            transformationType: 'CROPPED_FROM',
            forensicFlags: ['Crop Boundary Gradient Mismatch', 'Bilinear Inpainting Artifacts'],
            metrics: {
              'Resolution': '1080x1920 (Vertical)',
              'Aspect Ratio Δ': '-43.7%',
              'ELA Quantization Variance': '34.2%'
            }
          },
          children: [
            {
              id: 'synth-1',
              name: 'Neural Face-Swap & Voice Clone',
              category: 'synthesis',
              platform: 'Generative AI Engine',
              timestamp: '2026-09-18T12:05:00Z',
              relativeTime: '+1h 50m',
              sha256: '8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7',
              phash: 'B2E7C12B8C0D3E1A',
              similarity: 0.88,
              anomalyScore: 0.92,
              details: {
                title: 'Deepfake Synthesis Injection',
                description: 'Delaunay facial keypoint perturbation detected. Viseme-to-phoneme audio delay of +185ms indicating synthetic speech replacement.',
                transformationType: 'SYNTHESIZED_DEEPFAKE',
                forensicFlags: ['Delaunay Mesh Discontinuity (+48%)', 'Lip-Sync Temporal Drift (+185ms)', 'Optical Flow Jitter'],
                metrics: {
                  'Manipulation Prob.': '94.8%',
                  'Landmark Variance': '0.78 (Elevated)',
                  'Audio Correlation': '0.31 (Mismatched)'
                }
              },
              children: [
                {
                  id: 'prop-1',
                  name: 'YouTube Unauthorized Upload',
                  category: 'propagation',
                  platform: 'YouTube',
                  timestamp: '2026-09-18T12:30:00Z',
                  relativeTime: '+2h 15m',
                  details: {
                    title: 'Initial Viral Seeding Point',
                    description: 'Uploaded by @ai_generated_news. Propagation velocity peaked at 840 views/min across news recommendation feeds.',
                    metrics: {
                      'Velocity': '840 views/min',
                      'Account Trust': '18.4% (Low)',
                      'Sybil Cluster': 'Group-YT-01'
                    }
                  },
                  children: [
                    {
                      id: 'enf-1',
                      name: 'DMCA Takedown Filed & Enforced',
                      category: 'enforcement',
                      platform: 'Automated Rights Vault',
                      timestamp: '2026-09-18T13:10:00Z',
                      relativeTime: '+2h 55m',
                      action: 'EMERGENCY_TAKEDOWN',
                      details: {
                        title: 'Tamper-Evident Legal Action',
                        description: 'Automated DMCA notice served with attached SHA-256 bitstream proof and 9-signal forensic dossier.',
                        metrics: {
                          'Case ID': 'CASE-2026-0918-01',
                          'Status': 'ENFORCED',
                          'Response SLA': '40 minutes'
                        }
                      }
                    }
                  ]
                },
                {
                  id: 'prop-2',
                  name: 'TikTok Viral Mirror & Clip',
                  category: 'propagation',
                  platform: 'TikTok',
                  timestamp: '2026-09-18T13:00:00Z',
                  relativeTime: '+2h 45m',
                  details: {
                    title: 'Cross-Platform Syndication',
                    description: 'Re-uploaded with high-pass audio filter and overlay captions to bypass basic audio fingerprinting.',
                    metrics: {
                      'Velocity': '1,420 ppm',
                      'Recompression': 'H.264 CRF 31',
                      'Sybil Cluster': 'Group-TT-08'
                    }
                  }
                },
                {
                  id: 'prop-3',
                  name: 'Reddit Forum Discussion Cross-Post',
                  category: 'propagation',
                  platform: 'Reddit',
                  timestamp: '2026-09-18T13:45:00Z',
                  relativeTime: '+3h 30m',
                  details: {
                    title: 'Subreddit Aggregation',
                    description: 'Cross-posted to r/videos and r/technology. Collapsed into 1 single independence group under Sybil defense.',
                    metrics: {
                      'Independence Group': 'Group-RD-04 (Single Corroborator)',
                      'Upvotes': '3,840'
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  }

  const isDeepfake = result.scenario === 'deepfake'
  const isCrop = result.scenario === 'crop'
  const isAdversarial = result.scenario === 'adversarial'
  const isClean = result.ai_analysis.decision === 'ALLOW'

  const rootSha = result.artifact?.sha256 || '6f5e8d9c0b1a23456789abcdef0123456789abcdef0123456789abcdef012345'
  const rootPhash = result.fingerprint_hash || result.artifact?.perceptualHash || 'A4F8C12B9D0E3F5A'

  if (isClean) {
    return {
      id: 'root-origin',
      name: 'Original Broadcast Authority Feed',
      category: 'origin',
      platform: 'Broadcast Master',
      timestamp: '2026-09-18T08:00:00Z',
      relativeTime: 'T0 (Source Capture)',
      sha256: rootSha,
      phash: rootPhash,
      similarity: 1.0,
      details: {
        title: 'Authentic Primary Transmission',
        description: 'Unaltered master recording with verified C2PA cryptographic signature, continuous EXIF metadata, and uniform sensor PRNU noise.',
        epistemicStatus: 'EARLIEST_OBSERVED_SOURCE',
        metrics: {
          'Integrity Score': `${Math.round((result.integrity?.score ?? 0.95) * 100)}%`,
          'Authorship Confidence': `${Math.round((result.authorship?.confidence ?? 0.96) * 100)}%`,
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
            description: 'Intact watermarks, valid manifest signatures, and direct provenance continuity with primary creator.',
            metrics: {
              'Decision': 'ALLOW',
              'Similarity': `${Math.round(result.similarity * 100)}%`,
              'Severity': 'STANDARD'
            }
          }
        }
      ]
    }
  }

  return {
    id: 'root-origin',
    name: 'Earliest Observed Archive Feed',
    category: 'origin',
    platform: 'Broadcast Origin',
    timestamp: '2026-09-18T10:00:00Z',
    relativeTime: 'T0 (Earliest Observation)',
    sha256: rootSha,
    phash: rootPhash,
    similarity: 1.0,
    details: {
      title: 'Earliest Observed Broadcast Archive',
      description: 'Historical archive candidate identified through multi-source discovery. Intact spatial aspect ratio and original audio track.',
      epistemicStatus: 'EARLIEST_OBSERVED_SOURCE',
      metrics: {
        'Provenance Confidence': `${Math.round((result.authorship?.confidence ?? 0.85) * 100)}%`,
        'Embedding Δ': `${(result.authorship?.embedding_distance ?? 0.04).toFixed(3)}`
      }
    },
    children: [
      {
        id: 'mod-step',
        name: isCrop ? 'Crop & Watermark Removal' : isAdversarial ? 'Adversarial Noise Perturbation' : 'Frame Splice & Compression',
        category: 'modification',
        platform: 'Intermediary Transform',
        timestamp: '2026-09-18T11:15:00Z',
        relativeTime: '+1h 15m',
        sha256: '7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
        phash: isCrop ? 'A4F8C12B9D0E77FF' : 'C1D2E3F4A5B6C7D8',
        similarity: result.similarity,
        details: {
          title: isCrop ? 'Boundary Cropping & Overlay Removal' : isAdversarial ? 'High-Frequency Gradient Perturbation' : 'Quantization Manipulation',
          description: isCrop
            ? 'Cropped bounding box to strip original broadcast identification bug and subtitle tracks.'
            : isAdversarial
            ? 'Adversarial high-frequency spatial noise injected to disrupt deep learning classifier feature vectors.'
            : 'Lossy re-compression with re-sampled audio track and altered timeline sequence.',
          transformationType: isCrop ? 'CROPPED_FROM' : 'REENCODED_FROM',
          forensicFlags: result.integrity?.flags || ['Quantization Table Mismatch', 'Edge Gradient Discontinuity'],
          metrics: {
            'Integrity Score': `${Math.round((result.integrity?.score ?? 0.4) * 100)}%`,
            'JPEG Quantization Mismatch': `${Math.round(((result.integrity?.signals?.jpeg_artifact ?? 0.6)) * 100)}%`
          }
        },
        children: [
          ...(isDeepfake ? [{
            id: 'synth-step',
            name: 'Neural Deepfake Synthesis Node',
            category: 'synthesis' as const,
            platform: 'Generative AI Pipeline',
            timestamp: '2026-09-18T11:45:00Z',
            relativeTime: '+1h 45m',
            anomalyScore: result.ml?.manipulation_probability ?? 0.92,
            details: {
              title: 'Generative Model Manipulation',
              description: 'Facial Delaunay mesh temporal warping with non-linear audio-visual lip synchronization mismatch.',
              transformationType: 'SYNTHESIZED_DEEPFAKE',
              forensicFlags: ['Delaunay Mesh Temporal Jitter', 'Lip-Sync Viseme Delay', 'Sensor PRNU Noise Erasure'],
              metrics: {
                'Manipulation Prob.': `${Math.round((result.ml?.manipulation_probability ?? 0.94) * 100)}%`,
                'Classifier Label': result.ml?.label ?? 'TAMPERED'
              }
            },
            children: [
              {
                id: 'target-node',
                name: `${result.platform} Ingested Post (@${result.username})`,
                category: 'propagation' as const,
                platform: result.platform,
                timestamp: '2026-09-18T12:00:00Z',
                relativeTime: '+2h 00m',
                similarity: result.similarity,
                details: {
                  title: `Active Scan Candidate: @${result.username}`,
                  description: result.caption || 'Unauthorized broadcast repost detected during automated monitoring.',
                  metrics: {
                    'Propagation Rate': `${result.propagation?.ppm ?? 180} ppm`,
                    'Urgency': (result.propagation?.urgency ?? 'high').toUpperCase(),
                    'Decision': result.ai_analysis.decision
                  }
                },
                children: [
                  ...(result.ai_analysis.decision === 'TAKEDOWN' || result.ai_analysis.decision === 'EMERGENCY_TAKEDOWN' ? [{
                    id: 'enf-node',
                    name: 'Automated DMCA Enforcement Action',
                    category: 'enforcement' as const,
                    platform: 'Enforcement Vault',
                    timestamp: '2026-09-18T12:15:00Z',
                    relativeTime: '+2h 15m',
                    action: result.ai_analysis.decision,
                    details: {
                      title: 'Tamper-Proof Enforcement Dossier',
                      description: 'Generated cryptographic DMCA takedown with attached bitstream evidence and chain-of-custody log.',
                      metrics: {
                        'Case ID': result.case_id || 'CASE-2026-ENF-01',
                        'Action Policy': result.ai_analysis.action || 'Issue Immediate DMCA Notice',
                        'Severity': result.ai_analysis.severity
                      }
                    }
                  }] : [])
                ]
              }
            ]
          }] : [{
            id: 'target-node',
            name: `${result.platform} Ingested Post (@${result.username})`,
            category: 'propagation' as const,
            platform: result.platform,
            timestamp: '2026-09-18T12:00:00Z',
            relativeTime: '+2h 00m',
            similarity: result.similarity,
            details: {
              title: `Active Scan Candidate: @${result.username}`,
              description: result.caption || 'Unauthorized broadcast repost detected during automated monitoring.',
              metrics: {
                'Similarity Match': `${Math.round(result.similarity * 100)}%`,
                'Decision': result.ai_analysis.decision
              }
            }
          }])
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
          </div>
        )}
      </div>
    </div>
  )
}
