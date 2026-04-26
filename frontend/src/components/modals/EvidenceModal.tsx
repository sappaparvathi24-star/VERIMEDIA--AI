import { useStore } from '../../store'
import type { DetectionResult } from '../../types'

const DECISION_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'ALLOW':             { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', border: '#22c55e' },
  'ATTRIBUTION':       { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '#f59e0b' },
  'REVIEW REQUIRED':   { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '#6366f1' },
  'SUSPECT':           { bg: 'rgba(249,115,22,0.1)', color: '#f97316', border: '#f97316' },
  'TAKEDOWN':          { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: '#ef4444' },
  'EMERGENCY_TAKEDOWN':{ bg: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '#dc2626' },
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: '#1e2d3d', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
    </div>
  )
}

function Signal({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const displayVal = invert ? 1 - value : value
  const color = displayVal < 0.35 ? '#22c55e' : displayVal < 0.65 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 160, fontSize: 11, color: '#8899aa', flexShrink: 0 }}>{label}</span>
      <Bar value={displayVal} color={color} />
      <span style={{ fontSize: 10, fontFamily: 'monospace', color, width: 36, textAlign: 'right' }}>
        {Math.round(displayVal * 100)}%
      </span>
    </div>
  )
}

interface Props { result: DetectionResult }

export function EvidenceModal({ result }: Props) {
  const { setShowEvidenceModal, setShowDMCAModal } = useStore()
  const ds = DECISION_STYLES[result.ai_analysis.decision] || DECISION_STYLES['REVIEW REQUIRED']
  const { ai_analysis, ml, integrity, trust, propagation, authorship } = result

  return (
    <div className="modal-backdrop" onClick={() => setShowEvidenceModal(false)}>
      <div
        onClick={e => e.stopPropagation()}
        className="vm-card"
        style={{
          width: 'min(900px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 0,
          border: `1px solid ${ds.border}`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: ds.bg,
          borderBottom: `1px solid ${ds.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8899aa' }}>
                {result.job_id.slice(0, 8).toUpperCase()}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 4,
                background: ds.bg, color: ds.color, border: `1px solid ${ds.border}`,
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em',
              }}>
                {ai_analysis.decision}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 4,
                background: '#0d1117', color: '#8899aa',
                border: '1px solid #1e2d3d', fontSize: 11, fontFamily: 'monospace',
              }}>
                {ai_analysis.severity}
              </span>
              {ai_analysis.source === 'claude' && (
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                  border: '1px solid #a855f7', fontSize: 10, fontFamily: 'monospace',
                }}>
                  ✦ Claude AI
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 6 }}>
              <span style={{ color: '#00d4ff' }}>@{result.username}</span>
              <span style={{ color: '#4a5568' }}> · </span>
              <span style={{ color: '#8899aa' }}>{result.platform}</span>
              <span style={{ color: '#4a5568' }}> · </span>
              <span style={{ color: '#8899aa' }}>{result.content_type} / {result.scenario}</span>
            </div>
          </div>
          <button
            onClick={() => setShowEvidenceModal(false)}
            style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Score strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
          }}>
            {[
              { label: 'Similarity',   value: result.similarity,      color: '#00d4ff'  },
              { label: 'Integrity',    value: integrity.score,         color: '#22c55e'  },
              { label: 'Trust Score',  value: trust.trust_score,       color: '#f59e0b'  },
              { label: 'AI Confidence',value: ai_analysis.confidence,  color: '#a855f7'  },
            ].map(item => (
              <div key={item.label} style={{
                background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 12,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                  {Math.round(item.value * 100)}%
                </div>
                <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* ML Signals */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
              <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                ML Signals — <span style={{ color: ml.label === 'TAMPERED' ? '#ef4444' : ml.label === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e' }}>{ml.label}</span>
              </p>
              <Signal label="Spatial Diff"   value={ml.signals.spatial_diff} />
              <Signal label="Color Shift"    value={ml.signals.color_diff} />
              <Signal label="Frame Variance" value={ml.signals.frame_diff} />
              <Signal label="Temporal Diff"  value={ml.signals.temporal_diff} />
              <Signal label="Noise Score"    value={ml.signals.noise_score} />
              <Signal label="Watermark"      value={ml.signals.watermark_detected} invert />
            </div>

            {/* Integrity Signals */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
              <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Integrity Analysis — {integrity.flags.length} flag{integrity.flags.length !== 1 ? 's' : ''}
              </p>
              <Signal label="Face Landmark"   value={integrity.signals.face_landmark} />
              <Signal label="Lip-sync"        value={integrity.signals.lipsync} />
              <Signal label="Noise Pattern"   value={integrity.signals.noise_pattern} />
              <Signal label="JPEG Artifact"   value={integrity.signals.jpeg_artifact} />
              <Signal label="Edge Consist."   value={integrity.signals.edge_consistency} invert />
              <Signal label="Temporal Mismatch" value={integrity.signals.temporal_mismatch} />
            </div>
          </div>

          {/* AI Reasoning */}
          <div style={{
            background: '#0d1117', border: `1px solid ${ds.border}`,
            borderRadius: 8, padding: 16, marginTop: 16,
          }}>
            <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              AI Reasoning Points
            </p>
            {ai_analysis.reasoning_points.map((point, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{ color: ds.color, fontSize: 12, marginTop: 1 }}>▸</span>
                <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: ds.bg, borderRadius: 6, borderLeft: `3px solid ${ds.color}`,
            }}>
              <p style={{ fontSize: 12, color: ds.color, fontWeight: 600 }}>⚡ {ai_analysis.action}</p>
            </div>
          </div>

          {/* Propagation + Authorship row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Viral Propagation
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: propagation.urgency === 'critical' ? '#dc2626' : propagation.urgency === 'high' ? '#ef4444' : propagation.urgency === 'medium' ? '#f59e0b' : '#22c55e', fontFamily: 'monospace' }}>
                {propagation.ppm} ppm
              </p>
              <p style={{ fontSize: 11, color: '#8899aa', marginTop: 4 }}>
                {propagation.indicator} · urgency: <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{propagation.urgency.toUpperCase()}</span>
              </p>
            </div>
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Origin Authorship
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#00d4ff', fontFamily: 'monospace' }}>
                {Math.round(authorship.confidence * 100)}%
              </p>
              <p style={{ fontSize: 11, color: '#8899aa', marginTop: 4 }}>
                {authorship.origin_node} · Δ{authorship.embedding_distance.toFixed(3)}
              </p>
            </div>
          </div>

          {/* Fingerprint */}
          <div style={{
            marginTop: 16, background: '#080c10', border: '1px solid #1e2d3d',
            borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace',
          }}>
            <span style={{ fontSize: 10, color: '#4a5568' }}>FINGERPRINT: </span>
            <span style={{ fontSize: 11, color: '#00d4ff' }}>{result.fingerprint_hash.toUpperCase()}</span>
            <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 16 }}>PROCESS: </span>
            <span style={{ fontSize: 11, color: '#22c55e' }}>{result.processing_ms.toFixed(0)}ms</span>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '14px 24px',
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
              📋 File DMCA Notice
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
