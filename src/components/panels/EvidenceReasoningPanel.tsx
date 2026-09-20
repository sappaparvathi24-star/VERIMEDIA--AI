import { useState } from 'react'
import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

interface ForensicSignalItem {
  id: string
  name: string
  category: 'TEMPORAL' | 'PERCEPTUAL' | 'WATERMARK' | 'OCR' | 'GEOMETRIC' | 'HARDWARE' | 'COMPRESSION' | 'EPSTEMIC' | 'ACOUSTIC'
  type: 'SUPPORTING' | 'CONTRADICTING'
  vector: string
  impact: number // positive or negative percentage
  verifiedBy: string
  rawValue: string
  algorithm: string
  diagnosticDetail: string
  epistemicCaveat: string
}

interface OriginCandidate {
  id: string
  label: string
  platform: string
  timestamp: string
  confidence: number
  status: 'LIKELY_EARLIEST_ORIGIN' | 'DERIVED_REPOST' | 'DERIVED_MUTATION' | 'UNVERIFIED_CANDIDATE'
  statusLabel: string
  statusColor: string
  similarity: number
  cropDerived: boolean
  assessmentSummary: string
  epistemicFacts: string[]
  epistemicLimitations: string[]
  signals: ForensicSignalItem[]
}

const CANDIDATES: OriginCandidate[] = [
  {
    id: 'sourceA',
    label: 'Source A (YouTube Master)',
    platform: 'YouTube',
    timestamp: '2026-01-10T08:14:00Z',
    confidence: 0.84,
    status: 'LIKELY_EARLIEST_ORIGIN',
    statusLabel: 'LIKELY EARLIEST OBSERVED BROADCAST',
    statusColor: '#22c55e',
    similarity: 0.96,
    cropDerived: false,
    assessmentSummary: 'Earliest public observation across indexed nodes. Retains full 16:9 canvas dimensions and continuous station watermark. Downstream variants show geometric cropping and re-compression.',
    epistemicFacts: [
      'Temporal precedence verified via UTC timestamp (leads by 30h+).',
      'Uncropped 1920x1080 canvas preserves full spatial context.',
      'Perceptual hash match exceeds 96% correlation.'
    ],
    epistemicLimitations: [
      'Earliest public observation does not establish legal copyright title.',
      'Unindexed private offline archives cannot be algorithmically evaluated.',
      'Legacy broadcast stream lacks C2PA hardware cryptographic signature.'
    ],
    signals: [
      {
        id: 'sig-1',
        name: 'Earliest Broadcast Timestamp',
        category: 'TEMPORAL',
        type: 'SUPPORTING',
        vector: 'UTC Ingestion & Broadcast Timeline',
        impact: 28,
        verifiedBy: 'Discovery Orchestrator',
        rawValue: '2026-01-10 08:14:00 UTC (Δt = -30h vs nearest node)',
        algorithm: 'Multi-Source UTC Normalizer',
        diagnosticDetail: 'First indexed public appearance across YouTube, Reddit, X, and TikTok crawlers with verified server headers.',
        epistemicCaveat: 'Proves temporal priority on indexed platforms; does not eliminate unindexed private storage.'
      },
      {
        id: 'sig-2',
        name: 'Perceptual pHash Match',
        category: 'PERCEPTUAL',
        type: 'SUPPORTING',
        vector: 'DCT-64 Perceptual Matrix',
        impact: 24,
        verifiedBy: 'Perceptual Matrix',
        rawValue: 'Hamming distance = 2 / 64 (96.88% visual match)',
        algorithm: 'Discrete Cosine Transform (DCT) 64-bit Hash',
        diagnosticDetail: 'Spatial luminance distribution matches master keyframes with robust tolerance to gamma remapping.',
        epistemicCaveat: 'Perceptual similarity confirms visual congruence, not original creative intent.'
      },
      {
        id: 'sig-3',
        name: 'Broadcast Station Watermark',
        category: 'WATERMARK',
        type: 'SUPPORTING',
        vector: 'Spatial Alpha Channel',
        impact: 15,
        verifiedBy: 'Steganography Engine',
        rawValue: 'Alpha continuity: 0.942, Zero secondary spatial blending',
        algorithm: 'Alpha Edge Discontinuity Detector',
        diagnosticDetail: 'Continuous station bug observed without edge boundary smearing.',
        epistemicCaveat: 'Watermarks can be spoofed if broadcast graphics package is compromised.'
      },
      {
        id: 'sig-4',
        name: 'OCR Lower-Third Banner Coherence',
        category: 'OCR',
        type: 'SUPPORTING',
        vector: 'Lower-Third Typography',
        impact: 12,
        verifiedBy: 'OCR Context Matcher',
        rawValue: 'Levenshtein Distance = 0.00 (100% string match)',
        algorithm: 'Tesseract OCR + Levenshtein String Metric',
        diagnosticDetail: 'Character recognition across breaking news banner matches syndicated news feed verbatim.',
        epistemicCaveat: 'OCR verifies text identity, but captions can be copied across derived videos.'
      },
      {
        id: 'sig-5',
        name: 'Uncropped Master Geometry',
        category: 'GEOMETRIC',
        type: 'SUPPORTING',
        vector: 'Aspect Ratio & Canvas Derivation',
        impact: 10,
        verifiedBy: 'Geometric Lineage Solver',
        rawValue: 'Crop Area: 100% Master (Sources C/D are 56% subsets)',
        algorithm: 'Spatial Saliency & Bounding Box Projection',
        diagnosticDetail: 'Downstream nodes (TikTok, X) contain cropped subsets. A cropped derivative cannot produce the uncropped master.',
        epistemicCaveat: 'Geometric superiority is strong proof of structural lineage.'
      },
      {
        id: 'sig-6',
        name: 'Unsigned C2PA Hardware Key',
        category: 'HARDWARE',
        type: 'CONTRADICTING',
        vector: 'Content Credentials (C2PA) Root',
        impact: -12,
        verifiedBy: 'C2PA Manifest Validator',
        rawValue: 'Status: UNSIGNED / MISSING_HARDWARE_ROOT',
        algorithm: 'X.509 Certificate Chain & PKI Verifier',
        diagnosticDetail: 'Asset does not contain embedded cryptographically signed provenance headers from camera sensor.',
        epistemicCaveat: 'Standard for legacy broadcast formats; compensated by multi-signal corroboration.'
      },
      {
        id: 'sig-7',
        name: 'Platform Transcode Variance',
        category: 'COMPRESSION',
        type: 'CONTRADICTING',
        vector: 'Block Residuals (ELA)',
        impact: -8,
        verifiedBy: 'ELA Variance Analyzer',
        rawValue: 'Mean Square Error = 0.0042 (+14% ELA drift)',
        algorithm: 'Error Level Analysis (ELA) Matrix 85',
        diagnosticDetail: 'YouTube VP9 re-encoding introduces mild 8x8 DCT block quantization noise.',
        epistemicCaveat: 'Platform re-compression must not be confused with deepfake manipulation.'
      }
    ]
  },
  {
    id: 'sourceB',
    label: 'Source B (Reddit Repost)',
    platform: 'Reddit',
    timestamp: '2026-01-11T14:22:00Z',
    confidence: 0.42,
    status: 'DERIVED_REPOST',
    statusLabel: 'DERIVED REPOST (2ND GEN)',
    statusColor: '#a855f7',
    similarity: 0.91,
    cropDerived: false,
    assessmentSummary: 'Secondary distribution published 30 hours after Source A. Visual and acoustic analysis confirms high similarity, but macroblock compression artifacts identify it as a downstream repost.',
    epistemicFacts: [
      'Published 30h 08m after Source A broadcast.',
      'Maintains 16:9 canvas dimensions with reduced bitrate.'
    ],
    epistemicLimitations: [
      'Post metadata retains no original camera or author attribution.'
    ],
    signals: [
      {
        id: 'sig-b1',
        name: 'Visual Matrix Congruence',
        category: 'PERCEPTUAL',
        type: 'SUPPORTING',
        vector: 'pHash Correlation with Source A',
        impact: 22,
        verifiedBy: 'Perceptual Matrix',
        rawValue: 'Hamming distance = 4 / 64 (91.2% visual match)',
        algorithm: 'DCT-64 Perceptual Hash',
        diagnosticDetail: 'Visual content matches master asset with minor high-frequency roll-off.',
        epistemicCaveat: 'Confirms asset identity; does not prove authorship.'
      },
      {
        id: 'sig-b2',
        name: 'Audio Waveform Alignment',
        category: 'ACOUSTIC',
        type: 'SUPPORTING',
        vector: 'Waveform Envelope Match',
        impact: 20,
        verifiedBy: 'Acoustic Engine',
        rawValue: 'Spectrogram Correlation = 0.978',
        algorithm: 'Chromaprint Audio Fingerprinting',
        diagnosticDetail: 'Audio track aligns with Source A broadcast with zero phase or pitch alterations.',
        epistemicCaveat: 'Acoustic matching establishes identical soundtrack.'
      },
      {
        id: 'sig-b3',
        name: 'Delayed Temporal Observation',
        category: 'TEMPORAL',
        type: 'CONTRADICTING',
        vector: 'Ingestion Precedence',
        impact: -35,
        verifiedBy: 'Discovery Orchestrator',
        rawValue: '2026-01-11 14:22:00 UTC (+30.1h lag)',
        algorithm: 'Temporal Offset Calculation',
        diagnosticDetail: 'Indexed 30 hours after Source A had already accumulated 120k views.',
        epistemicCaveat: 'Conclusive evidence of downstream secondary posting.'
      },
      {
        id: 'sig-b4',
        name: 'Generation-Loss Compression Artifacts',
        category: 'COMPRESSION',
        type: 'CONTRADICTING',
        vector: 'Quantization & Macroblock Analysis',
        impact: -18,
        verifiedBy: 'Forensic Video Decoder',
        rawValue: 'Bitrate: 2.1 Mbps (Master: 8.4 Mbps), CRF: 28',
        algorithm: 'H.264 Rate-Distortion Step Analyzer',
        diagnosticDetail: 'Macroblocking around high-motion vectors proves re-encoding downstream of master.',
        epistemicCaveat: 'Re-compression loss confirms derived status.'
      }
    ]
  },
  {
    id: 'sourceC',
    label: 'Source C (TikTok 1:1 Crop)',
    platform: 'TikTok',
    timestamp: '2026-01-12T09:05:00Z',
    confidence: 0.28,
    status: 'DERIVED_MUTATION',
    statusLabel: 'DERIVED MUTATION (SPATIAL CROP)',
    statusColor: '#f59e0b',
    similarity: 0.78,
    cropDerived: true,
    assessmentSummary: 'Tertiary spatial crop formatted for vertical/square display (44% canvas loss). A cropped clip cannot mathematically be the origin of the uncropped 16:9 master asset.',
    epistemicFacts: [
      'Pixels map to sub-region (240, 0) - (880, 720) of Source A.',
      'Upper-right broadcast watermark was cropped out.'
    ],
    epistemicLimitations: [
      'Origin account is an aggregator with automated viral clipping scripts.'
    ],
    signals: [
      {
        id: 'sig-c1',
        name: 'Subject Feature Keypoints',
        category: 'GEOMETRIC',
        type: 'SUPPORTING',
        vector: 'ORB / SIFT Keypoint Descriptor',
        impact: 28,
        verifiedBy: 'Keypoint Matcher',
        rawValue: 'Keypoint inliers = 342 / 380 (90.0%)',
        algorithm: 'Scale-Invariant Feature Transform (SIFT)',
        diagnosticDetail: 'Central subject keypoints match Source A focal region identically.',
        epistemicCaveat: 'Confirms identical underlying footage.'
      },
      {
        id: 'sig-c2',
        name: 'Aspect Ratio Reduction (44% Loss)',
        category: 'GEOMETRIC',
        type: 'CONTRADICTING',
        vector: 'Canvas Surface Area Ratio',
        impact: -40,
        verifiedBy: 'Geometric Lineage Solver',
        rawValue: 'Aspect: 1:1 (720x720) vs Master (1920x1080)',
        algorithm: 'Spatial Bounding Matrix Solver',
        diagnosticDetail: 'Information theory prevents a cropped subset from generating the outer canvas pixels present in Source A.',
        epistemicCaveat: 'Mathematical impossibility of being the root parent.'
      },
      {
        id: 'sig-c3',
        name: 'Delayed Ingestion Timestamp',
        category: 'TEMPORAL',
        type: 'CONTRADICTING',
        vector: 'Timeline Lag',
        impact: -30,
        verifiedBy: 'Discovery Orchestrator',
        rawValue: '2026-01-12 09:05:00 UTC (+48.8h lag)',
        algorithm: 'Temporal Offset Calculation',
        diagnosticDetail: 'Published nearly two days following the original broadcast.',
        epistemicCaveat: 'Reinforces derivative status.'
      }
    ]
  },
  {
    id: 'sourceD',
    label: 'Source D (X Tampered Clip)',
    platform: 'X / Twitter',
    timestamp: '2026-01-13T19:40:00Z',
    confidence: 0.14,
    status: 'DERIVED_MUTATION',
    statusLabel: 'SYNTHETIC TAMPERING DETECTED',
    statusColor: '#ef4444',
    similarity: 0.65,
    cropDerived: true,
    assessmentSummary: 'Tampered derivative with deepfake voiceover and synthetic text banner placed directly over the origin station watermark to obscure origin.',
    epistemicFacts: [
      'Facial landmark triangulation exhibits high-frequency jitter.',
      'Voiceover audio track is synthetic (ElevenLabs speech profile detected).'
    ],
    epistemicLimitations: [
      'Account flagged for coordinated disinformation dissemination.'
    ],
    signals: [
      {
        id: 'sig-d1',
        name: 'Background Lighting Match',
        category: 'PERCEPTUAL',
        type: 'SUPPORTING',
        vector: 'Background Histogram',
        impact: 14,
        verifiedBy: 'Color Gamut Analyzer',
        rawValue: 'Histogram Correlation = 0.82',
        algorithm: 'RGB Histogram Distance',
        diagnosticDetail: 'Studio background set matches Source A lighting and camera angle.',
        epistemicCaveat: 'Shows base footage was extracted from Source A.'
      },
      {
        id: 'sig-d2',
        name: 'Facial Landmark Jitter & Deepfake Dub',
        category: 'HARDWARE',
        type: 'CONTRADICTING',
        vector: 'Delaunay Lipsync Desync',
        impact: -50,
        verifiedBy: 'Face & Audio Forensics',
        rawValue: 'Lipsync Desync = 140ms, Landmark Drift = +72%',
        algorithm: 'Viseme-Phoneme SyncNet + MediaPipe Tracker',
        diagnosticDetail: 'Facial boundaries show warping artifacts and speech spectrogram lacks natural breathing transients.',
        epistemicCaveat: 'Conclusive indicator of AI speech synthesis and facial reenactment.'
      },
      {
        id: 'sig-d3',
        name: 'Synthetic Overlay Masking Watermark',
        category: 'WATERMARK',
        type: 'CONTRADICTING',
        vector: 'Watermark Occlusion',
        impact: -25,
        verifiedBy: 'Steganography Engine',
        rawValue: 'Occlusion Area: (1600, 40) - (1900, 180)',
        algorithm: 'Alpha Edge Occlusion Matrix',
        diagnosticDetail: 'Synthetic banner placed directly over the region where the origin station bug resides.',
        epistemicCaveat: 'Indicates intentional obfuscation of origin.'
      }
    ]
  }
]

export function EvidenceReasoningPanel() {
  const { currentResult, setShowDMCAModal, setShowEvidenceModal } = useStore()
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('sourceA')
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'SUPPORTING' | 'CONTRADICTING'>('ALL')

  if (!currentResult) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#080c10' }}>
        <div style={{ textAlign: 'center', color: '#4a5568' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚖️</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>No Investigation Reasoning Loaded</p>
          <p style={{ fontSize: 11 }}>Execute a scan to generate explainable AI origin assessments and governance dossiers</p>
        </div>
      </div>
    )
  }

  const candidate = CANDIDATES.find(c => c.id === selectedCandidateId) || CANDIDATES[0]

  const filteredSignals = candidate.signals.filter(s => {
    if (signalFilter === 'SUPPORTING') return s.type === 'SUPPORTING'
    if (signalFilter === 'CONTRADICTING') return s.type === 'CONTRADICTING'
    return true
  })

  const supportingCount = candidate.signals.filter(s => s.type === 'SUPPORTING').length
  const contradictingCount = candidate.signals.filter(s => s.type === 'CONTRADICTING').length

  const totalPositiveImpact = candidate.signals
    .filter(s => s.type === 'SUPPORTING')
    .reduce((acc, curr) => acc + curr.impact, 0)

  const totalNegativeImpact = candidate.signals
    .filter(s => s.type === 'CONTRADICTING')
    .reduce((acc, curr) => acc + Math.abs(curr.impact), 0)

  const confidencePct = Math.round(candidate.confidence * 100)

  return (
    <div style={{
      padding: 20,
      overflowY: 'auto',
      height: '100%',
      background: '#080c10',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }}>
      {/* 1. Header Banner */}
      <div style={{
        padding: '12px 18px',
        borderRadius: 8,
        background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(13, 17, 23, 0.95) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Engine 5 — Evidence Reasoning
            </span>
            <span style={{ fontSize: 10, background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
              EXPLAINABLE AI
            </span>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 2, marginBottom: 0 }}>
            Origin Assessment & Calibrated Evidence
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowEvidenceModal(true)}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '5px 12px',
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📄 Export Dossier
          </button>
          <button
            onClick={() => setShowDMCAModal(true)}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '5px 12px',
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📋 File DMCA Action
          </button>
        </div>
      </div>

      {/* Candidate Selector Bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#8899aa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select Evaluation Candidate:
        </span>
        {CANDIDATES.map(c => {
          const isSelected = c.id === selectedCandidateId
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCandidateId(c.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: isSelected ? '#1e293b' : '#0d1117',
                border: isSelected ? `1.5px solid ${c.statusColor}` : '1px solid #1e2d3d',
                color: isSelected ? c.statusColor : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{c.platform === 'YouTube' ? '🔴' : c.platform === 'Reddit' ? '🟠' : c.platform === 'TikTok' ? '🎵' : '🐦'}</span>
              <span>{c.label.split(' ')[0]} {c.label.split(' ')[1]}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.85, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>
                {Math.round(c.confidence * 100)}%
              </span>
            </button>
          )
        })}
      </div>

      {/* 2. SECTION 1: ASSESSMENT SUMMARY */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2d3d', paddingBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Assessment Summary
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: 5,
              background: `${candidate.statusColor}18`,
              border: `1px solid ${candidate.statusColor}`,
              color: candidate.statusColor,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.04em'
            }}>
              {candidate.statusLabel}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              ID: {candidate.id.toUpperCase()} · OBSERVED: {candidate.timestamp}
            </span>
          </div>
        </div>

        {/* Executive Summary Body */}
        <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
          {candidate.assessmentSummary}
        </p>

        {/* Epistemic Facts vs Epistemic Limitations Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
          {/* Established Facts */}
          <div style={{ background: '#080c10', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> Established Forensic Facts
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              {candidate.epistemicFacts.map((fact, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#cbd5e1' }}>{fact}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Epistemic Limitations */}
          <div style={{ background: '#080c10', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span> Epistemic Limitations & Demarcations
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              {candidate.epistemicLimitations.map((limit, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#cbd5e1' }}>{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. SECTION 2: CONFIDENCE PERCENTAGE BAR & SIGNAL CALCULUS */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2d3d', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Confidence Calibration Bar & Attribution Breakdown
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#8899aa' }}>Origin Attribution Confidence:</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: candidate.statusColor, fontFamily: 'monospace' }}>
              {confidencePct}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 6, fontFamily: 'monospace' }}>
            <span>0% UNCERTAIN</span>
            <span>40% MODERATE</span>
            <span>70% PROBABLE</span>
            <span>90%+ CORROBORATED</span>
          </div>

          <div style={{
            height: 14,
            width: '100%',
            background: '#080c10',
            borderRadius: 7,
            border: '1px solid #1e2d3d',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Threshold Guide Lines */}
            <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 1, background: '#1e293b', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 1, background: '#1e293b', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: '90%', top: 0, bottom: 0, width: 1, background: '#1e293b', zIndex: 1 }} />

            {/* Filled Bar */}
            <div
              style={{
                height: '100%',
                width: `${confidencePct}%`,
                background: `linear-gradient(90deg, #38bdf8 0%, ${candidate.statusColor} 100%)`,
                borderRadius: 6,
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: `0 0 12px ${candidate.statusColor}44`
              }}
            />
          </div>
        </div>

        {/* Explainable Attribution Calculus Summary */}
        <div style={{
          background: '#080c10',
          border: '1px solid #1e2d3d',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 700 }}>Supporting Vector Δ+</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>
                +{totalPositiveImpact}% Force
              </div>
            </div>
            <div style={{ height: 24, width: 1, background: '#1e293b' }} />
            <div>
              <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 700 }}>Contradicting Penalties Δ−</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                -{totalNegativeImpact}% Deduction
              </div>
            </div>
            <div style={{ height: 24, width: 1, background: '#1e293b' }} />
            <div>
              <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase', fontWeight: 700 }}>Corroborated Ensemble</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                {candidate.signals.length} Signals Correlated
              </div>
            </div>
          </div>

          <Tooltip
            position="top"
            content={
              <div style={{ maxWidth: 300, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>How is this score calculated?</div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  VeriMedia uses a multi-signal ensemble Bayesian weighting model. No single signal is ground truth; confidence represents calibrated cross-signal corroboration.
                </div>
              </div>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help', color: '#64748b', fontSize: 11 }}>
              <span>ℹ️</span>
              <span style={{ textDecoration: 'underline' }}>Calculus Methodology</span>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* 4. SECTION 3: FORENSIC EVIDENCE TABLE WITH TOOLTIPS */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* Table Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2d3d', paddingBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔬</span>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Forensic Evidence Signal Table
            </h3>
            <span style={{ fontSize: 11, color: '#8899aa' }}>
              ({candidate.signals.length} total signals evaluated)
            </span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, background: '#080c10', padding: 3, borderRadius: 6, border: '1px solid #1e2d3d' }}>
            <button
              onClick={() => setSignalFilter('ALL')}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                background: signalFilter === 'ALL' ? '#1e293b' : 'transparent',
                border: 'none',
                color: signalFilter === 'ALL' ? '#f8fafc' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              All Signals ({candidate.signals.length})
            </button>
            <button
              onClick={() => setSignalFilter('SUPPORTING')}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                background: signalFilter === 'SUPPORTING' ? '#14532d' : 'transparent',
                border: 'none',
                color: signalFilter === 'SUPPORTING' ? '#4ade80' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              Supporting (+{supportingCount})
            </button>
            <button
              onClick={() => setSignalFilter('CONTRADICTING')}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                background: signalFilter === 'CONTRADICTING' ? '#78350f' : 'transparent',
                border: 'none',
                color: signalFilter === 'CONTRADICTING' ? '#fbbf24' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              Contradicting / Limiting (-{contradictingCount})
            </button>
          </div>
        </div>

        {/* The Forensic Evidence Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d3d', color: '#8899aa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 12px', fontWeight: 800 }}>Signal / Forensic Vector</th>
                <th style={{ padding: '8px 12px', fontWeight: 800 }}>Category</th>
                <th style={{ padding: '8px 12px', fontWeight: 800 }}>Corroboration Vector</th>
                <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center' }}>Attribution Δ</th>
                <th style={{ padding: '8px 12px', fontWeight: 800 }}>Verification Subsystem</th>
                <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center' }}>Diagnostic Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map(sig => {
                const isPositive = sig.type === 'SUPPORTING'
                return (
                  <tr
                    key={sig.id}
                    style={{
                      borderBottom: '1px solid #16202c',
                      background: isPositive ? 'rgba(34, 197, 94, 0.02)' : 'rgba(245, 158, 11, 0.02)'
                    }}
                    className="hover:bg-slate-900/60"
                  >
                    {/* Signal Name */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: isPositive ? '#22c55e' : '#f59e0b', fontSize: 13, fontWeight: 800 }}>
                          {isPositive ? '✓' : '⚠'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{sig.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{sig.rawValue}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category Badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: '#1e293b',
                        color: '#94a3b8',
                        fontWeight: 700
                      }}>
                        {sig.category}
                      </span>
                    </td>

                    {/* Vector Description */}
                    <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: 11 }}>
                      {sig.vector}
                    </td>

                    {/* Attribution Delta */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isPositive ? '#4ade80' : '#fbbf24',
                        border: `1px solid ${isPositive ? '#22c55e40' : '#f59e0b40'}`
                      }}>
                        {isPositive ? `+${sig.impact}%` : `${sig.impact}%`}
                      </span>
                    </td>

                    {/* Verification Engine */}
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontSize: 11, fontFamily: 'monospace' }}>
                      {sig.verifiedBy}
                    </td>

                    {/* Granular Tooltip Diagnostic Button */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <Tooltip
                        position="left"
                        content={
                          <div style={{ maxWidth: 340, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2e42', paddingBottom: 4 }}>
                              <span style={{ fontWeight: 800, color: isPositive ? '#4ade80' : '#fbbf24' }}>
                                {sig.name}
                              </span>
                              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8' }}>{sig.category}</span>
                            </div>

                            <div style={{ fontSize: 11, color: '#e2e8f0' }}>
                              <strong style={{ color: '#8899aa' }}>Diagnostic Value:</strong> {sig.rawValue}
                            </div>

                            <div style={{ fontSize: 11, color: '#e2e8f0' }}>
                              <strong style={{ color: '#8899aa' }}>Algorithm:</strong> {sig.algorithm}
                            </div>

                            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
                              <strong style={{ color: '#8899aa' }}>Finding:</strong> {sig.diagnosticDetail}
                            </div>

                            <div style={{ fontSize: 10, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', padding: '4px 6px', borderRadius: 4, marginTop: 2 }}>
                              <strong>Epistemic Caveat:</strong> {sig.epistemicCaveat}
                            </div>
                          </div>
                        }
                      >
                        <button
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#38bdf8',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>🔍 Details</span>
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Epistemic Demarcation Legal Banner */}
      <div style={{
        background: '#080c10',
        border: '1px solid #1e2d3d',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚖️</span>
          <div style={{ fontSize: 11, color: '#cbd5e1' }}>
            <strong style={{ color: '#fbbf24' }}>Legal Scope:</strong> Earliest observed broadcast establishes temporal priority, not statutory copyright ownership. Formal chain-of-title review is required for court filings.
          </div>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: 4 }}>
          GOVERNANCE CLAUSE §4.2
        </span>
      </div>
    </div>
  )
}
