import { useState } from 'react'
import { useStore } from '../../store'
import type { DetectionResult } from '../../types'
import { D3ProvenanceTree } from '../charts/D3ProvenanceTree'

const DECISION_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'ALLOW':              { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', border: '#22c55e' },
  'ATTRIBUTION':        { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '#f59e0b' },
  'REVIEW REQUIRED':    { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '#6366f1' },
  'SUSPECT':            { bg: 'rgba(249,115,22,0.1)', color: '#f97316', border: '#f97316' },
  'TAKEDOWN':           { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: '#ef4444' },
  'EMERGENCY_TAKEDOWN': { bg: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '#dc2626' },
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: '#1e2d3d', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Signal({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const displayVal = invert ? 1 - value : value
  const color = displayVal < 0.35 ? '#22c55e' : displayVal < 0.65 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 140, fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <Bar value={displayVal} color={color} />
      <span style={{ fontSize: 11, fontFamily: 'monospace', color, width: 36, textAlign: 'right', fontWeight: 700 }}>
        {Math.round(displayVal * 100)}%
      </span>
    </div>
  )
}

interface Props { result: DetectionResult }

export function EvidenceModal({ result }: Props) {
  const { setShowEvidenceModal, setShowDMCAModal } = useStore()
  const [modalTab, setModalTab] = useState<'signals' | 'tree'>('signals')

  const ai_analysis = result?.ai_analysis || { decision: 'REVIEW REQUIRED', severity: 'MEDIUM', source: '', confidence: 0, reasoning_points: [], action: '' }
  const ds = DECISION_STYLES[ai_analysis.decision] || DECISION_STYLES['REVIEW REQUIRED']
  const ml = result?.ml ? {
    ...result.ml,
    signals: result.ml.signals || { spatial_diff: 0, color_diff: 0, frame_diff: 0, temporal_diff: 0, noise_score: 0, watermark_detected: 0 }
  } : {
    label: 'SUSPICIOUS',
    manipulation_probability: 0,
    trust_score: 0,
    confidence: 0,
    signals: { spatial_diff: 0, color_diff: 0, frame_diff: 0, temporal_diff: 0, noise_score: 0, watermark_detected: 0 }
  }

  const integrity = result?.integrity ? {
    ...result.integrity,
    signals: result.integrity.signals || { face_landmark: 0, lipsync: 0, noise_pattern: 0, jpeg_artifact: 0, edge_consistency: 0, temporal_mismatch: 0 }
  } : {
    score: 0,
    flags: [],
    signals: { face_landmark: 0, lipsync: 0, noise_pattern: 0, jpeg_artifact: 0, edge_consistency: 0, temporal_mismatch: 0 }
  }
  const trust = result?.trust || { trust_score: 0 }
  const propagation = result?.propagation || { urgency: 'low', velocity: 0, ppm: 0, indicator: 'STABLE' }
  const authorship = result?.authorship || { confidence: 0, origin_node: 'Source', embedding_distance: 0 }
  const artifact = result?.artifact
  const visualFindings = result?.visual_findings || result?.forensics?.visualFindings || []

  return (
    <div className="modal-backdrop" onClick={() => setShowEvidenceModal(false)}>
      <div
        onClick={e => e.stopPropagation()}
        className="vm-card"
        style={{
          width: 'min(920px, 95vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 0,
          border: `1px solid ${ds.border}`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: ds.bg,
          borderBottom: `1px solid ${ds.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '3px 8px', borderRadius: 4,
                background: ds.bg, color: ds.color, border: `1px solid ${ds.border}`,
                fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
              }}>
                {ai_analysis.decision}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: '#0d1117', color: '#94a3b8',
                border: '1px solid #1e2d3d', fontSize: 11, fontFamily: 'monospace',
              }}>
                {ai_analysis.severity}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>@{result.username}</span>
              <span style={{ color: '#64748b' }}> · {result.platform} · {result.caption || result.scenario}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#080c10', padding: 3, borderRadius: 6, border: '1px solid #1e2d3d' }}>
              <button
                onClick={() => setModalTab('signals')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  background: modalTab === 'signals' ? '#1e293b' : 'transparent',
                  border: modalTab === 'signals' ? '1px solid #38bdf8' : 'none',
                  color: modalTab === 'signals' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                🔬 Forensics
              </button>
              <button
                onClick={() => setModalTab('tree')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  background: modalTab === 'tree' ? '#1e293b' : 'transparent',
                  border: modalTab === 'tree' ? '1px solid #38bdf8' : 'none',
                  color: modalTab === 'tree' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                🌳 Provenance Tree
              </button>
            </div>

            <button
              onClick={() => setShowEvidenceModal(false)}
              style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {modalTab === 'tree' ? (
            <div style={{ marginTop: 4 }}>
              <D3ProvenanceTree result={result} height={460} />
            </div>
          ) : (
            <>
              {/* Media Artifact details if available */}
              {artifact && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: '#0d1117',
                  border: '1px solid #1e2d3d',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16
                }}>
                  {(artifact.fileUrl || artifact.dataUrl) && (
                    <img
                      src={artifact.fileUrl || artifact.dataUrl}
                      alt="Artifact"
                      referrerPolicy="no-referrer"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #334155' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                      {artifact.filename}
                    </div>
                    <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'monospace', marginTop: 2 }}>
                      {artifact.dimensions ? `${artifact.dimensions.width}×${artifact.dimensions.height}px • ` : ''}
                      SHA-256: {artifact.sha256?.slice(0, 16)}...
                    </div>
                    {visualFindings.length > 0 && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        {visualFindings[0]}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Similarity',    value: result.similarity,      color: '#00d4ff'  },
                  { label: 'Integrity',     value: integrity.score,         color: '#22c55e'  },
                  { label: 'Trust Score',   value: trust.trust_score,       color: '#f59e0b'  },
                  { label: 'AI Confidence', value: ai_analysis.confidence,  color: '#a855f7'  },
                ].map(item => (
                  <div key={item.label} style={{
                    background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 6, padding: '8px 12px',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                      {Math.round(item.value * 100)}%
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signals Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Signal Metrics
                  </div>
                  <Signal label="Spatial Discrepancy" value={ml.signals.spatial_diff} />
                  <Signal label="Color Variance"      value={ml.signals.color_diff} />
                  <Signal label="Frame Edit Rate"     value={ml.signals.frame_diff} />
                  <Signal label="Noise Pattern"       value={ml.signals.noise_score} />
                </div>

                <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Forensic Verification
                  </div>
                  <Signal label="Face Landmark"       value={integrity.signals.face_landmark} />
                  <Signal label="Lip-Sync Match"      value={integrity.signals.lipsync} />
                  <Signal label="Sensor Resampling"   value={integrity.signals.noise_pattern} />
                  <Signal label="JPEG Compression"    value={integrity.signals.jpeg_artifact} />
                </div>
              </div>

              {/* Reasoning & Recommended Action */}
              <div style={{
                background: '#0d1117', border: `1px solid ${ds.border}`,
                borderRadius: 8, padding: 14, marginTop: 14,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                  Analysis & Action
                </div>
                {ai_analysis.reasoning_points.slice(0, 3).map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 12, color: '#cbd5e1' }}>
                    <span style={{ color: ds.color }}>▸</span>
                    <span>{point}</span>
                  </div>
                ))}
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: ds.bg, borderRadius: 6,
                  fontSize: 12, color: ds.color, fontWeight: 700
                }}>
                  Recommended Action: {ai_analysis.action}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #1e2d3d',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button className="vm-btn vm-btn-ghost" onClick={() => setShowEvidenceModal(false)}>
            Close
          </button>
          {ai_analysis.dmca_needed && (
            <button
              className="vm-btn vm-btn-danger"
              onClick={() => {
                setShowEvidenceModal(false)
                setShowDMCAModal(true)
              }}
            >
              📋 Generate DMCA Notice
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
