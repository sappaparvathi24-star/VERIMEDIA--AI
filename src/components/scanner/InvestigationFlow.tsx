import React, { useState, useRef, useEffect, DragEvent } from 'react'
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
  FileCheck2
} from 'lucide-react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { registerMediaArtifact } from '../../services/api'
import { ForensicViewer } from '../panels/ForensicViewer'
import { DiscoveryPanel } from '../panels/DiscoveryPanel'
import { OriginPanel } from '../panels/OriginPanel'
import { PropagationGraph } from '../panels/PropagationGraph'
import { EvidenceReasoningCard } from '../panels/EvidenceReasoningCard'
import type { Platform, ContentType } from '../../types'

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
    description: 'Trust score calibration, Gemini AI reasoning summary & DMCA notice',
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
    scanStartTime
  } = useStore()
  const { runMediaInvestigation } = useDetection()

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
  const [currentStage, setCurrentStage] = useState<number>(1)
  const [elapsedTime, setElapsedTime] = useState(0)

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

  // Execute full real forensic pipeline on uploaded media
  async function handleStartInvestigation() {
    if (!selectedFile) return
    setScanError(null)

    try {
      await runMediaInvestigation(selectedFile, {
        platform: platform || 'YouTube',
        username: username || 'analyst_upload',
        caption: caption || selectedFile.name,
        contentType: contentType || 'news'
      })
      setCurrentStage(1)
    } catch (err: any) {
      console.error('Investigation error:', err)
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

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: CENTRALIZED UPLOAD CENTER (When no investigation is active)
  // ──────────────────────────────────────────────────────────────────────────
  if (!currentResult && !isScanning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '32px 20px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        {/* Main Title & Subtitle */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            marginBottom: 12
          }}>
            <ShieldCheck size={14} /> Multi-Engine Deepfake & Provenance Inspector
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 10px 0',
            color: '#ffffff',
            lineHeight: 1.2
          }}>
            Upload Media for Forensic Analysis
          </h1>
          <p style={{
            fontSize: 15,
            color: '#94a3b8',
            maxWidth: 620,
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Drop any image, video, or audio file to run multi-signal Error Level Analysis (ELA), camera EXIF validation, reverse web discovery, and cryptographic provenance verification.
          </p>
        </div>

        {/* Upload Container */}
        <div style={{ width: '100%' }}>
          {!selectedFile ? (
            /* Empty Drag & Drop Zone */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                borderRadius: 14,
                border: `2px dashed ${isDragging ? '#00d4ff' : 'rgba(255, 255, 255, 0.15)'}`,
                background: isDragging
                  ? 'rgba(0, 212, 255, 0.06)'
                  : 'linear-gradient(180deg, rgba(14, 23, 38, 0.7) 0%, rgba(10, 16, 26, 0.9) 100%)',
                padding: '48px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isDragging ? '0 0 30px rgba(0, 212, 255, 0.2)' : '0 10px 30px rgba(0, 0, 0, 0.3)',
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
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                color: '#00d4ff'
              }}>
                <UploadCloud size={34} />
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                Drag & Drop Media Here, or <span style={{ color: '#00d4ff', textDecoration: 'underline' }}>Browse Files</span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                Supports JPEG, PNG, WebP, GIF, MP4, WebM, MP3, WAV (up to 100MB)
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 16,
                padding: '8px 18px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                fontSize: 12,
                color: '#94a3b8'
              }}>
                <span>🔬 Real ELA Heatmaps</span>
                <span>•</span>
                <span>📷 Hardware EXIF</span>
                <span>•</span>
                <span>🌐 Multi-Source Search</span>
                <span>•</span>
                <span>✨ Gemini Reasoning</span>
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

              {/* Notice that fields are optional */}
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
        maxWidth: 820,
        margin: '0 auto',
        textAlign: 'center'
      }}>
        {/* Animated Radar Pulse Circle */}
        <div style={{
          position: 'relative',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: 'rgba(0, 212, 255, 0.05)',
          border: '2px solid rgba(0, 212, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 0 50px rgba(0, 212, 255, 0.25)'
        }}>
          <RefreshCw size={40} className="animate-spin" style={{ color: '#00d4ff' }} />
          <div style={{
            position: 'absolute',
            bottom: -6,
            background: '#040d1a',
            border: '1px solid #00d4ff',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 800,
            color: '#00d4ff'
          }}>
            {elapsedTime.toFixed(1)}s
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0' }}>
          Running Multi-Stage Forensic Audit
        </h2>
        <div style={{ fontSize: 14, color: '#38bdf8', fontWeight: 600, marginBottom: 8 }}>
          {scanStageTitle}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24, maxWidth: 600 }}>
          {scanStageDetail}
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: 8,
          borderRadius: 4,
          background: '#111b2b',
          overflow: 'hidden',
          marginBottom: 24,
          border: '1px solid #1e2d3d'
        }}>
          <div style={{
            height: '100%',
            width: `${scanProgress}%`,
            background: 'linear-gradient(90deg, #00d4ff 0%, #38bdf8 50%, #a855f7 100%)',
            transition: 'width 0.3s ease',
            borderRadius: 4,
            boxShadow: '0 0 12px rgba(0, 212, 255, 0.6)'
          }} />
        </div>

        {/* 6 Stages Step Checklist */}
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
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: isCurrent ? 'rgba(0, 212, 255, 0.08)' : '#0a101a',
                  border: `1px solid ${isCurrent ? '#00d4ff60' : isDone ? '#22c55e30' : isFailed ? '#ef444430' : '#1e2d3d'}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16 }}>{st.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isCurrent ? '#00d4ff' : isDone ? '#f8fafc' : isFailed ? '#f87171' : '#64748b'
                    }}>
                      {st.label}
                    </div>
                    {st.detail && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {st.detail}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {isDone ? (
                    <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} /> Completed
                    </span>
                  ) : isCurrent ? (
                    <span style={{ color: '#00d4ff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={12} className="animate-spin" /> In Progress...
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
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#080c10'
    }}>
      {/* Top Banner: Investigation Case Summary & Reset Action */}
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
            onClick={() => useStore.getState().setShowEvidenceModal(true)}
            className="vm-btn vm-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', border: '1px solid rgba(0, 212, 255, 0.3)' }}
          >
            <FileCheck2 size={13} /> Sequential Report
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

          <button
            onClick={handleReset}
            className="vm-btn vm-btn-primary"
            style={{ padding: '6px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #00d4ff 0%, #0077ff 100%)', color: '#040d1a', fontWeight: 800 }}
          >
            <RefreshCw size={13} /> Check Another Image
          </button>
        </div>
      </div>

      {/* Top Stepper Navigation (Stages 1 through 5) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        background: '#0a101a',
        borderBottom: '1px solid #1e2d3d',
        flexShrink: 0
      }}>
        {STAGES.map((st) => {
          const isActive = st.id === currentStage
          const isPassed = st.id < currentStage

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
                {isPassed ? '✓' : st.id}
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

      {/* Center: Stage Content View */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px 40px 20px', scrollBehavior: 'smooth' }}>
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
