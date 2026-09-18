import { useStore } from '../../store'

const SIGNALS = [
  { key: 'jpeg_artifact',      label: 'JPEG Artifact',       invert: false },
  { key: 'noise_pattern',      label: 'Noise Pattern',       invert: false },
  { key: 'edge_consistency',   label: 'Edge Consistency',    invert: true  },
  { key: 'metadata_coherence', label: 'Metadata Coherence',  invert: true  },
  { key: 'color_histogram',    label: 'Color Histogram',     invert: false },
  { key: 'face_landmark',      label: 'Face Landmark',       invert: false },
  { key: 'lipsync',            label: 'Lip-sync',            invert: false },
  { key: 'temporal_mismatch',  label: 'Temporal Mismatch',   invert: false },
  { key: 'watermark_presence', label: 'Watermark Presence',  invert: true  },
]

function getColor(anomaly: number): string {
  if (anomaly < 0.25) return '#22c55e'
  if (anomaly < 0.50) return '#f59e0b'
  if (anomaly < 0.70) return '#f97316'
  return '#ef4444'
}

export function ForensicPanel() {
  const { currentResult } = useStore()

  if (!currentResult) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: '#4a5568' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <p style={{ fontSize: 12 }}>No detection data</p>
          <p style={{ fontSize: 11 }}>Run a detection to see forensic analysis</p>
        </div>
      </div>
    )
  }

  const sigs = currentResult.integrity.signals
  const score = currentResult.integrity.score
  const flags = currentResult.integrity.flags

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          9-Signal Forensic Analysis
        </span>
        <span style={{
          padding: '3px 10px', borderRadius: 4,
          background: score > 0.7 ? 'rgba(34,197,94,0.1)' : score > 0.4 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          color: score > 0.7 ? '#22c55e' : score > 0.4 ? '#f59e0b' : '#ef4444',
          fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
        }}>
          {Math.round(score * 100)}% CLEAN
        </span>
      </div>

      {/* Heatmap grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        {SIGNALS.map(sig => {
         const raw = (sigs as unknown as Record<string, number>)[sig.key] ?? 0
          const anomaly = sig.invert ? 1 - raw : raw
          const color = getColor(anomaly)
          const pct = Math.round(anomaly * 100)

          return (
            <div key={sig.key} style={{
              background: '#0d1117',
              border: `1px solid ${anomaly > 0.65 ? color + '66' : '#1e2d3d'}`,
              borderRadius: 6,
              padding: '10px 12px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Fill bg */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `${color}08`,
                width: `${pct}%`,
                transition: 'width 0.8s ease',
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, color: '#8899aa', marginBottom: 4, lineHeight: 1.2 }}>
                  {sig.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'monospace' }}>
                  {pct}%
                </div>
                <div style={{ height: 3, background: '#1e2d3d', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Active Flags ({flags.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {flags.map((flag, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 5,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <span style={{ color: '#ef4444', fontSize: 10 }}>⚠</span>
                <span style={{ fontSize: 11, color: '#f87171' }}>{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ML result */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: 14,
      }}>
        <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          ML Classifier Result
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Label',       value: currentResult.ml.label,
              color: currentResult.ml.label === 'TAMPERED' ? '#ef4444' : currentResult.ml.label === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e' },
            { label: 'Manip. Prob', value: `${Math.round(currentResult.ml.manipulation_probability * 100)}%`, color: '#f97316' },
            { label: 'Trust Score', value: `${Math.round(currentResult.ml.trust_score * 100)}%`,             color: '#22c55e' },
            { label: 'Confidence',  value: `${Math.round(currentResult.ml.confidence * 100)}%`,              color: '#00d4ff' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 10, color: '#8899aa' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
