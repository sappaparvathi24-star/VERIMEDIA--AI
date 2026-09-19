import { useState } from 'react'
import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

export function EvidenceReasoningCard() {
  const { currentResult, setShowEvidenceModal, setShowDMCAModal, setActiveTab } = useStore()
  const [selectedCandidate, setSelectedCandidate] = useState<'sourceA' | 'sourceB' | 'sourceC' | 'sourceD'>('sourceA')

  if (!currentResult) return null

  const candidatesData = {
    sourceA: {
      name: 'Source A (YouTube Master)',
      confidence: 84,
      status: 'LIKELY EARLIEST OBSERVED BROADCAST',
      statusColor: '#22c55e',
      summary: 'Earliest public observation across indexed nodes. Uncropped 16:9 canvas dimensions with continuous station watermark.',
      signals: [
        {
          name: 'Earliest Broadcast Timestamp',
          category: 'TEMPORAL',
          impact: '+28%',
          color: '#4ade80',
          detail: 'Indexed at 2026-01-10 08:14 UTC, preceding subsequent appearances by 30+ hours.',
          caveat: 'Proves temporal precedence on open web; private offline footage cannot be indexed.'
        },
        {
          name: 'Perceptual pHash Correlation',
          category: 'PERCEPTUAL',
          impact: '+24%',
          color: '#4ade80',
          detail: 'DCT-64 Hamming distance = 2 / 64 (96.8% visual congruence match).',
          caveat: 'Confirms visual identity without proving authorship.'
        },
        {
          name: 'Station Bug Watermark Alpha',
          category: 'WATERMARK',
          impact: '+15%',
          color: '#4ade80',
          detail: 'Continuous station bug alpha channel detected without secondary spatial masking.',
          caveat: 'Watermarks can be spoofed if broadcast graphics are leaked.'
        },
        {
          name: 'OCR Headline Coherence',
          category: 'OCR',
          impact: '+12%',
          color: '#4ade80',
          detail: 'Lower-third banner text matches verified syndicated feed verbatim (Levenshtein = 0.00).',
          caveat: 'Captions can be preserved or copied across derivatives.'
        },
        {
          name: 'Unsigned C2PA Hardware Key',
          category: 'HARDWARE',
          impact: '-12%',
          color: '#fbbf24',
          detail: 'Asset lacks embedded hardware-level Content Credentials (C2PA) attestation from camera sensor.',
          caveat: 'Standard for legacy broadcast feeds; compensated by multi-signal ensemble.'
        },
        {
          name: 'Platform Transcode Variance',
          category: 'COMPRESSION',
          impact: '-8%',
          color: '#fbbf24',
          detail: 'YouTube VP9 re-encoding introduces mild 8x8 DCT block quantization noise (+14% ELA).',
          caveat: 'Platform re-compression must not be confused with deepfake manipulation.'
        }
      ]
    },
    sourceB: {
      name: 'Source B (Reddit Repost)',
      confidence: 42,
      status: 'DERIVED REPOST (2ND GEN)',
      statusColor: '#a855f7',
      summary: 'Secondary distribution node published 30h post-master. 91% visual similarity but second-generation transcode macroblocking.',
      signals: [
        {
          name: 'Visual Matrix Match',
          category: 'PERCEPTUAL',
          impact: '+22%',
          color: '#4ade80',
          detail: 'Retains 16:9 canvas dimensions with minor spatial downscaling.',
          caveat: 'Confirms visual asset identity.'
        },
        {
          name: 'Delayed Timeline Lag',
          category: 'TEMPORAL',
          impact: '-35%',
          color: '#fbbf24',
          detail: 'Indexed 30 hours after Source A had accumulated 120k views.',
          caveat: 'Conclusive evidence of downstream posting.'
        },
        {
          name: 'Generation Loss Artifacts',
          category: 'COMPRESSION',
          impact: '-18%',
          color: '#fbbf24',
          detail: 'Bitrate reduced by 45% (H.264 CR 28) with visible macroblocking.',
          caveat: 'Proves generation loss downstream of Source A.'
        }
      ]
    },
    sourceC: {
      name: 'Source C (TikTok 1:1 Clip)',
      confidence: 28,
      status: 'DERIVED MUTATION (CROP)',
      statusColor: '#f59e0b',
      summary: 'Tertiary spatial crop with 44% canvas loss. A cropped sub-region cannot mathematically generate the uncropped master.',
      signals: [
        {
          name: 'Salient Subject Keypoints',
          category: 'GEOMETRIC',
          impact: '+28%',
          color: '#4ade80',
          detail: 'Central subject bounding box matches master coordinates identically.',
          caveat: 'Confirms identical footage base.'
        },
        {
          name: 'Severe 1:1 Aspect Crop',
          category: 'GEOMETRIC',
          impact: '-40%',
          color: '#fbbf24',
          detail: 'Edges cropped to vertical/square format; 44% pixel loss from 16:9 master.',
          caveat: 'Mathematical impossibility of being parent root.'
        },
        {
          name: 'Delayed Publication (48h)',
          category: 'TEMPORAL',
          impact: '-30%',
          color: '#fbbf24',
          detail: 'Published two days after Source A broadcast.',
          caveat: 'Confirms tertiary derivative status.'
        }
      ]
    },
    sourceD: {
      name: 'Source D (X Dubbed Clip)',
      confidence: 14,
      status: 'SYNTHETIC TAMPERING DETECTED',
      statusColor: '#ef4444',
      summary: 'Tampered derivative with deepfake voiceover dubbing and synthetic overlay obscuring the original watermark.',
      signals: [
        {
          name: 'Background Lighting Match',
          category: 'PERCEPTUAL',
          impact: '+14%',
          color: '#4ade80',
          detail: 'Background studio scene lighting matches Source A master.',
          caveat: 'Shows base footage was extracted from Source A.'
        },
        {
          name: 'Facial Landmark Jitter & Dub',
          category: 'HARDWARE',
          impact: '-50%',
          color: '#f87171',
          detail: 'Viseme-phoneme lipsync drift (140ms desync) and facial mesh warping.',
          caveat: 'Conclusive evidence of synthetic AI voiceover replacement.'
        },
        {
          name: 'Synthetic Overlay Mask',
          category: 'WATERMARK',
          impact: '-25%',
          color: '#f87171',
          detail: 'Synthetic text banner placed directly over the origin station watermark.',
          caveat: 'Evidence of intentional copyright masking.'
        }
      ]
    }
  }

  const current = candidatesData[selectedCandidate]

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2d3d',
      borderRadius: 10,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
    }}>
      {/* Header & Full Dossier Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2d3d', paddingBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚖️</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Engine 5: Explainable AI Evidence Reasoning
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
            Origin Assessment & Calibrated Evidence Calculus
          </div>
        </div>

        <button
          onClick={() => setActiveTab('reasoning')}
          style={{
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#fbbf24',
            padding: '4px 10px',
            borderRadius: 5,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Open Full Dossier →
        </button>
      </div>

      {/* Candidate Selector Pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {(['sourceA', 'sourceB', 'sourceC', 'sourceD'] as const).map(key => {
          const item = candidatesData[key]
          const isSelected = selectedCandidate === key
          return (
            <button
              key={key}
              onClick={() => setSelectedCandidate(key)}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 700,
                background: isSelected ? '#1e293b' : '#080c10',
                border: isSelected ? `1px solid ${item.statusColor}` : '1px solid #1e2d3d',
                color: isSelected ? item.statusColor : '#8899aa',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {item.name.split(' ')[0]} {item.name.split(' ')[1]} ({item.confidence}%)
            </button>
          )
        })}
      </div>

      {/* 1. ASSESSMENT SUMMARY */}
      <div style={{
        background: '#080c10',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#8899aa', textTransform: 'uppercase' }}>
              Assessment:
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: `${current.statusColor}18`,
              border: `1px solid ${current.statusColor}`,
              color: current.statusColor
            }}>
              {current.status}
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc' }}>
            {current.name}
          </span>
        </div>

        <p style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
          {current.summary}
        </p>
      </div>

      {/* 2. CONFIDENCE PERCENTAGE BAR */}
      <div style={{
        background: '#080c10',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 800 }}>
            Confidence Calibration
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: current.statusColor, fontFamily: 'monospace' }}>
            {current.confidence}%
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: 10,
          width: '100%',
          background: '#0d1117',
          borderRadius: 5,
          border: '1px solid #1e2d3d',
          overflow: 'hidden'
        }}>
          <div
            style={{
              height: '100%',
              width: `${current.confidence}%`,
              background: `linear-gradient(90deg, #38bdf8 0%, ${current.statusColor} 100%)`,
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* 3. FORENSIC EVIDENCE TABLE WITH TOOLTIPS */}
      <div style={{
        background: '#080c10',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1px solid #1e293b', paddingBottom: 4 }}>
          Forensic Evidence Signals ({current.signals.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {current.signals.map((sig, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderRadius: 4,
                background: '#0d1117',
                border: '1px solid #16202c'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 4px', borderRadius: 3, background: '#1e293b', color: '#94a3b8' }}>
                  {sig.category}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sig.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: sig.color }}>
                  {sig.impact}
                </span>

                <Tooltip
                  position="left"
                  content={
                    <div style={{ maxWidth: 280, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontWeight: 800, color: sig.color, fontSize: 11 }}>{sig.name}</div>
                      <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.4 }}>{sig.detail}</div>
                      <div style={{ fontSize: 10, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', padding: '3px 6px', borderRadius: 4, marginTop: 2 }}>
                        <strong>Caveat:</strong> {sig.caveat}
                      </div>
                    </div>
                  }
                >
                  <span style={{ cursor: 'help', fontSize: 11, color: '#38bdf8', padding: '1px 4px' }}>
                    ℹ️
                  </span>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Epistemic Demarcation Note */}
      <div style={{
        fontSize: 10,
        color: '#cbd5e1',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: 6,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <span style={{ fontSize: 12 }}>⚖️</span>
        <span><strong>Epistemic Demarcation:</strong> Earliest public observation $\neq$ statutory legal copyright ownership.</span>
      </div>
    </div>
  )
}
