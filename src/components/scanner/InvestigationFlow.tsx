import React, { useState, useRef, useEffect, DragEvent } from 'react'
import { HumanReadableSummaryCard } from './HumanReadableSummaryCard'
import {
  UploadCloud,
  File,
  Image as ImageIcon,
  Film,
  Music,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Search,
  Globe,
  GitBranch,
  Activity,
  Sparkles,
  Download,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Lock,
  Scale,
  Clock,
  Sliders,
  X,
  Fingerprint,
  Layers,
  ChevronRight,
  FileCode,
  Share2,
  FileCheck2,
  FileDown,
  FolderPlus,
  FolderCheck,
  History
} from 'lucide-react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { registerMediaArtifact, createInvestigation } from '../../services/api'
import { ForensicViewer } from '../panels/ForensicViewer'
import { DiscoveryPanel } from '../panels/DiscoveryPanel'
import { OriginPanel } from '../panels/OriginPanel'
import { PropagationGraph } from '../panels/PropagationGraph'
import { EvidenceReasoningCard } from '../panels/EvidenceReasoningCard'
import type { Platform, ContentType } from '../../types'
import { DEMO_PIECES, buildDemoDetectionResult, type DemoPiece } from '../../data/demoPieces'
import { isSimulatedResult } from '../../lib/resultMode'
import { ClaimSearchBar } from './ClaimSearchBar'
import { exportInvestigationPDF } from '../../utils/pdfExport'
import { AssistantPopup } from './AssistantPopup'

const STAGES = [
  {
    id: 1,
    key: 'forensic',
    label: 'Stage 1: Pixel Forensics',
    shortTitle: 'Forensics (E1)',
    icon: '🔬',
    description: 'Error Level Analysis (ELA), sensor noise, EXIF metadata & cryptographic hashes',
    color: '#00d4ff',
  },
  {
    id: 2,
    key: 'discovery',
    label: 'Stage 2: Web Discovery',
    shortTitle: 'Discovery (E2)',
    icon: '🌐',
    description: 'Reverse image matching, domain appearances & candidate sources',
    color: '#38bdf8',
  },
  {
    id: 3,
    key: 'origin',
    label: 'Stage 3: Provenance & Origin',
    shortTitle: 'Origin (E3)',
    icon: '🌳',
    description: 'Earliest observed timestamp, author attribution & transformation lineage',
    color: '#a855f7',
  },
  {
    id: 4,
    key: 'propagation',
    label: 'Stage 4: Spread Topology',
    shortTitle: 'Spread (E4)',
    icon: '📡',
    description: 'Viral replication velocity, cross-platform cascade & propagation vector',
    color: '#f97316',
  },
  {
    id: 5,
    key: 'reasoning',
    label: 'Stage 5: Verdict & Action',
    shortTitle: 'Verdict (E5)',
    icon: '⚖️',
    description: 'Trust score calibration, VeriMedia AI reasoning summary & DMCA notice',
    color: '#22c55e',
  },
]

export function InvestigationFlow() {
  const {
    currentResult,
    isScanning,
    scanError,
    setScanError,
    setCurrentResult,
    clearResults,
    setShowDMCAModal,
    setShowEvidenceModal,
    scanProgress,
    scanStageIndex,
    scanStageTitle,
    scanStageDetail,
    scanStages,
    scanLogs,
    scanStartTime,
    investigations,
    investigationsLoading,
    fetchInvestigations,
    loadInvestigationIntoDashboard
  } = useStore()
  const { runMediaInvestigation } = useDetection()

  useEffect(() => {
    fetchInvestigations().catch(() => {})
  }, [fetchInvestigations])

  // Selected file in staging before scan
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Optional Context Inputs
  const [platform, setPlatform] = useState<Platform>('YouTube')
  const [contentType, setContentType] = useState<ContentType>('news')
  const [caption, setCaption] = useState('')
  const [username, setUsername] = useState('')
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // Stepper active stage (1 to 5)
  const isSimulatedScenario = isSimulatedResult(currentResult)

  const [currentStage, setCurrentStage] = useState<number>(1)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

  async function handleExportPDF() {
    if (!currentResult) return
    try {
      setIsExportingPDF(true)
      await exportInvestigationPDF(currentResult)
    } catch (err) {
      console.error('Failed to export PDF report:', err)
    } finally {
      setIsExportingPDF(false)
    }
  }

  // Sync elapsed timer
  useEffect(() => {
    let timer: any
    if (isScanning && scanStartTime) {
      timer = setInterval(() => {
        setElapsedTime(Math.max(0, Math.floor((Date.now() - scanStartTime) / 100) / 10))
      }, 100)
    }
    return () => clearInterval(timer)
  }, [isScanning, scanStartTime])

  // Handle file selection
  function handleFileSelected(file: File) {
    setSelectedFile(file)
    setScanError(null)
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    // Auto populate caption with clean filename if empty
    if (!caption) {
      setCaption(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  function handleFileDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelected(file)
  }

  // Fix 1: New Investigation creation step
  const [caseNameInput, setCaseNameInput] = useState('')
  const [activeCase, setActiveCase] = useState<{ id: string; title: string } | null>(null)
  const [isCaseSkipped, setIsCaseSkipped] = useState(false)
  const [isCreatingCase, setIsCreatingCase] = useState(false)
  const [scannerMode, setScannerMode] = useState<'upload' | 'headline' | 'dossiers'>('upload')

  const isCaseReady = Boolean(activeCase || isCaseSkipped)

  async function handleCreateCase(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = caseNameInput.trim()
    if (!trimmed || isCreatingCase) return
    setIsCreatingCase(true)

    try {
      const res = await createInvestigation({ title: trimmed })
      const caseId = res?.id || res?.investigation?.id || `INV-${Math.floor(1000 + Math.random() * 9000)}`
      const title = res?.title || res?.investigation?.title || trimmed
      setActiveCase({ id: caseId, title })
    } catch (err: any) {
      console.warn('Backend createInvestigation notice:', err)
      const fallbackId = `INV-${Math.floor(1000 + Math.random() * 9000)}`
      setActiveCase({ id: fallbackId, title: trimmed })
    } finally {
      setIsCreatingCase(false)
    }
  }

  // Execute full real forensic pipeline on uploaded media
  async function handleStartInvestigation() {
    if (!selectedFile) return
    setScanError(null)

    try {
      let targetCaseId = activeCase?.id
      if (!targetCaseId) {
        try {
          const caseTitle = caseNameInput.trim() || caption || selectedFile.name.replace(/\.[^/.]+$/, '')
          const res = await createInvestigation({ title: caseTitle })
          targetCaseId = res?.id || res?.investigation?.id
          if (targetCaseId) {
            setActiveCase({ id: targetCaseId, title: caseTitle })
          }
        } catch (e) {
          console.warn('Auto-create investigation notice:', e)
        }
      }

      await runMediaInvestigation(selectedFile, {
        platform: platform || 'YouTube',
        username: username || 'analyst_upload',
        caption: activeCase?.title || caseNameInput.trim() || caption || selectedFile.name,
        contentType: contentType || 'news',
        investigationId: targetCaseId
      })
      setCurrentStage(1)
    } catch (err: any) {
      console.error('Investigation error:', err)
      setScanError(err?.message || 'Investigation error occurred')
    }
  }

  function handleReset() {
    clearResults()
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCaption('')
    setUsername('')
    setCurrentStage(1)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleLaunchDemo(demo: DemoPiece) {
    const demoResult = buildDemoDetectionResult(demo)
    setCurrentResult(demoResult)
    setCurrentStage(1)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: CENTRALIZED UPLOAD CENTER (When no investigation is active)
  // ──────────────────────────────────────────────────────────────────────────
  if (!currentResult && !isScanning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 20px 60px',
        boxSizing: 'border-box'
      }}>
        {/* Main Title & Subtitle */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 20,
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            color: '#00d4ff',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 10
          }}>
            <ShieldCheck size={14} /> Multi-Engine Deepfake & Provenance Inspector
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0',
            color: '#ffffff',
            lineHeight: 1.2
          }}>
            Upload Media for Forensic Analysis
          </h1>
          <p style={{
            fontSize: 14,
            color: '#94a3b8',
            maxWidth: 640,
            margin: '0 auto',
            lineHeight: 1.5
          }}>
            Drop any image, video, or audio file to run multi-signal Error Level Analysis (ELA), camera EXIF validation, reverse web discovery, and cryptographic provenance verification.
          </p>
        </div>

        {/* Workspace Mode Tabs */}
        {!selectedFile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.75)',
            padding: '4px',
            borderRadius: 12,
            border: '1px solid #1e2d3d',
            marginBottom: 20,
            width: '100%',
            maxWidth: 680,
            justifyContent: 'center'
          }}>
            <button
              type="button"
              onClick={() => setScannerMode('upload')}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 9,
                border: scannerMode === 'upload' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
                background: scannerMode === 'upload' ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)' : 'transparent',
                color: scannerMode === 'upload' ? '#00d4ff' : '#94a3b8',
                fontWeight: scannerMode === 'upload' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <UploadCloud size={16} />
              <span>Upload Media Asset</span>
            </button>

            <button
              type="button"
              onClick={() => setScannerMode('headline')}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 9,
                border: scannerMode === 'headline' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
                background: scannerMode === 'headline' ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)' : 'transparent',
                color: scannerMode === 'headline' ? '#00d4ff' : '#94a3b8',
                fontWeight: scannerMode === 'headline' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <Globe size={16} />
              <span>Headline & Claim Check</span>
            </button>

            <button
              type="button"
              onClick={() => setScannerMode('dossiers')}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 9,
                border: scannerMode === 'dossiers' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
                background: scannerMode === 'dossiers' ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)' : 'transparent',
                color: scannerMode === 'dossiers' ? '#00d4ff' : '#94a3b8',
                fontWeight: scannerMode === 'dossiers' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <History size={16} />
              <span>Recent Dossiers ({investigations.length})</span>
            </button>
          </div>
        )}

        {/* Upload Container */}
        <div style={{ width: '100%' }}>
          {/* Sub-view: Headline Claim Verification */}
          {scannerMode === 'headline' && !selectedFile && (
            <div style={{ width: '100%', marginBottom: 24 }}>
              <ClaimSearchBar variant="card" />
            </div>
          )}

          {/* Sub-view: Media Upload Dropzone & Stage */}
          {(scannerMode === 'upload' || selectedFile) && (
            <>
              {!selectedFile ? (
                <div>
                  {/* Case Link / Name Input */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: '#0a1019',
                    border: '1px solid #1a2736'
                  }}>
                    {activeCase ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FolderCheck size={16} color="#22c55e" />
                        <span style={{ fontSize: 13, color: '#f8fafc' }}>
                          Linked Case: <strong style={{ color: '#4ade80' }}>{activeCase.title}</strong>
                        </span>
                        <span style={{ fontSize: 11, color: '#86efac', fontFamily: 'monospace', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: 8 }}>
                          {activeCase.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveCase(null)}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                        <FolderPlus size={15} color="#00d4ff" />
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Case Name:
                        </span>
                        <input
                          type="text"
                          value={caseNameInput}
                          onChange={(e) => setCaseNameInput(e.target.value)}
                          placeholder="Optional case name (e.g. Q3-election-clip) — auto-assigned if blank"
                          style={{
                            flex: 1,
                            padding: '7px 12px',
                            borderRadius: 6,
                            background: '#060a10',
                            border: '1px solid #1e2d3d',
                            color: '#f8fafc',
                            fontSize: 12,
                            outline: 'none'
                          }}
                        />
                      </div>
                    )}

                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Instant Multi-Engine Analysis • Auto-Indexed Dossier
                    </span>
                  </div>

                  {/* UNGATED, FULL-VISIBILITY DROP ZONE */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderRadius: 14,
                      border: `2px dashed ${isDragging ? '#00d4ff' : 'rgba(0, 212, 255, 0.35)'}`,
                      background: isDragging
                        ? 'rgba(0, 212, 255, 0.08)'
                        : 'linear-gradient(180deg, rgba(14, 23, 38, 0.85) 0%, rgba(10, 16, 26, 0.95) 100%)',
                      padding: '42px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      opacity: 1,
                      transition: 'all 0.2s ease',
                      boxShadow: isDragging ? '0 0 35px rgba(0, 212, 255, 0.25)' : '0 10px 30px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFileSelected(f)
                      }}
                    />

                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'rgba(0, 212, 255, 0.12)',
                      border: '1px solid rgba(0, 212, 255, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                      color: '#00d4ff',
                      boxShadow: '0 0 24px rgba(0, 212, 255, 0.2)'
                    }}>
                      <UploadCloud size={36} />
                    </div>

                    <div style={{ fontSize: 19, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
                      Drag & Drop Media Here, or <span style={{ color: '#00d4ff', textDecoration: 'underline' }}>Browse Files</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                      Supports JPEG, PNG, WebP, GIF, MP4, WebM, MP3, WAV (up to 100MB)
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: 12,
                      padding: '8px 18px',
                      borderRadius: 20,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: 12,
                      color: '#94a3b8'
                    }}>
                      <span>🔬 Real ELA Heatmaps</span>
                      <span>•</span>
                      <span>📷 Hardware EXIF</span>
                      <span>•</span>
                      <span>🌐 Multi-Source Search</span>
                      <span>•</span>
                      <span>✨ VeriMedia AI Reasoning</span>
                    </div>
                  </div>

                  {/* Quick Test Demo Scenarios */}
                  <div style={{ marginTop: 20, width: '100%' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Or test with sample forensic scenarios:
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 10
                    }}>
                      {DEMO_PIECES.slice(0, 3).map((demo) => (
                        <button
                          key={demo.id}
                          type="button"
                          onClick={() => handleLaunchDemo(demo)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: '#0b131e',
                            border: '1px solid #1e2d3d',
                            color: '#f8fafc',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#00d4ff'
                            e.currentTarget.style.background = '#101c2c'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#1e2d3d'
                            e.currentTarget.style.background = '#0b131e'
                          }}
                        >
                          <img
                            src={demo.mediaUrl}
                            alt={demo.title}
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {demo.icon} {demo.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {demo.subtitle}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 600 }}>
                            Inspect ➔
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
            /* File Staged with Preview & Optional Context */
            <div style={{
              borderRadius: 14,
              border: '1px solid #1e2d3d',
              background: '#0d1522',
              padding: 24,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)'
            }}>
              {/* Top: Staged File Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderRadius: 10,
                background: '#080e18',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {previewUrl && selectedFile.type.startsWith('image/') ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{
                        width: 68,
                        height: 68,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid #1e2d3d'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 68,
                      height: 68,
                      borderRadius: 8,
                      background: 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00d4ff'
                    }}>
                      {selectedFile.type.startsWith('video/') ? <Film size={32} /> : <File size={32} />}
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
                      <span>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>Type: {selectedFile.type || 'Binary Media'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <X size={14} /> Change File
                </button>
              </div>

              {/* Notice for Video/Audio vs Images */}
              {selectedFile && (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/') || /\.(mp4|webm|avi|mov|mkv|mp3|wav|ogg|flac|m4a)$/i.test(selectedFile.name)) ? (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
                    <AlertTriangle size={16} /> Video and audio forensic analysis isn't implemented yet — the file will be registered but not analyzed
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                    Pixel forensics (ELA, noise analysis, EXIF extraction) are currently available only for images. Video and audio files are SHA-256 fingerprinted and registered in the provenance record, but deep forensic analysis is skipped.
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(0, 212, 255, 0.15)',
                        border: '1px solid rgba(0, 212, 255, 0.35)',
                        color: '#38bdf8',
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Choose image instead
                    </button>
                    <button
                      onClick={handleStartInvestigation}
                      style={{
                        background: 'transparent',
                        border: '1px solid #334155',
                        color: '#94a3b8',
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Continue upload
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(0, 212, 255, 0.06)',
                  border: '1px solid rgba(0, 212, 255, 0.18)',
                  fontSize: 12,
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 20
                }}>
                  <Sparkles size={16} />
                  <span>
                    <strong>Ready for Investigation:</strong> You can start right away. All fields below are 100% optional and only assist targeted discovery.
                  </span>
                </div>
              )}

              {/* Optional Context Controls */}
              <div style={{
                borderTop: '1px solid #1a2636',
                paddingTop: 16,
                marginBottom: 24
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Optional Investigation Context
                  </span>
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00d4ff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Sliders size={13} /> {showAdvancedOptions ? 'Hide Optional Fields' : 'Customize Context / Platform'}
                  </button>
                </div>

                {showAdvancedOptions && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14,
                    padding: 14,
                    borderRadius: 8,
                    background: '#080d16',
                    border: '1px solid #1e2d3d',
                    marginBottom: 16
                  }}>
                    {/* Platform Scope */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                        Target Platform Context (Optional)
                      </label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as Platform)}
                        style={{
                          width: '100%',
                          background: '#0d1522',
                          border: '1px solid #24354a',
                          color: '#f8fafc',
                          padding: '8px 10px',
                          borderRadius: 6,
                          fontSize: 12
                        }}
                      >
                        <option value="YouTube">YouTube</option>
                        <option value="Instagram">Instagram</option>
                        <option value="TikTok">TikTok</option>
                        <option value="X / Twitter">X / Twitter</option>
                        <option value="Reddit">Reddit</option>
                        <option value="Facebook">Facebook</option>
                      </select>
                    </div>

                    {/* Content Category */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                        Content Category (Optional)
                      </label>
                      <select
                        value={contentType}
                        onChange={(e) => setContentType(e.target.value as ContentType)}
                        style={{
                          width: '100%',
                          background: '#0d1522',
                          border: '1px solid #24354a',
                          color: '#f8fafc',
                          padding: '8px 10px',
                          borderRadius: 6,
                          fontSize: 12
                        }}
                      >
                        <option value="news">News & Current Events</option>
                        <option value="politics">Politics & Speeches</option>
                        <option value="entertainment">Entertainment & Viral</option>
                        <option value="sports">Sports</option>
                        <option value="education">Education</option>
                        <option value="unknown">General Media</option>
                      </select>
                    </div>

                    {/* Description / Query */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                        Investigative Notes or Keywords (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Claimed footage of presidential address, viral stadium clip..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#0d1522',
                          border: '1px solid #24354a',
                          color: '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: 6,
                          fontSize: 12
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {scanError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: 13,
                  marginBottom: 16
                }}>
                  ⚠️ {scanError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid #24354a',
                    color: '#94a3b8',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleStartInvestigation}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #00d4ff 0%, #0077ff 100%)',
                    border: 'none',
                    color: '#040d1a',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.4)'
                  }}
                >
                  <Sparkles size={16} /> Start 5-Engine Investigation ➔
                </button>
              </div>
            </div>
          )}
          </>
          )}

          {/* Persisted Investigations Ledger */}
          {(scannerMode === 'dossiers' || (scannerMode === 'upload' && !selectedFile)) && (
          <div style={{
            marginTop: 36,
            borderTop: '1px solid rgba(30, 45, 61, 0.8)',
            paddingTop: 24,
            width: '100%',
            maxWidth: 860
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={16} color="#00d4ff" />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', letterSpacing: '0.05em' }}>
                  PERSISTED INVESTIGATION DOSSIERS
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  background: 'rgba(0, 212, 255, 0.1)',
                  color: '#00d4ff',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 12
                }}>
                  {investigations.length} RECORDED
                </span>
              </div>
              <button
                onClick={() => fetchInvestigations()}
                style={{
                  background: 'transparent',
                  border: '1px solid #1e293b',
                  color: '#94a3b8',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={12} className={investigationsLoading ? 'animate-spin' : ''} />
                Refresh Ledger
              </button>
            </div>

            {investigationsLoading && investigations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                Querying persisted investigation cases from SQLite ledger...
              </div>
            ) : investigations.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px dashed #1e293b',
                borderRadius: 8,
                color: '#64748b',
                fontSize: 12
              }}>
                No investigations recorded yet. Upload a media asset above to begin.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {investigations.map((inv: any) => {
                  const trust = inv.trustScore ?? inv.metadata?.trustScore
                  const title = inv.title || inv.filename || inv.id
                  const dateStr = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : 'Recent'

                  return (
                    <div
                      key={inv.id}
                      onClick={() => loadInvestigationIntoDashboard(inv)}
                      style={{
                        padding: '12px 16px',
                        background: '#0d1522',
                        border: '1px solid #1e2d3d',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#00d4ff'
                        e.currentTarget.style.background = '#111c2e'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#1e2d3d'
                        e.currentTarget.style.background = '#0d1522'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1, marginRight: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {title}
                          </span>
                          <span style={{
                            fontSize: 9,
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: inv.isDemo ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: inv.isDemo ? '#f59e0b' : '#22c55e',
                            border: `1px solid ${inv.isDemo ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                          }}>
                            {inv.isDemo ? 'DEMO' : 'PERSISTED'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748b' }}>
                          <span>Case ID: <code style={{ color: '#94a3b8' }}>{inv.id}</code></span>
                          <span>•</span>
                          <span>{dateStr}</span>
                          {inv.sha256 && (
                            <>
                              <span>•</span>
                              <span style={{ fontFamily: 'monospace' }}>SHA: {inv.sha256.slice(0, 8)}...</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {trust != null ? (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: trust >= 70 ? 'rgba(34, 197, 94, 0.1)' : trust >= 40 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: trust >= 70 ? '#22c55e' : trust >= 40 ? '#f59e0b' : '#ef4444',
                            border: `1px solid ${trust >= 70 ? 'rgba(34, 197, 94, 0.3)' : trust >= 40 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            Trust: {trust}/100
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            border: '1px solid rgba(148, 163, 184, 0.2)'
                          }}>
                            Trust: Inconclusive
                          </span>
                        )}

                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#00d4ff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          Open Dossier <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: INTERACTIVE MULTI-ENGINE SCAN HUD (During evaluation)
  // ──────────────────────────────────────────────────────────────────────────
  if (isScanning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '32px 20px',
        maxWidth: 840,
        margin: '0 auto',
        textAlign: 'center'
      }}>
        {/* Animated Radar Pulse Circle with Dual Rings */}
        <div style={{
          position: 'relative',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.02) 70%)',
          border: '2px solid rgba(0, 212, 255, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 0 60px rgba(0, 212, 255, 0.35)'
        }}>
          {/* Inner Spinning Ring */}
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '2px dashed rgba(56, 189, 248, 0.4)',
            animation: 'spin 8s linear infinite'
          }} />

          <RefreshCw size={44} className="animate-spin" style={{ color: '#00d4ff', filter: 'drop-shadow(0 0 8px #00d4ff)' }} />

          <div style={{
            position: 'absolute',
            bottom: -8,
            background: '#040d1a',
            border: '1.5px solid #00d4ff',
            borderRadius: 14,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 800,
            color: '#00d4ff',
            boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)'
          }}>
            {elapsedTime.toFixed(1)}s • {scanProgress}%
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Running Multi-Engine Forensic Pipeline
        </h2>
        <div style={{ fontSize: 14, color: '#38bdf8', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} /> {scanStageTitle}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20, maxWidth: 620, lineHeight: 1.5 }}>
          {scanStageDetail}
        </div>

        {/* High-Tech Animated Progress Bar */}
        <div style={{
          width: '100%',
          marginBottom: 24
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#64748b',
            marginBottom: 6,
            fontFamily: 'monospace'
          }}>
            <span>ANALYSIS PROGRESS</span>
            <span style={{ color: '#00d4ff', fontSize: 12 }}>{scanProgress}%</span>
          </div>

          <div style={{
            width: '100%',
            height: 10,
            borderRadius: 6,
            background: '#0d1522',
            overflow: 'hidden',
            padding: 1,
            border: '1px solid rgba(0, 212, 255, 0.3)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.max(scanProgress, 4)}%`,
              background: 'linear-gradient(90deg, #00d4ff 0%, #38bdf8 40%, #a855f7 80%, #3b82f6 100%)',
              transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: 4,
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.8)'
            }} />
          </div>
        </div>

        {/* 6 Stages Step Checklist with Glowing Active State */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {scanStages.map((st, idx) => {
            const isDone = st.status === 'COMPLETED' || scanStageIndex > idx
            const isCurrent = scanStageIndex === idx && !isDone
            const isSkipped = st.status === 'SKIPPED'
            const isFailed = st.status === 'FAILED'

            return (
              <div
                key={st.key || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: 8,
                  background: isCurrent ? 'rgba(0, 212, 255, 0.12)' : isDone ? 'rgba(34, 197, 94, 0.04)' : '#080d16',
                  border: `1px solid ${isCurrent ? '#00d4ff' : isDone ? 'rgba(34, 197, 94, 0.3)' : isFailed ? 'rgba(239, 68, 68, 0.3)' : '#1e2d3d'}`,
                  boxShadow: isCurrent ? '0 0 20px rgba(0, 212, 255, 0.2)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{st.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: isCurrent ? '#38bdf8' : isDone ? '#f8fafc' : isFailed ? '#f87171' : '#64748b'
                    }}>
                      {st.label}
                    </div>
                    {st.detail && (
                      <div style={{ fontSize: 11, color: isCurrent ? '#7dd3fc' : '#94a3b8' }}>
                        {st.detail}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {isDone ? (
                    <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle size={15} /> Completed
                    </span>
                  ) : isCurrent ? (
                    <span style={{ color: '#00d4ff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <RefreshCw size={13} className="animate-spin" /> Analyzing...
                    </span>
                  ) : isSkipped ? (
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>
                      Skipped
                    </span>
                  ) : isFailed ? (
                    <span style={{ color: '#ef4444', fontSize: 12 }}>
                      Failed
                    </span>
                  ) : (
                    <span style={{ color: '#475569', fontSize: 12 }}>
                      Pending
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Live Terminal Log Snippet */}
        {scanLogs.length > 0 && (
          <div style={{
            width: '100%',
            background: '#040d1a',
            border: '1px solid #1e2d3d',
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#38bdf8'
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4, textTransform: 'uppercase' }}>
              Latest Live Signal:
            </div>
            <div>
              &gt; {scanLogs[scanLogs.length - 1].message}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 3: 5-ENGINE PROGRESSIVE INVESTIGATION DOSSIER
  // ──────────────────────────────────────────────────────────────────────────
  if (!currentResult) return null

  const activeStage = STAGES.find(s => s.id === currentStage) || STAGES[0]
  const isLastStage = currentStage === 5
  const isFirstStage = currentStage === 1
  const nextStageInfo = STAGES.find(s => s.id === currentStage + 1)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#080c10'
    }}>
      {/* Top Banner: Investigation Case Summary, Minimized Dashboard Indicator, Exit & Reset Actions */}
      <div style={{
        padding: '12px 20px',
        background: '#0d1522',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Dashboard Minimized Badge */}
          <div style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            letterSpacing: '0.04em'
          }}>
            <Activity size={12} /> Dashboard Minimized
          </div>

          <div style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: currentResult.ai_analysis.severity === 'HIGH' || currentResult.ai_analysis.severity === 'CRITICAL'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${currentResult.ai_analysis.severity === 'HIGH' || currentResult.ai_analysis.severity === 'CRITICAL' ? '#ef4444' : '#22c55e'}50`,
            color: currentResult.ai_analysis.severity === 'HIGH' || currentResult.ai_analysis.severity === 'CRITICAL' ? '#f87171' : '#4ade80',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.05em'
          }}>
            {currentResult.ai_analysis.decision}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              Investigation: {currentResult.caption || currentResult.job_id}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 10 }}>
              <span>Hash: {(currentResult.artifact?.sha256 || currentResult.fingerprint_hash || currentResult.job_id || '').slice(0, 16)}...</span>
              <span>•</span>
              <span>Platform: {currentResult.platform}</span>
              <span>•</span>
              <span>Trust: {currentResult.trust?.trust_score ?? currentResult.ml?.trust_score ?? 85}%</span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className="vm-btn"
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              color: '#080c10',
              border: 'none',
              boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)'
            }}
          >
            <Sparkles size={13} /> {isAssistantOpen ? 'Close AI Assistant' : '✨ Forensic AI Assistant'}
          </button>

          <button
            onClick={() => useStore.getState().setShowEvidenceModal(true)}
            className="vm-btn vm-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', border: '1px solid rgba(0, 212, 255, 0.3)' }}
          >
            <FileCheck2 size={13} /> Sequential Report
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="vm-btn vm-btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#38bdf8',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              background: 'rgba(0, 212, 255, 0.08)'
            }}
            title="Export complete forensic investigation dossier as a downloadable PDF report"
          >
            <FileDown size={13} /> {isExportingPDF ? 'Generating PDF…' : 'Export PDF Report'}
          </button>

          <button
            onClick={() => {
              const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentResult, null, 2))
              const dlAnchor = document.createElement('a')
              dlAnchor.setAttribute('href', dataStr)
              dlAnchor.setAttribute('download', `VeriMedia_Audit_${currentResult.job_id || Date.now()}.json`)
              document.body.appendChild(dlAnchor)
              dlAnchor.click()
              dlAnchor.remove()
            }}
            className="vm-btn vm-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} /> Export JSON
          </button>

          {currentResult.ai_analysis?.dmca_needed && (
            <button
              onClick={() => setShowDMCAModal(true)}
              className="vm-btn"
              style={{ padding: '6px 12px', fontSize: 11, background: '#ef4444', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileCheck2 size={13} /> File DMCA
            </button>
          )}

          {/* Prominent Exit Button */}
          <button
            onClick={handleReset}
            className="vm-btn"
            style={{
              padding: '6px 14px',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#f87171',
              fontWeight: 800
            }}
            title="Exit maximized analysis and return to main dashboard"
          >
            <X size={14} /> Exit Analysis
          </button>
        </div>
      </div>

      {/* Top Stepper Navigation (Stages 1 through 5 with full stage progress) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        background: '#0a101a',
        borderBottom: '1px solid #1e2d3d',
        flexShrink: 0
      }}>
        {STAGES.map((st) => {
          const isActive = st.id === currentStage
          const isPassed = st.id <= currentStage || Boolean(currentResult)

          return (
            <button
              key={st.id}
              onClick={() => setCurrentStage(st.id)}
              style={{
                background: isActive ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: `3px solid ${isActive ? st.color : 'transparent'}`,
                borderRight: '1px solid #1e2d3d',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: isActive ? st.color : isPassed ? '#22c55e' : '#1e293b',
                color: isActive || isPassed ? '#000000' : '#94a3b8',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isPassed && !isActive ? '✓' : st.id}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isActive ? '#f8fafc' : isPassed ? '#cbd5e1' : '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {st.shortTitle}
                </div>
                <div style={{
                  fontSize: 10,
                  color: isActive ? st.color : '#475569',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {st.label.split(': ')[1]}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Floating AI Assistant Popup */}
      <AssistantPopup
        result={currentResult}
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* Center: Stage Content View */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px 40px 20px', scrollBehavior: 'smooth' }}>
        {/* High-Contrast Simulation Disclaimer Banner (Requirement 5) */}
        {isSimulatedScenario && (
          <div
            id="investigation-flow-simulated-banner"
            style={{
              marginBottom: 16,
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

        {/* Human-Readable Executive Summary Card & Engine Feature Navigator */}
        <HumanReadableSummaryCard
          result={currentResult}
          onSelectStage={(stageId) => setCurrentStage(stageId)}
          currentStage={currentStage}
        />

        {/* Stage 1: Forensic Inspection */}
        {currentStage === 1 && (
          <div style={{ width: '100%', minHeight: '100%' }}>
            <ForensicViewer result={currentResult} />
          </div>
        )}

        {/* Stage 2: Web Discovery Intelligence */}
        {currentStage === 2 && (
          <div style={{ width: '100%', minHeight: '100%' }}>
            <DiscoveryPanel />
          </div>
        )}

        {/* Stage 3: Provenance Lineage & Origin */}
        {currentStage === 3 && (
          <div style={{ width: '100%', minHeight: '100%' }}>
            <OriginPanel />
          </div>
        )}

        {/* Stage 4: Propagation Topology Mesh */}
        {currentStage === 4 && (
          <div style={{ width: '100%', minHeight: '100%' }}>
            <PropagationGraph />
          </div>
        )}

        {/* Stage 5: AI Evidence Reasoning & Verdict */}
        {currentStage === 5 && (
          <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', minHeight: '100%' }}>
            <EvidenceReasoningCard />
          </div>
        )}
      </div>

      {/* Bottom Step Guide & Pagination Footer */}
      <div style={{
        padding: '12px 20px',
        background: '#0d1522',
        borderTop: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          {!isFirstStage ? (
            <button
              onClick={() => setCurrentStage(c => Math.max(1, c - 1))}
              className="vm-btn vm-btn-ghost"
              style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} /> Previous Stage ({STAGES[currentStage - 2]?.shortTitle})
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Stage 1 of 5: Pixel & EXIF Forensics
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isLastStage ? (
            <button
              onClick={() => setCurrentStage(c => Math.min(5, c + 1))}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #00d4ff 0%, #0077ff 100%)',
                border: 'none',
                color: '#040d1a',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 0 16px rgba(0, 212, 255, 0.4)'
              }}
            >
              <span>Next Evidence: <strong>{nextStageInfo?.shortTitle}</strong></span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => setShowDMCAModal(true)}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                color: '#040d1a',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 0 16px rgba(34, 197, 94, 0.4)'
              }}
            >
              <Scale size={15} /> Take Enforcement Action (DMCA) ➔
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
