import { useState, useRef, DragEvent } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { Tooltip } from '../ui/Tooltip'
import { registerMediaArtifact } from '../../services/api'
import { uploadStateObserver } from '../../services/uploadObserver'
import type { Platform, ContentType, Scenario } from '../../types'

const PRESET_SCENARIOS: { key: Scenario; label: string; icon: string }[] = [
  { key: 'deepfake', label: 'AI Deepfake', icon: '🤖' },
  { key: 'crop', label: 'Cropped / Modified', icon: '✂️' },
  { key: 'normal', label: 'Authentic Original', icon: '✅' },
  { key: 'manipulated', label: 'Frame Edit', icon: '🎞️' },
  { key: 'adversarial', label: 'Noise Filter', icon: '⚡' },
]

const PLATFORMS: Platform[] = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit']
const CONTENT_TYPES: ContentType[] = ['sports', 'news', 'entertainment', 'education', 'unknown']

export function ScannerBar() {
  const { isScanning, scanError, setScanError } = useStore()
  const { runDetection } = useDetection()

  const [scenario, setScenario] = useState<Scenario>('deepfake')
  const [platform, setPlatform] = useState<Platform>('YouTube')
  const [contentType, setContentType] = useState<ContentType>('news')
  const [username, setUsername] = useState('content_monitor')
  const [caption, setCaption] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedArtifact, setUploadedArtifact] = useState<{
    id: string
    filename: string
    sha256?: string
    previewUrl?: string
  } | null>(null)

  async function processFile(file: File) {
    setIsUploading(true)
    setScanError(null)

    uploadStateObserver.notify('File received', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'unknown'
    })

    // Generate local preview URL instantly
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)

    try {
      const data = await registerMediaArtifact(file)
      if (data && (data.artifact || data.success)) {
        const art = data.artifact || data
        setUploadedArtifact({
          id: art.id,
          filename: art.filename || file.name,
          sha256: art.sha256,
          previewUrl: localUrl
        })

        // Automatically trigger detection on the uploaded artifact
        await runDetection({
          platform,
          username: username || 'uploaded_user',
          caption: caption || file.name,
          content_type: contentType,
          scenario: 'normal',
          artifactId: art.id
        })
      } else {
        throw new Error('Could not parse registered artifact')
      }
    } catch (err: unknown) {
      console.error('File upload error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Upload failed: ${msg}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  async function handleScan() {
    await runDetection({
      platform,
      username,
      caption: caption || (uploadedArtifact ? uploadedArtifact.filename : 'Media scan analysis'),
      content_type: contentType,
      scenario,
      artifactId: uploadedArtifact ? uploadedArtifact.id : undefined
    })
  }

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2d3d',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 16,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      {/* Top Action Row: Drag & Drop Ingestion + Quick Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: uploadedArtifact || previewUrl ? 'auto 1fr' : '1fr auto',
        gap: 14,
        alignItems: 'center'
      }}>
        {/* Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            borderRadius: 8,
            border: isDragging ? '2px dashed #00d4ff' : '1px dashed #334155',
            background: isDragging ? 'rgba(0, 212, 255, 0.08)' : 'rgba(15, 23, 42, 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 52
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept="image/*,video/*"
          />

          {previewUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <img
                src={previewUrl}
                alt="Upload preview"
                referrerPolicy="no-referrer"
                style={{
                  width: 36,
                  height: 36,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1px solid #38bdf8'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {uploadedArtifact?.filename || 'Uploaded Media'}
                </div>
                <div style={{ fontSize: 10, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {uploadedArtifact?.sha256 ? `SHA-256: ${uploadedArtifact.sha256.slice(0, 12)}...` : 'Ready for forensic scan'}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setUploadedArtifact(null)
                  setPreviewUrl(null)
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 18, color: '#38bdf8' }}>📁</span>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <strong style={{ color: '#f8fafc' }}>
                  {isUploading ? 'Ingesting & Hashing Media...' : 'Drop image/video here'}
                </strong>{' '}
                or <span style={{ color: '#38bdf8', textDecoration: 'underline' }}>browse</span> for deep forensic audit
              </div>
            </>
          )}
        </div>

        {/* Quick Scan Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginRight: 2 }}>
            Presets:
          </span>
          {PRESET_SCENARIOS.map(sc => (
            <button
              key={sc.key}
              onClick={() => {
                setScenario(sc.key)
                if (uploadedArtifact) setUploadedArtifact(null)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${scenario === sc.key && !uploadedArtifact ? '#00d4ff' : '#1e293b'}`,
                background: scenario === sc.key && !uploadedArtifact ? 'rgba(0, 212, 255, 0.15)' : '#0f172a',
                color: scenario === sc.key && !uploadedArtifact ? '#38bdf8' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s'
              }}
            >
              <span>{sc.icon}</span>
              <span>{sc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Second Row: Context Inputs & Action Button */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        background: '#0f172a',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid #1e293b'
      }}>
        {/* Platform Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '0 8px', borderRadius: 6, border: '1px solid #334155' }}>
          <span style={{ fontSize: 12 }}>🌐</span>
          <select
            className="vm-select"
            style={{ width: 120, border: 'none', background: 'transparent', padding: '6px 2px', fontSize: 12, fontWeight: 600, color: '#f8fafc' }}
            value={platform}
            onChange={e => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Content Category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '0 8px', borderRadius: 6, border: '1px solid #334155' }}>
          <span style={{ fontSize: 12 }}>🏷️</span>
          <select
            className="vm-select"
            style={{ width: 110, border: 'none', background: 'transparent', padding: '6px 2px', fontSize: 12, fontWeight: 600, color: '#f8fafc' }}
            value={contentType}
            onChange={e => setContentType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Caption / Title */}
        <input
          className="vm-input"
          style={{ flex: 1, minWidth: 160, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Media title or description..."
        />

        {/* Execute Scan Button */}
        <button
          className="vm-btn"
          style={{
            flexShrink: 0,
            minWidth: 150,
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
            color: '#000',
            fontWeight: 800,
            fontSize: 12,
            padding: '8px 18px',
            borderRadius: 6,
            boxShadow: '0 0 14px rgba(0, 212, 255, 0.3)',
            border: 'none',
            cursor: 'pointer'
          }}
          onClick={handleScan}
          disabled={isScanning || isUploading}
        >
          {isScanning ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin-slow 1s linear infinite' }}>◌</span>
              Scanning...
            </>
          ) : uploadedArtifact ? (
            <>🔬 Audit Uploaded Media</>
          ) : (
            <>⚡ Run Forensic Scan</>
          )}
        </button>
      </div>

      {scanError && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 6,
          color: '#f87171',
          fontSize: 12
        }}>
          ⚠️ {scanError}
        </div>
      )}
    </div>
  )
}
