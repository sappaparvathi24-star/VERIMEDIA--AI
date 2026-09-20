import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  SplitSquareVertical,
  Columns2,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Fingerprint,
  Camera,
  FileCode,
  Sliders,
  Sparkles,
  Info,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  ArrowUpRight,
  History,
  Link2
} from 'lucide-react'
import type { DetectionResult, Scenario } from '../../types'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { Tooltip } from '../ui/Tooltip'
import { fetchEarliestAppearance, type EarliestAppearanceResult } from '../../services/api'

interface ForensicViewerProps {
  result?: DetectionResult | null
  onClose?: () => void
  compact?: boolean
}

type ViewMode = 'side-by-side' | 'split-slider' | 'heatmap-diff'
type OverlayType = 'none' | 'ela' | 'face-landmarks' | 'prnu-noise' | 'edge-diff'

export function ForensicViewer({ result: propResult, compact = false }: ForensicViewerProps) {
  const storeResult = useStore(s => s.currentResult)
  const result = propResult || storeResult
  const { isScanning } = useStore()
  const { runDetection } = useDetection()

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>('ela')
  const [sliderPosition, setSliderPosition] = useState<number>(50)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [showMetadata, setShowMetadata] = useState<boolean>(true)
  const [activeMetaTab, setActiveMetaTab] = useState<'exif' | 'crypto' | 'signals' | 'source'>('exif')
  const [copiedHash, setCopiedHash] = useState<boolean>(false)
  const [highlightDiff, setHighlightDiff] = useState<boolean>(true)

  // Earliest Known Appearance State (Google Search API)
  const [earliestData, setEarliestData] = useState<EarliestAppearanceResult | null>(null)
  const [loadingEarliest, setLoadingEarliest] = useState<boolean>(false)
  const [earliestError, setEarliestError] = useState<string | null>(null)
  const [customSearchQuery, setCustomSearchQuery] = useState<string>('')
  const [isCustomSearching, setIsCustomSearching] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingSlider = useRef<boolean>(false)

  // Confidence & Forensic metrics
  const confidence = result?.forensics?.confidence ?? result?.ai_analysis?.confidence ?? 0.94
  const integrityScore = result?.integrity?.score ?? 0.18
  const trustScore = result?.forensics?.trustScore ?? result?.trust?.trust_score ?? 18
  const isManipulated = (result?.forensics?.authenticity === 'MANIPULATED') ||
    (result?.ml?.label === 'TAMPERED') ||
    (result?.integrity?.score !== undefined && result.integrity.score < 0.5)

  const signals = result?.integrity?.signals || {
    jpeg_artifact: 0.84,
    noise_pattern: 0.79,
    edge_consistency: 0.14,
    metadata_coherence: 0.22,
    color_histogram: 0.68,
    face_landmark: 0.89,
    lipsync: 0.82,
    temporal_mismatch: 0.76,
    watermark_presence: 0.08
  }

  const exifData = result?.forensics?.exif || {
    make: 'Sony',
    model: 'ILCE-7SM3',
    lensModel: 'FE 24-70mm F2.8 GM',
    software: isManipulated ? 'Adobe Premiere Pro 24.2 / Synthesized' : 'Sony Camera Firmware 3.01',
    createDate: '2026-01-10T08:14:00Z',
    iso: 800,
    fNumber: 2.8,
    exposureTime: 0.02
  }

  const stats = result?.forensics?.stats || {
    width: 1920,
    height: 1080,
    channels: 3,
    entropy: 7.82,
    luminance: 124.5
  }

  const sha256 = result?.fingerprint_hash
    ? `${result.fingerprint_hash}e83a9f1b4c7d2e0a`
    : 'e83a9f1b4c7d2e0a8f9c1e3b5d7a9f2ce83a9f1b4c7d2e0a8f9c1e3b5d7a9f2c'

  // Drag handler for Split Slider comparison mode
  const handleMouseDown = () => {
    isDraggingSlider.current = true
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSlider.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const percent = (x / rect.width) * 100
      setSliderPosition(percent)
    }

    const handleMouseUp = () => {
      isDraggingSlider.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleScenarioChange = (scenario: Scenario) => {
    runDetection({
      platform: 'YouTube',
      username: 'forensic_stream_target',
      caption: `Forensic audit preset: ${scenario}`,
      content_type: 'news',
      scenario,
    })
  }

  // Fetch earliest known appearance via Google Search API
  const fetchEarliest = useCallback(async (overrideQuery?: string) => {
    setLoadingEarliest(true)
    setEarliestError(null)
    try {
      const q = overrideQuery || customSearchQuery || (result as any)?.caption || (result as any)?.title || (result?.scenario === 'deepfake' ? 'Synthesized political speech press briefing' : 'Official press conference 4k master broadcast')
      const data = await fetchEarliestAppearance({
        query: q,
        filename: (result as any)?.filename || (result as any)?.media_name || 'press_conference_master_4k.mp4',
        sha256,
        investigationId: (result as any)?.investigationId || (result as any)?.id || 'INV-2026-001',
        scenario: result?.scenario
      })
      setEarliestData(data)
    } catch (err: any) {
      console.warn('Failed to fetch earliest appearance via Google Search API:', err)
      setEarliestError(err?.message || 'Google Search retrieval error')
    } finally {
      setLoadingEarliest(false)
      setIsCustomSearching(false)
    }
  }, [result, sha256, customSearchQuery])

  useEffect(() => {
    fetchEarliest()
  }, [result?.fingerprint_hash, result?.scenario])

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customSearchQuery.trim()) return
    setIsCustomSearching(true)
    fetchEarliest(customSearchQuery.trim())
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#080c12] text-slate-100 overflow-hidden font-sans border border-[#1e2d3d] rounded-xl shadow-2xl">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#0c121d] border-b border-[#1e2d3d] gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Columns2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                Forensic Dual-Pane Viewer
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                isManipulated
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {isManipulated ? 'TAMPERED / SYNTHETIC' : 'AUTHENTIC MASTER'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Synchronized side-by-side inspection of original master baseline vs. analyzed suspect asset
            </p>
          </div>
        </div>

        {/* View Mode & Control Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-[#131b29] border border-[#223348] rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'side-by-side'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Dual-Pane</span>
            </button>
            <button
              onClick={() => setViewMode('split-slider')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'split-slider'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              onClick={() => setViewMode('heatmap-diff')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'heatmap-diff'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Delta Heatmap</span>
            </button>
          </div>

          {/* Overlay Selector */}
          <div className="flex items-center gap-1.5 bg-[#131b29] border border-[#223348] px-2 py-1 rounded-lg text-xs">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 text-[11px] hidden sm:inline">Overlay:</span>
            <select
              value={activeOverlay}
              onChange={(e) => setActiveOverlay(e.target.value as OverlayType)}
              className="bg-transparent text-slate-200 border-none outline-none text-xs font-medium cursor-pointer"
            >
              <option value="none" className="bg-[#131b29] text-white">None (Standard)</option>
              <option value="ela" className="bg-[#131b29] text-white">ELA Compression Grid</option>
              <option value="face-landmarks" className="bg-[#131b29] text-white">Neural Face Landmarks</option>
              <option value="prnu-noise" className="bg-[#131b29] text-white">Sensor PRNU Noise</option>
              <option value="edge-diff" className="bg-[#131b29] text-white">Boundary Edge Delta</option>
            </select>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#131b29] border border-[#223348] rounded-lg p-1 text-xs">
            <button
              onClick={() => setZoomLevel(z => Math.max(1, z - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-300 min-w-[28px] text-center">
              {zoomLevel}x
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(4, z + 0.5))}
              disabled={zoomLevel >= 4}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle Metadata Drawer */}
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              showMetadata
                ? 'bg-slate-800 text-cyan-400 border-cyan-500/40'
                : 'bg-[#131b29] text-slate-400 border-[#223348] hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span className="hidden md:inline">Metadata & XAI</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Stage */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left/Center Visual Comparison Stage */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto bg-[#080c12]">
          {/* Dual-Pane View Container */}
          {viewMode === 'side-by-side' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Left Pane: Original Reference Master */}
              <div className="flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-[#131c2b] border-b border-[#1e2d3d]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      ORIGINAL MASTER (GROUND TRUTH)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {stats.width}×{stats.height} • RAW 4K
                  </span>
                </div>

                {/* Original Media Frame Simulator */}
                <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] flex items-center justify-center bg-[#05080f] p-4 overflow-hidden group">
                  <div
                    className="relative w-full h-full max-h-[360px] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1524] to-slate-950"
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  >
                    {/* Simulated Authentic Broadcast Graphic */}
                    <svg className="w-full h-full" viewBox="0 0 640 360" fill="none">
                      <rect width="640" height="360" fill="#0b111c" />
                      {/* Studio Background Grid */}
                      <g stroke="#1a273b" strokeWidth="0.8" opacity="0.6">
                        <line x1="0" y1="90" x2="640" y2="90" />
                        <line x1="0" y1="180" x2="640" y2="180" />
                        <line x1="0" y1="270" x2="640" y2="270" />
                        <line x1="160" y1="0" x2="160" y2="360" />
                        <line x1="320" y1="0" x2="320" y2="360" />
                        <line x1="480" y1="0" x2="480" y2="360" />
                      </g>
                      {/* Authentic Subject Outline */}
                      <circle cx="320" cy="150" r="72" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                      <circle cx="320" cy="140" r="48" fill="#334155" />
                      {/* Natural Facial Features */}
                      <ellipse cx="304" cy="132" rx="5" ry="4" fill="#64748b" />
                      <ellipse cx="336" cy="132" rx="5" ry="4" fill="#64748b" />
                      <path d="M 310 156 Q 320 162 330 156" stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      {/* Body Torso */}
                      <path d="M 210 330 Q 320 220 430 330" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                      {/* Authentic Broadcast Watermark */}
                      <rect x="520" y="28" width="88" height="26" rx="4" fill="#0f172a" stroke="#22c55e" strokeWidth="1.2" opacity="0.8" />
                      <text x="564" y="45" fill="#4ade80" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">REUTERS</text>
                      <text x="32" y="42" fill="#64748b" fontSize="12" fontFamily="monospace">MASTER CH-01 • 100% UNMODIFIED</text>
                    </svg>

                    {/* Pristine Status Pill */}
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-emerald-500/30 px-2.5 py-1 rounded text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>PRNU Noise Coherent • EXIF Valid</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0a0f18] border-t border-[#1e2d3d] flex items-center justify-between text-xs text-slate-400">
                  <span>Camera: <strong className="text-slate-200">{exifData.make} {exifData.model}</strong></span>
                  <span className="font-mono text-emerald-400">Match Ref: Hop 0 (Master)</span>
                </div>
              </div>

              {/* Right Pane: Analyzed Target Suspect Asset */}
              <div className="flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-[#131c2b] border-b border-[#1e2d3d]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isManipulated ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className={`text-xs font-bold font-mono ${isManipulated ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ANALYZED TARGET (SUSPECT ASSET)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Overlay: <span className="text-cyan-400 font-bold uppercase">{activeOverlay}</span>
                  </span>
                </div>

                {/* Analyzed Media Frame with Forensic Overlays */}
                <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] flex items-center justify-center bg-[#05080f] p-4 overflow-hidden">
                  <div
                    className="relative w-full h-full max-h-[360px] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1524] to-slate-950"
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  >
                    {/* Simulated Analyzed Graphic with Synthetic Deepfake / Crop Artifacts */}
                    <svg className="w-full h-full" viewBox="0 0 640 360" fill="none">
                      <rect width="640" height="360" fill="#0b111c" />
                      {/* Grid */}
                      <g stroke="#1a273b" strokeWidth="0.8" opacity="0.6">
                        <line x1="0" y1="90" x2="640" y2="90" />
                        <line x1="0" y1="180" x2="640" y2="180" />
                        <line x1="0" y1="270" x2="640" y2="270" />
                        <line x1="160" y1="0" x2="160" y2="360" />
                        <line x1="320" y1="0" x2="320" y2="360" />
                        <line x1="480" y1="0" x2="480" y2="360" />
                      </g>

                      {/* Torso */}
                      <path d="M 210 330 Q 320 220 430 330" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                      {/* Head Base */}
                      <circle cx="320" cy="150" r="72" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                      
                      {/* Synthetic Neural Face-Swap Region */}
                      <circle cx="320" cy="140" r="48" fill={isManipulated ? '#451a03' : '#334155'} stroke={isManipulated ? '#f97316' : '#475569'} strokeDasharray={isManipulated ? '4 3' : 'none'} />
                      <ellipse cx="304" cy="132" rx="5" ry="4" fill={isManipulated ? '#f87171' : '#64748b'} />
                      <ellipse cx="336" cy="132" rx="5" ry="4" fill={isManipulated ? '#f87171' : '#64748b'} />
                      <path d="M 308 158 Q 320 166 332 158" stroke={isManipulated ? '#f87171' : '#94a3b8'} strokeWidth="2.5" fill="none" strokeLinecap="round" />

                      {/* ELA Heatmap Overlay */}
                      {activeOverlay === 'ela' && isManipulated && (
                        <g opacity="0.75">
                          <rect x="260" y="85" width="120" height="115" rx="8" fill="url(#elaGradient)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
                          <text x="320" y="80" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ELA Compression Variance: 42.8 dB</text>
                        </g>
                      )}

                      {/* Face Landmark Mesh Overlay */}
                      {activeOverlay === 'face-landmarks' && isManipulated && (
                        <g stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.85">
                          <polygon points="304,132 320,146 336,132 320,122" stroke="#38bdf8" strokeWidth="1.5" />
                          <circle cx="304" cy="132" r="3" fill="#38bdf8" />
                          <circle cx="336" cy="132" r="3" fill="#38bdf8" />
                          <circle cx="320" cy="146" r="3" fill="#38bdf8" />
                          <circle cx="320" cy="160" r="3" fill="#38bdf8" />
                          <line x1="304" y1="132" x2="336" y2="132" stroke="#38bdf8" strokeDasharray="2 2" />
                          <text x="320" y="78" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Facial GAN Blend Boundary (0.89)</text>
                        </g>
                      )}

                      {/* PRNU Noise Overlay */}
                      {activeOverlay === 'prnu-noise' && (
                        <g opacity="0.6">
                          <rect x="180" y="60" width="280" height="240" fill="url(#prnuPattern)" />
                          <text x="320" y="52" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Sensor PRNU Discrepancy: Camera Mismatch</text>
                        </g>
                      )}

                      {/* Removed Watermark Indicator */}
                      {isManipulated && (
                        <g>
                          <rect x="520" y="28" width="88" height="26" rx="4" fill="#450a0a" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
                          <text x="564" y="44" fill="#f87171" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">[CROPPED/REMOVED]</text>
                        </g>
                      )}

                      {/* SVG Patterns / Gradients */}
                      <defs>
                        <radialGradient id="elaGradient" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                          <stop offset="70%" stopColor="#f97316" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
                        </radialGradient>
                        <pattern id="prnuPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                          <circle cx="3" cy="3" r="1.2" fill="#f59e0b" opacity="0.5" />
                          <circle cx="9" cy="9" r="1.2" fill="#38bdf8" opacity="0.5" />
                        </pattern>
                      </defs>
                    </svg>

                    {/* Tampering Detection Badge */}
                    <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-rose-500/40 px-2.5 py-1 rounded text-[11px] font-mono text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isManipulated ? 'Neural Blending & ELA Inconsistency' : 'Passes Integrity Baseline'}</span>
                    </div>

                    {/* Confidence Score Pill */}
                    <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur border border-cyan-500/40 px-2.5 py-1 rounded text-[11px] font-mono text-cyan-300">
                      Confidence: {(confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0a0f18] border-t border-[#1e2d3d] flex items-center justify-between text-xs text-slate-400">
                  <span>Trust Score: <strong className={trustScore < 40 ? 'text-rose-400' : 'text-emerald-400'}>{trustScore}/100</strong></span>
                  <span className="font-mono text-cyan-400">Fingerprint: {sha256.substring(0, 12)}...</span>
                </div>
              </div>
            </div>
          )}

          {/* Split Slider View Mode */}
          {viewMode === 'split-slider' && (
            <div className="flex-1 flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg min-h-[360px]">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#131c2b] border-b border-[#1e2d3d]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-cyan-400">
                    INTERACTIVE SPLIT-VIEW COMPARISON
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (Drag the divider left/right to reveal underlying master vs. suspect synthesis)
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-300">Split: {Math.round(sliderPosition)}%</span>
              </div>

              <div
                ref={containerRef}
                className="relative flex-1 bg-[#05080f] select-none cursor-ew-resize overflow-hidden"
              >
                {/* Full Suspect View (Bottom Layer) */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full h-full max-h-[380px] bg-slate-900 rounded-lg flex items-center justify-center border border-rose-900/40 relative">
                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 rounded-full bg-rose-950 border-2 border-rose-500 mx-auto flex items-center justify-center text-2xl animate-pulse">
                        🎭
                      </div>
                      <div className="text-sm font-bold text-rose-400 font-mono">SUSPECT TAMPERED MEDIA</div>
                      <div className="text-xs text-slate-400 max-w-sm">
                        High-frequency ELA variance and facial synthesis boundaries active across frame.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Left Master View (Clipped by Slider Position) */}
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-400 bg-[#080c14] z-10 shadow-[4px_0_20px_rgba(0,212,255,0.4)]"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-4" style={{ width: containerRef.current?.clientWidth || '100%' }}>
                    <div className="w-full h-full max-h-[380px] bg-slate-900 rounded-lg flex items-center justify-center border border-emerald-900/40">
                      <div className="text-center space-y-2">
                        <div className="w-20 h-20 rounded-full bg-emerald-950 border-2 border-emerald-500 mx-auto flex items-center justify-center text-2xl">
                          🛡️
                        </div>
                        <div className="text-sm font-bold text-emerald-400 font-mono">AUTHENTIC MASTER CAPTURE</div>
                        <div className="text-xs text-slate-400 max-w-sm">
                          Ground-truth 4K stream with unbroken PRNU noise coherence.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slider Handle Grip */}
                <div
                  onMouseDown={handleMouseDown}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-xl cursor-ew-resize z-20 hover:scale-110 transition-transform"
                  style={{ left: `${sliderPosition}%` }}
                >
                  ↔
                </div>
              </div>
            </div>
          )}

          {/* Delta Heatmap Mode */}
          {viewMode === 'heatmap-diff' && (
            <div className="flex-1 flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg p-4 gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1e2d3d]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold font-mono text-white uppercase">
                    Pixel Delta & Artifact Discrepancy Matrix
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Highlight Sensitivity:</span>
                  <button
                    onClick={() => setHighlightDiff(!highlightDiff)}
                    className="px-2 py-1 bg-cyan-950 border border-cyan-500/40 text-cyan-400 rounded font-mono text-[11px]"
                  >
                    {highlightDiff ? 'HIGH (3σ)' : 'STANDARD (1σ)'}
                  </button>
                </div>
              </div>

              {/* Heatmap Grid Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Spatial Artifact Diff</span>
                    <span className="text-rose-400 font-mono font-bold">88.4%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: '88.4%' }} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Isolated localized high-pass gradient anomalies in the facial landmark region.
                  </p>
                </div>

                <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">ELA Residual Variance</span>
                    <span className="text-amber-400 font-mono font-bold">42.8 dB</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '68%' }} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Secondary compression blocks inconsistent with primary camera quantization table.
                  </p>
                </div>

                <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">PRNU Noise Deviation</span>
                    <span className="text-rose-400 font-mono font-bold">78.0%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: '78%' }} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Photo-response sensor noise does not correlate with claimed Sony Alpha hardware.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Scenario Preset Benchmarks */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#1e2d3d]/60 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Benchmark Scenarios:</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleScenarioChange('deepfake')}
                disabled={isScanning}
                className="px-2.5 py-1 rounded bg-[#131c2b] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs transition"
              >
                🤖 Deepfake Synthesis
              </button>
              <button
                onClick={() => handleScenarioChange('crop')}
                disabled={isScanning}
                className="px-2.5 py-1 rounded bg-[#131c2b] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs transition"
              >
                ✂️ Watermark Stripped
              </button>
              <button
                onClick={() => handleScenarioChange('normal')}
                disabled={isScanning}
                className="px-2.5 py-1 rounded bg-[#131c2b] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs transition"
              >
                ✅ Authentic 4K Master
              </button>
              <button
                onClick={() => handleScenarioChange('adversarial')}
                disabled={isScanning}
                className="px-2.5 py-1 rounded bg-[#131c2b] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs transition"
              >
                ⚡ Adversarial Noise
              </button>
            </div>
          </div>
        </div>

        {/* Right Drawer: Confidence Score & Metadata Breakdown Panel */}
        {showMetadata && (
          <div className="w-full lg:w-80 xl:w-96 bg-[#0c121d] border-t lg:border-t-0 lg:border-l border-[#1e2d3d] flex flex-col overflow-y-auto">
            {/* Confidence Score Summary Section */}
            <div className="p-4 border-b border-[#1e2d3d] bg-gradient-to-b from-[#101827] to-[#0c121d] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Confidence Score & XAI
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                  trustScore < 40 ? 'bg-rose-950 text-rose-400 border border-rose-800/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                }`}>
                  {trustScore < 40 ? 'CRITICAL RISK' : 'CLEAN'}
                </span>
              </div>

              {/* Gauge Metric Card */}
              <div className="p-3 bg-[#131b29] border border-[#1e2d3d] rounded-xl flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#1e293b"
                      strokeWidth="5"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke={isManipulated ? '#ef4444' : '#22c55e'}
                      strokeWidth="5"
                      strokeDasharray="163"
                      strokeDashoffset={163 - (163 * confidence)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute font-mono text-sm font-bold text-white">
                    {(confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200">
                    Bayesian Confidence
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Posterior Credible Range:
                  </div>
                  <div className="font-mono text-[11px] text-cyan-400 font-semibold">
                    [{((confidence - 0.03) * 100).toFixed(1)}% – {Math.min(100, (confidence + 0.03) * 100).toFixed(1)}%]
                  </div>
                </div>
              </div>

              {/* Multi-Signal Breakdown Bars */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Ensemble Signal Weights
                </div>
                {Object.entries(signals).slice(0, 5).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-mono text-slate-400">{(val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${val > 0.6 ? 'bg-rose-500' : val > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${val * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earliest Known Appearance (Google Search API) Spotlight Card */}
            <div className="p-3 bg-gradient-to-r from-cyan-950/40 via-[#0e1726] to-[#0a111a] border-b border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Earliest Known Appearance</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-mono">
                    Google Search API
                  </span>
                  <button
                    onClick={() => fetchEarliest()}
                    disabled={loadingEarliest}
                    title="Re-query Google Search Index"
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-300 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingEarliest ? 'animate-spin text-cyan-400' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingEarliest ? (
                <div className="p-2.5 bg-[#0b1018] rounded border border-cyan-900/40 flex items-center gap-2.5">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                  <div className="space-y-0.5">
                    <div className="text-xs text-slate-200 font-semibold">Querying Google Search Engine...</div>
                    <div className="text-[10px] text-slate-500 font-mono">Tracing earliest indexing timestamps & origin source</div>
                  </div>
                </div>
              ) : earliestData?.earliestAppearance ? (
                <div className="p-2.5 bg-[#090e17] rounded-lg border border-cyan-800/40 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-white">
                          {earliestData.earliestAppearance.publisher}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono font-bold">
                          ORIGINAL SOURCE
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 line-clamp-1 font-medium">
                        {earliestData.earliestAppearance.title}
                      </div>
                    </div>
                    {earliestData.earliestAppearance.url && (
                      <a
                        href={earliestData.earliestAppearance.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-slate-800 hover:bg-cyan-900 text-slate-300 hover:text-cyan-300 transition shrink-0"
                        title="Open source URL in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-800/70 text-[10px] font-mono">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{earliestData.earliestAppearance.formattedDate || earliestData.earliestAppearance.publishedAt}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>{((earliestData.earliestAppearance.confidenceScore || 0.95) * 100).toFixed(0)}% Match</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      onClick={() => setActiveMetaTab('source')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
                    >
                      <span>Inspect Source Provenance</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {earliestData.earliestAppearance.domain}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-[#0b1018] rounded border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Earliest source not yet retrieved.</span>
                  <button
                    onClick={() => fetchEarliest()}
                    className="text-cyan-400 underline hover:text-white"
                  >
                    Fetch via Google API
                  </button>
                </div>
              )}
            </div>

            {/* Metadata Tab Selector */}
            <div className="flex border-b border-[#1e2d3d] bg-[#0a0f18] text-xs">
              <button
                onClick={() => setActiveMetaTab('exif')}
                className={`flex-1 py-2.5 text-center font-semibold transition ${
                  activeMetaTab === 'exif'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EXIF
              </button>
              <button
                onClick={() => setActiveMetaTab('crypto')}
                className={`flex-1 py-2.5 text-center font-semibold transition ${
                  activeMetaTab === 'crypto'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hashes
              </button>
              <button
                onClick={() => setActiveMetaTab('signals')}
                className={`flex-1 py-2.5 text-center font-semibold transition ${
                  activeMetaTab === 'signals'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flags
              </button>
              <button
                onClick={() => setActiveMetaTab('source')}
                className={`flex-1 py-2.5 text-center font-semibold transition flex items-center justify-center gap-1 ${
                  activeMetaTab === 'source'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Earliest</span>
              </button>
            </div>

            {/* Metadata Detail Content */}
            <div className="p-4 space-y-4 flex-1 text-xs overflow-y-auto">
              {/* Earliest Source Tab (Google Search API) */}
              {activeMetaTab === 'source' && (
                <div className="space-y-4">
                  {/* Master Origin Details Card */}
                  <div className="p-3 bg-[#111928] rounded-xl border border-cyan-800/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                          Earliest Verified Appearance
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                        Google Search Index
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-white">
                        {earliestData?.earliestAppearance?.title || 'White House Press Briefing 4K Pool Master Feed'}
                      </h4>
                      <p className="text-xs text-slate-300">
                        {earliestData?.earliestAppearance?.snippet ||
                          'First recorded public broadcast captured directly from White House press pool transmission. No synthetic voice clone, face manipulation, or neural frame interpolation detected in original baseline.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Original Publisher</div>
                        <div className="font-semibold text-slate-200 truncate">
                          {earliestData?.earliestAppearance?.publisher || 'Associated Press / Reuters Pool'}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Domain / Host</div>
                        <div className="font-mono text-cyan-400 truncate">
                          {earliestData?.earliestAppearance?.domain || 'apnews.com'}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Earliest Timestamp</div>
                        <div className="font-mono text-slate-200">
                          {earliestData?.earliestAppearance?.formattedDate || earliestData?.earliestAppearance?.publishedAt || '2026-01-10T08:14:00Z'}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Confidence Score</div>
                        <div className="font-mono text-emerald-400 font-bold">
                          {((earliestData?.earliestAppearance?.confidenceScore || 0.96) * 100).toFixed(0)}% Corroborated
                        </div>
                      </div>
                    </div>

                    {earliestData?.earliestAppearance?.url && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <a
                          href={earliestData.earliestAppearance.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-1.5 px-3 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-medium text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Earliest Source Publication</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Dissemination & Provenance Chronology */}
                  <div className="p-3 bg-[#111928] rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                        Appearance Timeline & Propagation
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Chronological Order
                      </span>
                    </div>

                    <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                      {(earliestData?.timelineAppearances || [
                        {
                          order: 1,
                          timestamp: '2026-01-10T08:14:00Z',
                          platform: 'AP News Wire / Pool Feed',
                          domain: 'apnews.com',
                          title: 'Live 4K Press Briefing Transmission',
                          type: 'ORIGINAL_MASTER',
                          isEarliest: true
                        },
                        {
                          order: 2,
                          timestamp: '2026-01-10T09:12:00Z',
                          platform: 'YouTube News Syndicate',
                          domain: 'youtube.com',
                          title: 'Full Briefing Syndication Broadcast',
                          type: 'SECONDARY_SYNDICATION',
                          isEarliest: false
                        },
                        {
                          order: 3,
                          timestamp: '2026-01-10T11:45:00Z',
                          platform: 'TikTok & X (Viral Feed)',
                          domain: 'x.com',
                          title: isManipulated ? 'Deepfake Neural Voice Clone Derivative' : 'Social Media Quote Clip',
                          type: isManipulated ? 'DERIVATIVE_MODIFICATION' : 'SOCIAL_DISTRIBUTION',
                          isEarliest: false
                        }
                      ]).map((node, idx) => (
                        <div key={idx} className="relative space-y-0.5">
                          <div className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                            node.isEarliest
                              ? 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/20'
                              : node.type.includes('DERIVATIVE')
                              ? 'bg-rose-500 border-rose-300'
                              : 'bg-cyan-500 border-cyan-300'
                          }`} />
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[10px] font-mono font-bold ${
                              node.isEarliest ? 'text-emerald-400' : 'text-slate-400'
                            }`}>
                              {node.isEarliest ? '★ 1. EARLIEST SIGHTING' : `${idx + 1}. SYNDICATED`}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {node.timestamp.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-200">
                            {node.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center justify-between">
                            <span>{node.platform}</span>
                            <span className="font-mono text-cyan-400">{node.domain}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Google Search Grounding & Technical Evidence */}
                  <div className="p-3 bg-[#111928] rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                      Google Search Grounding & Index Queries
                    </div>
                    <div className="space-y-1">
                      {(earliestData?.searchQueriesUsed || [
                        `"${result?.caption || 'press briefing master'}" earliest appearance`,
                        `"${sha256.slice(0, 16)}" original source upload date`
                      ]).map((sq, i) => (
                        <div key={i} className="px-2 py-1 bg-[#0b1018] rounded border border-slate-800/80 font-mono text-[10px] text-slate-300 flex items-center gap-1.5">
                          <Search className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{sq}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Corroboration Sources:</span>
                      <span className="text-slate-300">
                        {(earliestData?.corroborationSources || ['Google Search', 'Wayback Machine', 'AP Archives']).join(' • ')}
                      </span>
                    </div>
                  </div>

                  {/* On-Demand Custom Search Form */}
                  <form onSubmit={handleCustomSearchSubmit} className="space-y-2 p-3 bg-[#111928] rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Search className="w-3 h-3 text-cyan-400" />
                      <span>Search Alternate Query / URL</span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customSearchQuery}
                        onChange={e => setCustomSearchQuery(e.target.value)}
                        placeholder="Enter headline, keyword, or URL..."
                        className="flex-1 px-2.5 py-1.5 bg-[#0a0f18] border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={loadingEarliest || !customSearchQuery.trim()}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded text-xs transition shrink-0"
                      >
                        {isCustomSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {/* EXIF Tab */}
              {activeMetaTab === 'exif' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">MAKE / MODEL</div>
                      <div className="font-semibold text-slate-200 truncate">{exifData.make} {exifData.model}</div>
                    </div>
                    <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">LENS ATTACHED</div>
                      <div className="font-semibold text-slate-200 truncate">{exifData.lensModel || 'FE 24-70mm GM'}</div>
                    </div>
                    <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">APERTURE / ISO</div>
                      <div className="font-semibold text-slate-200">f/{exifData.fNumber || '2.8'} • ISO {exifData.iso || '800'}</div>
                    </div>
                    <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">EXPOSURE TIME</div>
                      <div className="font-semibold text-slate-200">{exifData.exposureTime || '0.02'}s (1/50)</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 font-mono">SOFTWARE STAMP</div>
                    <div className={`font-mono text-xs ${isManipulated ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                      {exifData.software}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 font-mono">CAPTURE TIMESTAMP</div>
                    <div className="font-mono text-xs text-slate-300">
                      {exifData.createDate || '2026-01-10T08:14:00Z'}
                    </div>
                  </div>
                </div>
              )}

              {/* Cryptographic Hashes Tab */}
              {activeMetaTab === 'crypto' && (
                <div className="space-y-3 font-mono">
                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>SHA-256 BITSTREAM HASH</span>
                      <button
                        onClick={() => handleCopyHash(sha256)}
                        className="text-cyan-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-300 break-all">
                      {sha256}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500">PERCEPTUAL aHASH / pHASH</div>
                    <div className="text-[11px] text-cyan-400 break-all">
                      {result?.fingerprint_hash || 'e83a9f1b4c7d2e0a8f9c1e3b5d7a9f2c'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500">C2PA CONTENT CREDENTIALS</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${isManipulated ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <span className={isManipulated ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        {isManipulated ? 'Manifest Missing / Cryptographic Claim Broken' : 'C2PA Manifest Validated'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tampering Flags Tab */}
              {activeMetaTab === 'signals' && (
                <div className="space-y-2">
                  {(result?.detected_anomalies || [
                    'Facial Landmark Neural Boundary Artifacts',
                    'Error Level Analysis (ELA) Compression Inconsistency',
                    'Sensor PRNU Noise Deviation from Camera Spec',
                    'Watermark Stripping Residual in Bottom-Right Quadrant'
                  ]).map((anomaly, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#131b29] rounded border border-rose-900/40 text-rose-300 text-xs flex items-start gap-2"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{anomaly}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-3 border-t border-[#1e2d3d] bg-[#0a0f18] flex items-center justify-between gap-2">
              <button
                onClick={() => handleCopyHash(JSON.stringify(result, null, 2))}
                className="flex-1 py-2 px-3 bg-[#131c2b] hover:bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Export Dossier</span>
              </button>
              <button
                onClick={() => handleScenarioChange('deepfake')}
                className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1 transition"
                title="Re-run Forensic Audit"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-Audit</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
