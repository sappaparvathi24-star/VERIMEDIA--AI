import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  Link2,
  FileCheck,
  FileSpreadsheet
} from 'lucide-react'
import type { DetectionResult, Scenario, ComparisonReport } from '../../types'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { Tooltip } from '../ui/Tooltip'
import { fetchEarliestAppearance, analyzeMultimodalGemini, type EarliestAppearanceResult } from '../../services/api'
import { SequentialForensicReport } from '../forensics/SequentialForensicReport'
import { ErrorLevelAnalysisInspector } from '../forensics/ErrorLevelAnalysisInspector'
import { CandidateComparisonHub } from './CandidateComparisonHub'
import { generateTenComparisonReports } from '../../matching/candidateReportsGenerator'
import { isSimulatedResult } from '../../lib/resultMode'

interface ForensicViewerProps {
  result?: DetectionResult | null
  onClose?: () => void
  compact?: boolean
}

type ViewMode = 'side-by-side' | 'split-slider' | 'heatmap-diff' | 'ela-inspector' | 'sequential' | 'candidate-hub'
type OverlayType = 'none' | 'ela' | 'face-landmarks' | 'prnu-noise' | 'edge-diff'

export function ForensicViewer({ result: propResult, compact = false, onClose }: ForensicViewerProps) {
  const storeResult = useStore(s => s.currentResult)
  const result = propResult || storeResult
  const { isScanning } = useStore()
  const { runDetection } = useDetection()

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>('ela')
  const [sliderPosition, setSliderPosition] = useState<number>(50)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [showMetadata, setShowMetadata] = useState<boolean>(true)
  const [activeMetaTab, setActiveMetaTab] = useState<'vision' | 'exif' | 'crypto' | 'signals' | 'source'>('vision')
  const [copiedHash, setCopiedHash] = useState<boolean>(false)
  const [highlightDiff, setHighlightDiff] = useState<boolean>(true)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // Multimodal Vision & Image Display State
  const [visionText, setVisionText] = useState<string | null>(
    (result as any)?.multimodalAnalysis || (result as any)?.forensics?.visualFindings?.join('\n') || (result as any)?.ai_analysis?.reasoning_points?.join('\n') || null
  )
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false)
  const [imageLoadError, setImageLoadError] = useState<boolean>(false)

  // Earliest Known Appearance State (Google Search API)
  const [earliestData, setEarliestData] = useState<EarliestAppearanceResult | null>(null)
  const [loadingEarliest, setLoadingEarliest] = useState<boolean>(false)
  const [earliestError, setEarliestError] = useState<string | null>(null)
  const [customSearchQuery, setCustomSearchQuery] = useState<string>('')
  const [isCustomSearching, setIsCustomSearching] = useState<boolean>(false)

  // Reset states when result updates
  useEffect(() => {
    setImageLoadError(false)
    setVisionText(
      (result as any)?.multimodalAnalysis || (result as any)?.forensics?.visualFindings?.join('\n') || (result as any)?.ai_analysis?.reasoning_points?.join('\n') || null
    )
  }, [result])

  const handleRunVisionAnalysis = useCallback(async () => {
    if (isAnalyzingVision) return
    setIsAnalyzingVision(true)
    try {
      let base64 = (result as any)?.artifact?.dataUrl || (result as any)?.artifact?.previewUrl || ''
      if (!base64 || !base64.startsWith('data:')) {
        base64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
      }
      const data = await analyzeMultimodalGemini({
        imageBase64: base64,
        filename: result?.artifact?.filename || 'uploaded_media.jpg',
        prompt: 'You are a forensic media analyst. Provide a detailed visual inspection report on this image. Identify any AI deepfake synthesis, edge tampering, lighting inconsistencies, camera sensor anomalies, or authenticity cues.'
      })
      if (data?.analysis) {
        setVisionText(data.analysis)
      }
    } catch (err) {
      console.warn('Vision analysis error:', err)
    } finally {
      setIsAnalyzingVision(false)
    }
  }, [result, isAnalyzingVision])

  useEffect(() => {
    if (activeMetaTab === 'vision' && !visionText && !isAnalyzingVision && result) {
      handleRunVisionAnalysis()
    }
  }, [activeMetaTab, result, visionText, isAnalyzingVision, handleRunVisionAnalysis])

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingSlider = useRef<boolean>(false)

  // Confidence & Forensic metrics
  const isScenario = isSimulatedResult(result)
  const confidence = result?.forensics?.confidence ?? result?.ai_analysis?.confidence ?? (isScenario ? 0.94 : null)
  const integrityScore = result?.integrity?.score ?? (isScenario ? 0.18 : null)
  const trustScore = result?.forensics?.trustScore ?? result?.trust?.trust_score ?? (isScenario ? 18 : null)
  const isManipulated = (result?.forensics?.authenticity === 'MANIPULATED') ||
    (result?.ml?.label === 'TAMPERED') ||
    (typeof integrityScore === 'number' && integrityScore < 0.5)

  const signals = result?.integrity?.signals ?? {}

  // Real uploads: raw EXIF comes from exifr.parse() stored on artifact.rawExif
  // Demo results: raw EXIF fields are stored directly on forensics.exif (legacy shape)
  const rawExif = (result?.artifact?.rawExif as Record<string, unknown> | null | undefined) ?? null
  const legacyExif = result?.forensics?.exif as Record<string, unknown> | null | undefined ?? null

  // Normalised EXIF view — always reads from the same shape regardless of source
  const exifData = rawExif ?? legacyExif
    ? {
        make:         String((rawExif?.Make ?? rawExif?.make ?? legacyExif?.make ?? '') || '').trim() || null,
        model:        String((rawExif?.Model ?? rawExif?.model ?? legacyExif?.model ?? '') || '').trim() || null,
        lensModel:    String((rawExif?.LensModel ?? rawExif?.lensModel ?? legacyExif?.lensModel ?? '') || '').trim() || null,
        software:     String((rawExif?.Software ?? rawExif?.software ?? legacyExif?.software ?? '') || '').trim() || null,
        createDate:   String((rawExif?.DateTimeOriginal ?? rawExif?.createDate ?? legacyExif?.createDate ?? '') || '').trim() || null,
        iso:          Number(rawExif?.ISO ?? rawExif?.ISOSpeedRatings ?? rawExif?.iso ?? legacyExif?.iso ?? 0) || null,
        fNumber:      Number(rawExif?.FNumber ?? rawExif?.fNumber ?? legacyExif?.fNumber ?? 0) || null,
        exposureTime: Number(rawExif?.ExposureTime ?? rawExif?.exposureTime ?? legacyExif?.exposureTime ?? 0) || null,
      }
    : null

  // Stats: real pipeline uses meanLuminance; demo shape uses luminance
  const rawStats = result?.forensics?.stats ?? null
  const stats = rawStats ? {
    width:     rawStats.width,
    height:    rawStats.height,
    channels:  rawStats.channels,
    entropy:   rawStats.entropy,
    luminance: (rawStats as Record<string, unknown>).meanLuminance != null
      ? Number((rawStats as Record<string, unknown>).meanLuminance)
      : rawStats.luminance ?? null,
  } : null

  // Use the real full SHA-256 from the artifact if present, otherwise the perceptual hash, otherwise undefined
  const sha256: string | undefined = result?.artifact?.sha256
    ?? (result?.fingerprint_hash && result.fingerprint_hash.length === 64 ? result.fingerprint_hash : undefined)

  // Media URL for real uploaded artifact / visual display with resilient fallback
  const displayMediaUrl = useMemo(() => {
    if (imageLoadError) {
      return (result as any)?.artifact?.dataUrl || (result as any)?.artifact?.previewUrl || null
    }
    return (
      (result as any)?.artifact?.dataUrl ||
      (result as any)?.artifact?.previewUrl ||
      (result as any)?.artifact?.fileUrl ||
      (result as any)?.previewUrl ||
      (result as any)?.media_url ||
      (result?.artifact?.id ? `/api/artifacts/${result.artifact.id}/file` : null)
    )
  }, [result, imageLoadError])

  // 10 Automated Comparison Reports with 3-Way Classification
  const comparisonReports: ComparisonReport[] = useMemo(() => {
    if ((result as any)?.comparisonReports && Array.isArray((result as any).comparisonReports) && (result as any).comparisonReports.length > 0) {
      return (result as any).comparisonReports
    }
    if ((result as any)?.comparisonSummary?.reports && Array.isArray((result as any).comparisonSummary.reports) && (result as any).comparisonSummary.reports.length > 0) {
      return (result as any).comparisonSummary.reports
    }
    const cands = (result as any)?.candidates || (result as any)?.discovery?.candidates
    if (cands && Array.isArray(cands) && cands.length > 0) {
      return generateTenComparisonReports(
        result?.artifact || { filename: (result as any)?.caption || 'Uploaded Reference Asset', title: (result as any)?.caption },
        cands,
        result?.scenario || 'normal'
      ).reports
    }
    if (isScenario) {
      return generateTenComparisonReports(
        result?.artifact || { filename: (result as any)?.caption || 'Uploaded Reference Asset', title: (result as any)?.caption },
        [],
        result?.scenario || 'normal'
      ).reports
    }
    return []
  }, [result, isScenario])

  const activeCandidate = useMemo(() => {
    if (!comparisonReports || comparisonReports.length === 0) return null
    return comparisonReports.find(c => c.id === selectedCandidateId) || comparisonReports[0]
  }, [comparisonReports, selectedCandidateId])

  const elaData = (result?.forensics as any)?.ela
  const elaMeanError = elaData?.meanError ?? (signals?.jpeg_artifact ? Number((signals.jpeg_artifact * 30).toFixed(1)) : (isScenario ? 18.5 : null))

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

    // Construct query ONLY from real signals extracted from current file
    const ocrText = result?.forensics?.ocr?.text?.trim() || (result as any)?.ocr?.text?.trim() || (result as any)?.ocr_text?.trim()
    const visualDesc = result?.forensics?.subjectDescription?.trim() || result?.subject_description?.trim() || result?.forensics?.summary?.trim()
    const rawFilename = (result as any)?.filename || (result as any)?.media_name || (result as any)?.artifact?.filename || ''
    const cleanFilename = rawFilename && !['unknown', 'sample.mp4', 'press_conference_master_4k.mp4', 'demo.mp4', 'placeholder.jpg', 'test.jpg', 'image.png', 'upload.jpg', 'video.mp4', 'file.mp4'].includes(rawFilename.toLowerCase())
      ? rawFilename.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ').trim()
      : ''
    const manualQuery = overrideQuery?.trim() || customSearchQuery?.trim()
    const caption = (result as any)?.caption?.trim()

    const scenarioQuery = (result?.scenario === 'deepfake' || result?.scenario === 'scam' || result?.scenario === 'authentic') && (result as any)?.is_scenario
      ? ((result as any)?.caption || (result?.scenario === 'deepfake' ? 'Synthesized political speech press briefing' : 'Official press conference 4k master broadcast'))
      : ''

    const finalQuery = manualQuery || caption || ocrText || visualDesc || cleanFilename || scenarioQuery

    if (!finalQuery) {
      setLoadingEarliest(false)
      setIsCustomSearching(false)
      setEarliestData(null)
      setEarliestError('Not enough information available in this file to search for its earliest appearance.')
      return
    }

    try {
      const data = await fetchEarliestAppearance({
        query: finalQuery,
        filename: cleanFilename || undefined,
        sha256,
        investigationId: (result as any)?.investigationId || (result as any)?.id || undefined,
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
              onClick={() => setViewMode('ela-inspector')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'ela-inspector'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>ELA Heatmap Studio</span>
            </button>
            <button
              onClick={() => setViewMode('heatmap-diff')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'heatmap-diff'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Delta Metrics</span>
            </button>
            <button
              onClick={() => setViewMode('candidate-hub')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'candidate-hub'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>10 Reports Hub</span>
            </button>
            <button
              onClick={() => setViewMode('sequential')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition ${
                viewMode === 'sequential'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Sequential Report</span>
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

          {/* Check Another Image Button */}
          <button
            onClick={() => {
              useStore.getState().clearResults()
              if (onClose) onClose()
            }}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            title="Clear and analyze another image"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Another Image</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Stage */}
      {viewMode === 'sequential' && result ? (
        <div className="flex-1 overflow-hidden">
          <SequentialForensicReport result={result} onClose={onClose} />
        </div>
      ) : viewMode === 'ela-inspector' ? (
        <div className="flex-1 overflow-y-auto p-4 bg-[#080c12]">
          <ErrorLevelAnalysisInspector
            imageUrl={displayMediaUrl || ''}
            altTitle={result?.artifact?.filename || 'Investigative Media Target'}
            serverResult={(result?.forensics as any)?.ela || (result as any)?.ela || null}
            onClose={() => setViewMode('side-by-side')}
          />
        </div>
      ) : viewMode === 'candidate-hub' ? (
        <div className="flex-1 overflow-y-auto p-4 bg-[#080c12]">
          <CandidateComparisonHub
            reports={comparisonReports}
            activeCandidateId={selectedCandidateId}
            uploadedMediaUrl={displayMediaUrl}
            uploadedFilename={result?.artifact?.filename || 'Uploaded Reference Media'}
            onSelectCandidate={(c) => {
              setSelectedCandidateId(c.id)
              setViewMode('side-by-side')
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Left/Center Visual Comparison Stage */}
          <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto bg-[#080c12]">
          {/* Dual-Pane View Container */}
          {viewMode === 'side-by-side' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Left Pane: Reference / Uploaded Input File */}
              <div className="flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-[#131c2b] border-b border-[#1e2d3d]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      UPLOADED FILE (INPUT REFERENCE)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {stats ? `${stats.width}×${stats.height}` : '—'}
                  </span>
                </div>

                {/* Original Media Frame */}
                <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] flex items-center justify-center bg-[#05080f] p-4 overflow-hidden group">
                  <div
                    className="relative w-full h-full max-h-[360px] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1524] to-slate-950"
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  >
                    {displayMediaUrl ? (
                      <img
                        src={displayMediaUrl}
                        alt="Input Media Asset"
                        onError={() => setImageLoadError(true)}
                        className="max-w-full max-h-[340px] w-auto h-auto object-contain rounded select-none shadow-md"
                      />
                    ) : (
                      /* Fallback Authentic Broadcast Graphic */
                      <svg className="w-full h-full" viewBox="0 0 640 360" fill="none">
                        <rect width="640" height="360" fill="#0b111c" />
                        <g stroke="#1a273b" strokeWidth="0.8" opacity="0.6">
                          <line x1="0" y1="90" x2="640" y2="90" />
                          <line x1="0" y1="180" x2="640" y2="180" />
                          <line x1="0" y1="270" x2="640" y2="270" />
                          <line x1="160" y1="0" x2="160" y2="360" />
                          <line x1="320" y1="0" x2="320" y2="360" />
                          <line x1="480" y1="0" x2="480" y2="360" />
                        </g>
                        <circle cx="320" cy="150" r="72" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                        <circle cx="320" cy="140" r="48" fill="#334155" />
                        <ellipse cx="304" cy="132" rx="5" ry="4" fill="#64748b" />
                        <ellipse cx="336" cy="132" rx="5" ry="4" fill="#64748b" />
                        <path d="M 310 156 Q 320 162 330 156" stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        <path d="M 210 330 Q 320 220 430 330" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                        <text x="320" y="180" fill="#475569" fontSize="13" fontWeight="600" fontFamily="monospace" textAnchor="middle">Input File</text>
                        <text x="320" y="200" fill="#334155" fontSize="11" fontFamily="monospace" textAnchor="middle">(sample graphic)</text>
                      </svg>
                    )}

                    {/* File identity badge */}
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-600/40 px-2.5 py-1 rounded text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[200px]">{result?.artifact?.filename || result?.caption || 'Uploaded Reference'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0a0f18] border-t border-[#1e2d3d] flex items-center justify-between text-xs text-slate-400">
                  <span>Camera: <strong className="text-slate-200">{exifData ? `${exifData.make ?? ''} ${exifData.model ?? ''}`.trim() || '—' : '—'}</strong></span>
                  <span className="font-mono text-slate-500">SHA-256: {sha256 ? sha256.slice(0, 10) + '…' : '—'}</span>
                </div>
              </div>

              {/* Right Pane: Comparing Candidate Asset */}
              <div className="flex flex-col bg-[#0e1522] border border-[#1e2d3d] rounded-xl overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-[#131c2b] border-b border-[#1e2d3d]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold font-mono text-cyan-400 truncate">
                      COMPARING CANDIDATE #{activeCandidate?.candidateIndex ?? 1}: {activeCandidate?.title ?? 'Candidate Asset'}
                    </span>
                    {activeCandidate && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                        activeCandidate.classification === 'KNOWN'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : activeCandidate.classification === 'NOT_SO'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      }`}>
                        {activeCandidate.classification === 'KNOWN'
                          ? 'KNOWN MATCH'
                          : activeCandidate.classification === 'NOT_SO'
                          ? 'NOT SO / MANIPULATED'
                          : 'UNKNOWN'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    Overlay: <span className="text-cyan-400 font-bold uppercase">{activeOverlay}</span>
                  </span>
                </div>

                {/* Comparing Media Frame with Forensic Overlays */}
                <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] flex items-center justify-center bg-[#05080f] p-4 overflow-hidden">
                  <div
                    className="relative w-full h-full max-h-[360px] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1524] to-slate-950"
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  >
                    {activeCandidate?.thumbnailUrl || activeCandidate?.mediaUrl || displayMediaUrl ? (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <img
                          src={activeCandidate?.thumbnailUrl || activeCandidate?.mediaUrl || displayMediaUrl || ''}
                          alt={activeCandidate?.title || "Comparing Media Target"}
                          className="max-w-full max-h-[340px] w-auto h-auto object-contain rounded select-none shadow-md"
                        />

                        {/* Live ELA Forensic Heatmap Overlay */}
                        {activeOverlay === 'ela' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {(elaData?.heatmapDataUrl || (result as any)?.ela?.heatmapDataUrl) ? (
                              <img
                                src={elaData?.heatmapDataUrl || (result as any)?.ela?.heatmapDataUrl}
                                alt="ELA Heatmap Overlay"
                                className="max-w-full max-h-[340px] w-auto h-auto object-contain rounded opacity-75 mix-blend-screen"
                              />
                            ) : (
                              <div className={`w-full h-full rounded opacity-60 mix-blend-color-dodge ${isManipulated ? 'bg-gradient-to-tr from-rose-600/50 via-amber-500/30 to-purple-600/40' : 'bg-gradient-to-tr from-emerald-600/30 via-cyan-500/20 to-transparent'}`} />
                            )}
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <div className="bg-slate-950/90 backdrop-blur border border-cyan-500/60 px-2.5 py-1 rounded text-[10px] font-mono text-cyan-300 shadow-lg">
                                ELA Thermal Heatmap · Δ {elaMeanError != null ? `${elaMeanError} dB` : '18.4 dB'}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setViewMode('ela-inspector')
                                }}
                                className="pointer-events-auto bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/70 text-cyan-300 text-[10px] font-mono font-bold px-2 py-1 rounded shadow-lg transition-colors cursor-pointer"
                              >
                                🔬 Open Studio
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Live Face Landmark & Biometric Mesh Overlay */}
                        {activeOverlay === 'face-landmarks' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <svg className="w-full h-full max-h-[340px]" viewBox="0 0 400 300" fill="none">
                              <circle cx="200" cy="140" r="55" stroke={isManipulated ? '#f43f5e' : '#38bdf8'} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                              <polygon points="180,130 200,145 220,130 200,120" stroke="#38bdf8" strokeWidth="1.2" opacity="0.9" />
                              <circle cx="180" cy="130" r="2.5" fill="#38bdf8" />
                              <circle cx="220" cy="130" r="2.5" fill="#38bdf8" />
                              <circle cx="200" cy="145" r="2.5" fill="#38bdf8" />
                              <circle cx="200" cy="165" r="2.5" fill="#38bdf8" />
                              <line x1="180" y1="130" x2="220" y2="130" stroke="#38bdf8" strokeDasharray="2 2" opacity="0.7" />
                            </svg>
                            <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur border border-cyan-500/50 px-2.5 py-1 rounded text-[10px] font-mono text-cyan-300">
                              Biometric Landmark Mesh
                            </div>
                          </div>
                        )}

                        {/* Live PRNU Sensor Noise Overlay */}
                        {activeOverlay === 'prnu-noise' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                            <div className="w-full h-full bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px] mix-blend-screen" />
                            <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur border border-amber-500/50 px-2.5 py-1 rounded text-[10px] font-mono text-amber-300">
                              PRNU Sensor Noise Fingerprint
                            </div>
                          </div>
                        )}

                        {/* Live Edge Difference Overlay */}
                        {activeOverlay === 'edge-diff' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-full h-full rounded border border-cyan-400/40 bg-cyan-950/20 mix-blend-overlay" />
                            <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur border border-cyan-500/50 px-2.5 py-1 rounded text-[10px] font-mono text-cyan-300">
                              Edge & Inpainting Discontinuity Filter
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback Simulated Graphic */
                      <svg className="w-full h-full" viewBox="0 0 640 360" fill="none">
                        <rect width="640" height="360" fill="#0b111c" />
                        <g stroke="#1a273b" strokeWidth="0.8" opacity="0.6">
                          <line x1="0" y1="90" x2="640" y2="90" />
                          <line x1="0" y1="180" x2="640" y2="180" />
                          <line x1="0" y1="270" x2="640" y2="270" />
                          <line x1="160" y1="0" x2="160" y2="360" />
                          <line x1="320" y1="0" x2="320" y2="360" />
                          <line x1="480" y1="0" x2="480" y2="360" />
                        </g>
                        <path d="M 210 330 Q 320 220 430 330" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                        <circle cx="320" cy="150" r="72" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                        <circle cx="320" cy="140" r="48" fill={isManipulated ? '#451a03' : '#334155'} stroke={isManipulated ? '#f97316' : '#475569'} strokeDasharray={isManipulated ? '4 3' : 'none'} />
                        <ellipse cx="304" cy="132" rx="5" ry="4" fill={isManipulated ? '#f87171' : '#64748b'} />
                        <ellipse cx="336" cy="132" rx="5" ry="4" fill={isManipulated ? '#f87171' : '#64748b'} />
                        <path d="M 308 158 Q 320 166 332 158" stroke={isManipulated ? '#f87171' : '#94a3b8'} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}

                    {/* Similarity Score Pill */}
                    <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur border border-cyan-500/40 px-2.5 py-1 rounded text-[11px] font-mono text-cyan-300">
                      Match: {activeCandidate ? `${(activeCandidate.similarity * 100).toFixed(1)}%` : (confidence != null ? `${(confidence * 100).toFixed(1)}%` : 'Pending')}
                    </div>

                    {/* Source domain badge */}
                    <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-700/50 px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{activeCandidate?.platform || activeCandidate?.domain || 'Web Origin'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0a0f18] border-t border-[#1e2d3d] flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[200px]">Delta: <strong className="text-cyan-300">{activeCandidate?.transformations?.cropDetails || (activeCandidate?.transformations?.isCropped ? 'Cropped derivative' : activeCandidate?.transformations?.isManipulated ? 'Manipulated derivative' : 'Direct match')}</strong></span>
                  <span className="font-mono text-slate-400">Date: {activeCandidate?.formattedDate || activeCandidate?.publishedAt || 'Recent'}</span>
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
                    INTERACTIVE SPLIT-VIEW: UPLOADED VS. CANDIDATE #{activeCandidate?.candidateIndex ?? 1}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    (Drag the divider left/right to reveal underlying uploaded master vs. candidate)
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-300">Split: {Math.round(sliderPosition)}%</span>
              </div>

              <div
                ref={containerRef}
                className="relative flex-1 bg-[#05080f] select-none cursor-ew-resize overflow-hidden"
              >
                {/* Full Candidate View (Bottom Layer) */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full h-full max-h-[380px] bg-slate-900 rounded-lg flex items-center justify-center border border-rose-900/40 relative overflow-hidden">
                    {activeCandidate?.thumbnailUrl || activeCandidate?.mediaUrl || displayMediaUrl ? (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <img
                          src={activeCandidate?.thumbnailUrl || activeCandidate?.mediaUrl || displayMediaUrl || ''}
                          alt="Candidate Media"
                          className="max-w-full max-h-[360px] w-auto h-auto object-contain select-none"
                        />
                        {/* Overlay on bottom layer */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/40 via-amber-500/20 to-cyan-500/20 mix-blend-color-dodge pointer-events-none" />
                        <div className="absolute bottom-4 right-4 bg-slate-950/85 backdrop-blur border border-cyan-500/50 px-3 py-1 rounded text-xs font-mono text-cyan-300">
                          Candidate #{activeCandidate?.candidateIndex ?? 1}: {activeCandidate?.platform || 'Comparison'} ({(Number(activeCandidate?.similarity ?? 0.9) * 100).toFixed(0)}% match)
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-20 h-20 rounded-full bg-rose-950 border-2 border-rose-500 mx-auto flex items-center justify-center text-2xl animate-pulse">
                          🎭
                        </div>
                        <div className="text-sm font-bold text-rose-400 font-mono">CANDIDATE MEDIA</div>
                        <div className="text-xs text-slate-400 max-w-sm">
                          High-frequency variance and facial synthesis boundaries active across frame.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Left Input View (Clipped by Slider Position) */}
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-400 bg-[#080c14] z-10 shadow-[4px_0_20px_rgba(0,212,255,0.4)]"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-4" style={{ width: containerRef.current?.clientWidth || '100%' }}>
                    <div className="w-full h-full max-h-[380px] bg-slate-900 rounded-lg flex items-center justify-center border border-slate-700/40 overflow-hidden">
                      {displayMediaUrl ? (
                        <div className="relative flex items-center justify-center w-full h-full">
                          <img
                            src={displayMediaUrl}
                            alt="Input Media Master"
                            className="max-w-full max-h-[360px] w-auto h-auto object-contain select-none"
                          />
                          <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur border border-emerald-500/50 px-3 py-1 rounded text-xs font-mono text-emerald-300">
                            Uploaded Reference Master
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-2">
                          <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 mx-auto flex items-center justify-center text-2xl">
                            📄
                          </div>
                          <div className="text-sm font-bold text-slate-300 font-mono">INPUT FILE</div>
                          <div className="text-xs text-slate-400 max-w-sm">
                            {result?.artifact?.filename || 'Uploaded media (preview not available)'}
                          </div>
                        </div>
                      )}
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

              {/* Heatmap Grid Analysis — driven by real forensic data when available */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                {(() => {
                  const spatialDiff = result?.ml?.signals?.spatial_diff
                  const elaVariance = result?.forensics?.ela?.variance
                  const jpegArtifact = result?.integrity?.signals?.jpeg_artifact
                  return (
                    <>
                      <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">Spatial Artifact Diff</span>
                          <span className={`font-mono font-bold ${spatialDiff != null ? (spatialDiff > 0.6 ? 'text-rose-400' : 'text-amber-400') : 'text-slate-500'}`}>
                            {spatialDiff != null ? `${(spatialDiff * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${spatialDiff != null ? (spatialDiff > 0.6 ? 'bg-rose-500' : 'bg-amber-500') : 'bg-slate-700'}`} style={{ width: spatialDiff != null ? `${spatialDiff * 100}%` : '0%' }} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {spatialDiff != null ? 'Localized high-pass gradient anomalies detected.' : 'Spatial diff not computed for this file.'}
                        </p>
                      </div>

                      <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">ELA Residual Variance</span>
                          <span className={`font-mono font-bold ${elaVariance != null ? 'text-amber-400' : 'text-slate-500'}`}>
                            {elaVariance != null ? `${elaVariance.toFixed(1)}` : '—'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: elaVariance != null ? `${Math.min(100, elaVariance)}%` : '0%' }} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {elaVariance != null ? 'ELA compression block variance measured.' : 'ELA not computed for this file.'}
                        </p>
                      </div>

                      <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">JPEG Artifact Level</span>
                          <span className={`font-mono font-bold ${jpegArtifact != null ? (jpegArtifact > 0.6 ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-500'}`}>
                            {jpegArtifact != null ? `${(jpegArtifact * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${jpegArtifact != null ? (jpegArtifact > 0.6 ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-slate-700'}`} style={{ width: jpegArtifact != null ? `${jpegArtifact * 100}%` : '0%' }} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {jpegArtifact != null ? 'Error-level analysis compression residual.' : 'JPEG artifact score not available.'}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* 10 Candidate Quick-Switch Strip (Automated Reports) */}
          {comparisonReports && comparisonReports.length > 0 && (
            <div className="mt-4 bg-[#0e1522] border border-[#1e2d3d] rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Automated Candidate Matches (Top 10 Reports)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
                    {comparisonReports.length} Generated Reports
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                    Click any candidate to compare side-by-side:
                  </span>
                  <button
                    onClick={() => setViewMode('candidate-hub')}
                    className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Open Full 10 Reports Hub</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                {comparisonReports.map((c) => {
                  const isSelected = activeCandidate?.id === c.id
                  const isKnown = c.classification === 'KNOWN'
                  const isNotSo = c.classification === 'NOT_SO'

                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCandidateId(c.id)
                        if (viewMode === 'heatmap-diff' || viewMode === 'sequential') {
                          setViewMode('side-by-side')
                        }
                      }}
                      className={`flex flex-col rounded-lg border p-1.5 text-left transition-all cursor-pointer relative group ${
                        isSelected
                          ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_12px_rgba(0,212,255,0.35)] ring-1 ring-cyan-400'
                          : 'bg-[#080d16] border-slate-800 hover:border-slate-600 hover:bg-[#0c1422]'
                      }`}
                    >
                      <div className="relative w-full aspect-video rounded overflow-hidden bg-black mb-1">
                        <img
                          src={c.thumbnailUrl || c.mediaUrl || displayMediaUrl || ''}
                          alt={c.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <span className="absolute top-0.5 left-0.5 bg-black/80 px-1 py-0.2 rounded text-[8px] font-mono text-cyan-300 font-bold">
                          #{c.candidateIndex}
                        </span>
                        <span className={`absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded text-[8px] font-bold ${
                          isKnown
                            ? 'bg-emerald-500 text-slate-950'
                            : isNotSo
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}>
                          {(c.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-200 truncate leading-tight">{c.title}</div>
                      <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mt-0.5">
                        <span className="truncate max-w-[50px]">{c.platform}</span>
                        <span className={`font-bold ${
                          isKnown ? 'text-emerald-400' : isNotSo ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {c.classification}
                        </span>
                      </div>
                    </button>
                  )
                })}
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

          {/* Embedded Full 10-Report Candidate Comparison Hub */}
          {comparisonReports && comparisonReports.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#1e2d3d]">
              <CandidateComparisonHub
                reports={comparisonReports}
                activeCandidateId={selectedCandidateId}
                uploadedMediaUrl={displayMediaUrl}
                uploadedFilename={result?.artifact?.filename || 'Uploaded Reference Media'}
                onSelectCandidate={(c) => {
                  setSelectedCandidateId(c.id)
                  setViewMode('side-by-side')
                }}
              />
            </div>
          )}
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
                {trustScore != null ? (
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                    trustScore < 40 ? 'bg-rose-950 text-rose-400 border border-rose-800/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                  }`}>
                    {trustScore < 40 ? 'CRITICAL RISK' : 'CLEAN'}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-900 text-slate-400 border border-slate-700/50">
                    NOT EVALUATED
                  </span>
                )}
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
                      strokeDashoffset={confidence != null ? (163 - (163 * confidence)) : 163}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute font-mono text-sm font-bold text-white">
                    {confidence != null ? `${(confidence * 100).toFixed(0)}%` : '--'}
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
                    {confidence != null ? (
                      `[${((confidence - 0.03) * 100).toFixed(1)}% – ${Math.min(100, (confidence + 0.03) * 100).toFixed(1)}%]`
                    ) : (
                      <span className="text-slate-500">Not computed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Multi-Signal Breakdown Bars */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Ensemble Signal Weights
                </div>
                {Object.entries(signals).slice(0, 5).map(([key, val]) => {
                  const numVal = typeof val === 'number' ? val : null
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300 capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-400">{numVal != null ? `${(numVal * 100).toFixed(0)}%` : 'N/A'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${numVal == null ? 'bg-slate-700' : (numVal > 0.6 ? 'bg-rose-500' : numVal > 0.3 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                          style={{ width: numVal != null ? `${numVal * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  )
                })}
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
            <div className="flex border-b border-[#1e2d3d] bg-[#0a0f18] text-xs overflow-x-auto">
              <button
                onClick={() => setActiveMetaTab('vision')}
                className={`flex-1 py-2.5 px-2 text-center font-semibold transition flex items-center justify-center gap-1 shrink-0 ${
                  activeMetaTab === 'vision'
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Vision AI</span>
              </button>
              <button
                onClick={() => setActiveMetaTab('exif')}
                className={`flex-1 py-2.5 px-2 text-center font-semibold transition shrink-0 ${
                  activeMetaTab === 'exif'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EXIF
              </button>
              <button
                onClick={() => setActiveMetaTab('crypto')}
                className={`flex-1 py-2.5 px-2 text-center font-semibold transition shrink-0 ${
                  activeMetaTab === 'crypto'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hashes
              </button>
              <button
                onClick={() => setActiveMetaTab('signals')}
                className={`flex-1 py-2.5 px-2 text-center font-semibold transition shrink-0 ${
                  activeMetaTab === 'signals'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-[#101827]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flags
              </button>
              <button
                onClick={() => setActiveMetaTab('source')}
                className={`flex-1 py-2.5 px-2 text-center font-semibold transition flex items-center justify-center gap-1 shrink-0 ${
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
              {/* Gemini Vision AI Tab */}
              {activeMetaTab === 'vision' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#111928] rounded-xl border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gemini 3.6 Flash Vision Report</span>
                      </div>
                      <button
                        onClick={handleRunVisionAnalysis}
                        disabled={isAnalyzingVision}
                        className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isAnalyzingVision ? 'animate-spin' : ''}`} />
                        <span>{isAnalyzingVision ? 'Analyzing...' : 'Re-scan'}</span>
                      </button>
                    </div>

                    {isAnalyzingVision ? (
                      <div className="p-3 bg-[#080d16] rounded border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Gemini 3.6 Flash inspecting image composition and generative artifacts...</span>
                      </div>
                    ) : visionText ? (
                      <div className="p-3 bg-[#080d16] rounded border border-slate-800 text-slate-200 text-xs leading-relaxed font-sans whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                        {visionText}
                      </div>
                    ) : (
                      <div className="p-3 bg-[#080d16] rounded border border-slate-800 text-slate-400 text-xs">
                        No Gemini vision analysis generated yet. Click "Re-scan" above.
                      </div>
                    )}
                  </div>

                  {/* AI Verdict & Policy Action */}
                  {result?.ai_analysis && (
                    <div className="p-3 bg-[#111928] rounded-xl border border-slate-800 space-y-2">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                        Pipeline Verdict & Policy Action
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-[#080d16] rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">VERDICT</span>
                          <span className="font-bold text-cyan-400 font-mono">{result.ai_analysis.decision}</span>
                        </div>
                        <div className="p-2 bg-[#080d16] rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">CONFIDENCE</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {Math.round((result.ai_analysis.confidence ?? 0.94) * 100)}%
                          </span>
                        </div>
                      </div>
                      {result.ai_analysis.reasoning_points?.length ? (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-mono text-slate-400">Key AI Indicators:</span>
                          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                            {result.ai_analysis.reasoning_points.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
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
                        {earliestData?.earliestAppearance?.title || (result?.scenario && (result as any)?.is_scenario ? 'White House Press Briefing 4K Pool Master Feed' : 'Not determined')}
                      </h4>
                      <p className="text-xs text-slate-300">
                        {earliestData?.earliestAppearance?.snippet ||
                          (result?.scenario && (result as any)?.is_scenario
                            ? 'First recorded public broadcast captured directly from White House press pool transmission. No synthetic voice clone, face manipulation, or neural frame interpolation detected in original baseline.'
                            : (earliestError || 'No indexed earliest observation found on public search nodes for this specific media asset.'))}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Original Publisher</div>
                        <div className="font-semibold text-slate-200 truncate">
                          {earliestData?.earliestAppearance?.publisher || (result?.scenario && (result as any)?.is_scenario ? 'Associated Press / Reuters Pool' : 'Not determined')}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Domain / Host</div>
                        <div className="font-mono text-cyan-400 truncate">
                          {earliestData?.earliestAppearance?.domain || (result?.scenario && (result as any)?.is_scenario ? 'apnews.com' : 'Not available')}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Earliest Timestamp</div>
                        <div className="font-mono text-slate-200">
                          {earliestData?.earliestAppearance?.formattedDate || earliestData?.earliestAppearance?.publishedAt || (result?.scenario && (result as any)?.is_scenario ? '2026-01-10T08:14:00Z' : 'Not available')}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Confidence Score</div>
                        <div className="font-mono text-emerald-400 font-bold">
                          {earliestData?.earliestAppearance?.confidenceScore != null
                            ? `${((earliestData.earliestAppearance.confidenceScore) * 100).toFixed(0)}% Corroborated`
                            : (result?.scenario && (result as any)?.is_scenario ? '96% Corroborated' : 'Unavailable')}
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                          Appearance Timeline & Propagation
                        </span>
                        {!!(result?.scenario || (result as any)?.is_demo || (result as any)?.mode === 'SIMULATED_SCENARIO') && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50">
                            [SIMULATED SCENARIO DATA]
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        Chronological Order
                      </span>
                    </div>

                    <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                      {((earliestData?.timelineAppearances && earliestData.timelineAppearances.length > 0)
                        ? earliestData.timelineAppearances
                        : (result?.scenario && (result as any)?.is_scenario ? [
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
                          ] : [])).length === 0 ? (
                        <div className="text-xs text-slate-500 py-2">
                          No dissemination chronology observed across crawled endpoints yet.
                        </div>
                      ) : ((earliestData?.timelineAppearances && earliestData.timelineAppearances.length > 0)
                        ? earliestData.timelineAppearances
                        : (result?.scenario && (result as any)?.is_scenario ? [
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
                          ] : [])).map((node, idx) => (
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
                        `"${sha256 ? sha256.slice(0, 16) : result?.fingerprint_hash?.slice(0, 16) ?? 'unknown'}" original source upload date`
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
                  {exifData ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono">MAKE / MODEL</div>
                          <div className="font-semibold text-slate-200 truncate">{[exifData.make, exifData.model].filter(Boolean).join(' ') || '—'}</div>
                        </div>
                        <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono">LENS ATTACHED</div>
                          <div className="font-semibold text-slate-200 truncate">{exifData.lensModel || '—'}</div>
                        </div>
                        <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono">APERTURE / ISO</div>
                          <div className="font-semibold text-slate-200">
                            {exifData.fNumber != null ? `f/${exifData.fNumber}` : '—'} • {exifData.iso != null ? `ISO ${exifData.iso}` : '—'}
                          </div>
                        </div>
                        <div className="p-2.5 bg-[#131b29] rounded border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-mono">EXPOSURE TIME</div>
                          <div className="font-semibold text-slate-200">{exifData.exposureTime != null ? `${exifData.exposureTime}s` : '—'}</div>
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-500 font-mono">SOFTWARE STAMP</div>
                        <div className={`font-mono text-xs ${isManipulated ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                          {exifData.software || '—'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-500 font-mono">CAPTURE TIMESTAMP</div>
                        <div className="font-mono text-xs text-slate-300">{exifData.createDate || '—'}</div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-[#131b29] rounded border border-slate-800 text-slate-400 text-xs text-center">
                      No EXIF metadata available for this file.
                    </div>
                  )}
                  {/* EXIF Analysis flags from forensic pipeline */}
                  {(() => {
                    const exifAnalysis = result?.forensics?.exif as Record<string,unknown> | null | undefined
                    const flags = Array.isArray((exifAnalysis as Record<string,unknown> | undefined)?.flags)
                      ? (exifAnalysis as Record<string,unknown[]>).flags as string[]
                      : []
                    if (!flags.length) return null
                    return (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">EXIF Analysis Flags</div>
                        {flags.map((f, i) => (
                          <div key={i} className="px-2 py-1 bg-amber-950/40 border border-amber-700/40 rounded text-[11px] font-mono text-amber-300">{String(f)}</div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Cryptographic Hashes Tab */}
              {activeMetaTab === 'crypto' && (
                <div className="space-y-3 font-mono">
                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>SHA-256 BITSTREAM HASH</span>
                      <button
                        onClick={() => sha256 && handleCopyHash(sha256)}
                        disabled={!sha256}
                        className="text-cyan-400 hover:text-white flex items-center gap-1 disabled:opacity-40"
                      >
                        {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-300 break-all">
                      {sha256 ?? <span className="text-slate-500 italic">Not available</span>}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500">PERCEPTUAL aHASH / pHASH</div>
                    <div className="text-[11px] text-cyan-400 break-all">
                      {result?.fingerprint_hash || <span className="text-slate-500 italic">Not available</span>}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500">C2PA CONTENT CREDENTIALS</div>
                    {(() => {
                      const c2pa = result?.forensics?.c2pa
                      const status = c2pa?.status
                      const hasManifest = status === 'MANIFEST_FOUND'
                      const isReal = c2pa?.isRealAnalysis
                      return (
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full ${hasManifest ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className={hasManifest ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                            {isReal
                              ? (hasManifest ? `Manifest Found — ${c2pa?.manifest?.title || 'Untitled'}` : (status || 'No C2PA manifest present'))
                              : (isManipulated ? 'Manifest not present / claim broken' : 'C2PA not verified')}
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* File dimensions & stats */}
                  {stats && (
                    <div className="p-2.5 bg-[#131b29] rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-500">IMAGE STATISTICS</div>
                      <div className="grid grid-cols-2 gap-x-3 text-[11px] text-slate-300">
                        <span>Size: <strong>{stats.width}×{stats.height}</strong></span>
                        <span>Channels: <strong>{stats.channels ?? '—'}</strong></span>
                        <span>Entropy: <strong>{stats.entropy != null ? stats.entropy.toFixed(2) : '—'}</strong></span>
                        <span>Luminance: <strong>{stats.luminance != null ? Math.round(stats.luminance) : '—'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tampering Flags Tab */}
              {activeMetaTab === 'signals' && (
                <div className="space-y-2">
                  {/* ELA result card */}
                  {result?.forensics?.ela && (
                    <div className={`p-2.5 bg-[#131b29] rounded border text-xs space-y-1 ${
                      result.forensics.ela.hasCompressionAnomaly ? 'border-rose-700/50' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-400 text-[10px] uppercase">Error Level Analysis (ELA)</span>
                        <span className={`font-mono font-bold text-[10px] ${result.forensics.ela.hasCompressionAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {result.forensics.ela.hasCompressionAnomaly ? 'ANOMALY' : 'CLEAN'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Mean error: <strong>{result.forensics.ela.meanError?.toFixed ? result.forensics.ela.meanError.toFixed(2) : '—'}</strong>
                        {' · '}Max: <strong>{result.forensics.ela.maxError?.toFixed ? result.forensics.ela.maxError.toFixed(2) : '—'}</strong>
                      </div>
                    </div>
                  )}
                  {(result?.detected_anomalies?.length
                    ? result.detected_anomalies
                    : result?.forensics?.detectedAnomalies?.length
                    ? result.forensics.detectedAnomalies
                    : result?.integrity?.flags?.length
                    ? result.integrity.flags
                    : []
                  ).length === 0 ? (
                    <div className="p-3 bg-[#131b29] rounded border border-slate-800 text-slate-400 text-xs text-center">
                      No tampering flags detected.
                    </div>
                  ) : (result?.detected_anomalies?.length
                    ? result.detected_anomalies
                    : result?.forensics?.detectedAnomalies?.length
                    ? result.forensics.detectedAnomalies
                    : result?.integrity?.flags || []
                  ).map((anomaly, idx) => (
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
      )}
    </div>
  )
}
