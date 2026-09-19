import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { Tooltip } from '../ui/Tooltip'
import { getToken } from '../../lib/supabaseClient'
import type { Platform, ContentType, Scenario } from '../../types'

const CATEGORIZED_SCENARIOS: {
  category: string
  scenarios: { key: Scenario; label: string; color: string; icon: string; tooltip: string }[]
}[] = [
  {
    category: 'AUTHENTIC',
    scenarios: [
      { key: 'normal', label: 'Authentic Original', color: '#22c55e', icon: '✅', tooltip: 'Authentic original content with intact signatures and verified provenance' },
      { key: 'education', label: 'Fair Use Review', color: '#10b981', icon: '🎓', tooltip: 'Educational breakdown with commentary under fair use exemptions' },
    ]
  },
  {
    category: 'SYNTHETIC & AI',
    scenarios: [
      { key: 'deepfake', label: 'Deepfake AI Video', color: '#ef4444', icon: '🤖', tooltip: 'AI synthesized video/audio with neural face-swap or voice clone' },
      { key: 'scam', label: 'Scam Repost Link', color: '#f87171', icon: '⚠️', tooltip: 'Unauthorized clip re-upload driving unauthorized promotional links' },
    ]
  },
  {
    category: 'TAMPERED',
    scenarios: [
      { key: 'crop', label: 'Crop Removal', color: '#f97316', icon: '✂️', tooltip: 'Spatially cropped media with removed branding/watermarks' },
      { key: 'manipulated', label: 'Frame Edit', color: '#f43f5e', icon: '🎞️', tooltip: 'Frame-edited or re-compressed video with altered audio track' },
      { key: 'news', label: 'Unattributed', color: '#f59e0b', icon: '📰', tooltip: 'Syndicated news re-upload lacking primary creator attribution' },
      { key: 'blur', label: 'Blur / Filter', color: '#818cf8', icon: '💧', tooltip: 'Spatial blur & compression noise applied to alter visual hashes' },
    ]
  },
  {
    category: 'EVASION',
    scenarios: [
      { key: 'adversarial', label: 'Adversarial Noise', color: '#c084fc', icon: '⚡', tooltip: 'Perturbed media with invisible noise patterns targeting ML detectors' },
      { key: 'insufficient', label: 'Low Signal', color: '#94a3b8', icon: '❓', tooltip: 'Low quality or truncated media yielding inconclusive forensic signals' },
    ]
  }
]

const ALL_SCENARIOS = CATEGORIZED_SCENARIOS.flatMap(c => c.scenarios)

const PLATFORMS: Platform[] = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit']
const CONTENT_TYPES: ContentType[] = ['sports', 'news', 'entertainment', 'education', 'unknown']

const USERNAMES: Record<Scenario, string> = {
  normal: 'verified_creator',
  crop: 'clipper_vids',
  blur: 'anon_uploads',
  manipulated: 'deep_edits_daily',
  deepfake: 'ai_generated_news',
  adversarial: 'stealth_content',
  news: 'repost_syndicate',
  entertainment: 'viral_moments',
  education: 'study_breakdown',
  scam: 'crypto_giveaway_bot',
  insufficient: 'low_res_leak',
}

const CAPTIONS: Record<Scenario, string> = {
  normal: 'Highlights from last night match with verified broadcast feed',
  crop: 'Insane clip without watermark - link in bio!',
  blur: 'Leaked raw footage filtered to bypass automated scanner',
  manipulated: 'Re-edited ending scene with custom voiceover track',
  deepfake: 'BREAKING: exclusive leaked interview with the player!',
  adversarial: 'Exclusive clip with perturbed spatial signature pattern',
  news: 'Unattributed news re-upload across multiple social channels',
  entertainment: 'Viral video remix taking social media by storm',
  education: 'Detailed fair-use breakdown analyzing the key plays',
  scam: 'DOUBLE YOUR COINS NOW! Offical stream replay link below',
  insufficient: 'Corrupted 144p clip snippet uploaded via proxy',
}

export function ScannerBar() {
  const { isScanning, scanError, setScanError } = useStore()
  const { runDetection } = useDetection()

  const [scenario, setScenario] = useState<Scenario>('deepfake')
  const [platform, setPlatform] = useState<Platform>('YouTube')
  const [contentType, setContentType] = useState<ContentType>('news')
  const [username, setUsername] = useState(USERNAMES.deepfake)
  const [caption, setCaption] = useState(CAPTIONS.deepfake)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedArtifact, setUploadedArtifact] = useState<{
    id: string
    filename: string
    sha256?: string
  } | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  function onScenarioChange(sc: Scenario) {
    setScenario(sc)
    setUsername(USERNAMES[sc])
    setCaption(CAPTIONS[sc])
  }

  function applyPreset(sc: Scenario, plat: Platform, type: ContentType) {
    setScenario(sc)
    setPlatform(plat)
    setContentType(type)
    setUsername(USERNAMES[sc])
    setCaption(CAPTIONS[sc])
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadMessage(null)
    setScanError(null)

    try {
      const formData = new FormData()
      formData.append('media', file)

      const token = await getToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/artifacts/register', {
        method: 'POST',
        headers,
        body: formData
      })

      if (!res.ok) {
        throw new Error(`Artifact registration failed with status ${res.status}`)
      }

      const data = await res.json()
      if (data.status === 'registered' && data.artifact) {
        setUploadedArtifact(data.artifact)
        setUploadMessage(`Media artifact registered: ${data.artifact.filename} (SHA-256: ${(data.artifact.sha256 || '').slice(0, 12)}...)`)
      } else {
        throw new Error('Invalid response structure from artifact register endpoint')
      }
    } catch (err: unknown) {
      console.error('File upload error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Artifact registration error: ${msg}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleScan() {
    await runDetection({
      platform,
      username,
      caption,
      content_type: contentType,
      scenario,
      artifactId: uploadedArtifact ? uploadedArtifact.id : undefined
    })
  }

  const selectedSc = ALL_SCENARIOS.find(s => s.key === scenario)

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
      gap: 14
    }}>
      {/* Top Row: Presets & Active Scenario */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quick Presets:
          </span>
          <button
            onClick={() => applyPreset('deepfake', 'YouTube', 'news')}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: scenario === 'deepfake' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${scenario === 'deepfake' ? '#ef4444' : '#334155'}`,
              color: scenario === 'deepfake' ? '#f87171' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>🤖</span> Deepfake Video
          </button>

          <button
            onClick={() => applyPreset('crop', 'TikTok', 'sports')}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: scenario === 'crop' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${scenario === 'crop' ? '#f97316' : '#334155'}`,
              color: scenario === 'crop' ? '#fb923c' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>✂️</span> Crop & Watermarks
          </button>

          <button
            onClick={() => applyPreset('normal', 'X / Twitter', 'sports')}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: scenario === 'normal' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${scenario === 'normal' ? '#22c55e' : '#334155'}`,
              color: scenario === 'normal' ? '#4ade80' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>✅</span> Authentic Source
          </button>
        </div>

        {selectedSc && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: `${selectedSc.color}18`,
            border: `1px solid ${selectedSc.color}40`
          }}>
            <span style={{ fontSize: 13 }}>{selectedSc.icon}</span>
            <span style={{ fontSize: 11, color: selectedSc.color, fontWeight: 700, fontFamily: 'monospace' }}>
              SCENARIO: {selectedSc.label.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Scenario Categories */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATEGORIZED_SCENARIOS.map(cat => (
          <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#475569', fontWeight: 800, letterSpacing: '0.1em', marginRight: 2 }}>
              {cat.category}:
            </span>
            {cat.scenarios.map(sc => (
              <Tooltip key={sc.key} content={sc.tooltip} position="bottom">
                <button
                  onClick={() => onScenarioChange(sc.key)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${scenario === sc.key ? sc.color : '#1e293b'}`,
                    background: scenario === sc.key ? `${sc.color}22` : '#0f172a',
                    color: scenario === sc.key ? sc.color : '#94a3b8',
                    transition: 'all 0.15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span style={{ fontSize: 10 }}>{sc.icon}</span>
                  {sc.label}
                </button>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>

      {/* Input Controls Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        background: '#0f172a',
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid #1e293b'
      }}>
        {/* Platform Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '0 10px', borderRadius: 6, border: '1px solid #334155' }}>
          <span style={{ fontSize: 12 }}>🌐</span>
          <select
            className="vm-select"
            style={{ width: 130, border: 'none', background: 'transparent', padding: '8px 4px', fontSize: 12, fontWeight: 600, color: '#f8fafc' }}
            value={platform}
            onChange={e => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Content Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '0 10px', borderRadius: 6, border: '1px solid #334155' }}>
          <span style={{ fontSize: 12 }}>📁</span>
          <select
            className="vm-select"
            style={{ width: 115, border: 'none', background: 'transparent', padding: '8px 4px', fontSize: 12, fontWeight: 600, color: '#f8fafc' }}
            value={contentType}
            onChange={e => setContentType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Username */}
        <input
          className="vm-input"
          style={{ flex: '0 0 160px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="@username"
        />

        {/* Caption */}
        <input
          className="vm-input"
          style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Media title or post caption..."
        />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept="image/*,video/*,audio/*"
        />

        {/* File Upload Button */}
        <Tooltip content="Upload local media file to calculate SHA-256 and run real forensic pipeline" position="top">
          <button
            className="vm-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              flexShrink: 0,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>📁</span> {isUploading ? 'Hashing...' : 'Upload Media'}
          </button>
        </Tooltip>

        {/* Run Detection Trigger */}
        <Tooltip content={uploadedArtifact ? `Run real forensic pipeline on uploaded file ${uploadedArtifact.filename}` : "Run multi-signal ML deepfake detection pipeline"} position="top">
          <button
            className="vm-btn"
            style={{
              flexShrink: 0,
              minWidth: 170,
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              color: '#000',
              fontWeight: 800,
              fontSize: 12,
              padding: '9px 20px',
              borderRadius: 6,
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin-slow 1s linear infinite' }}>◌</span>
                Analyzing Mesh...
              </>
            ) : uploadedArtifact ? (
              <>🔬 Run Real Detection</>
            ) : (
              <>⚡ Run Forensic Pipeline</>
            )}
          </button>
        </Tooltip>
      </div>

      {uploadedArtifact && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 6,
          color: '#38bdf8',
          fontSize: 11,
          fontFamily: 'monospace'
        }}>
          <span>🔬 Active Artifact: {uploadedArtifact.filename}</span>
          <button
            onClick={() => setUploadedArtifact(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {uploadMessage && (
        <div style={{
          padding: '6px 12px',
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 6,
          color: '#34d399',
          fontSize: 11,
          fontFamily: 'monospace'
        }}>
          {uploadMessage}
        </div>
      )}

      {scanError && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.35)',
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
