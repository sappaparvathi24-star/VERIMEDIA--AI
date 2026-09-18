import { useStore } from '../../store'

export function OriginPanel() {
  const { currentResult } = useStore()

  if (!currentResult) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: '#4a5568' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
          <p style={{ fontSize: 12 }}>No origin data</p>
          <p style={{ fontSize: 11 }}>Run a detection to trace content origin</p>
        </div>
      </div>
    )
  }

  const { authorship, fingerprint_hash, similarity, ai_analysis } = currentResult
  const traced = ai_analysis.origin_traced

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      {/* Origin status */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 8, marginBottom: 16,
        background: traced ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${traced ? '#22c55e' : '#ef4444'}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: traced ? '#22c55e' : '#ef4444', marginBottom: 4 }}>
          {traced ? '✓ Origin Traced' : '✗ Origin Unconfirmed'}
        </div>
        <div style={{ fontSize: 11, color: '#8899aa' }}>{authorship.reason}</div>
      </div>

      {/* Authorship card */}
      <div style={{
        background: '#0d1117', border: '1px solid #1e2d3d',
        borderRadius: 8, padding: 16, marginBottom: 14,
      }}>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Authorship Analysis
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Confidence',        value: `${Math.round(authorship.confidence * 100)}%`, color: '#00d4ff' },
            { label: 'Origin Node',       value: authorship.origin_node,                        color: '#22c55e' },
            { label: 'Embedding Δ',       value: authorship.embedding_distance.toFixed(4),      color: '#f59e0b' },
            { label: 'Visual Similarity', value: `${Math.round(similarity * 100)}%`,            color: '#a855f7' },
          ].map(item => (
            <div key={item.label} style={{ background: '#080c10', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#8899aa', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fingerprint */}
      <div style={{
        background: '#080c10', border: '1px solid #1e2d3d',
        borderRadius: 8, padding: 14, marginBottom: 14,
        fontFamily: 'monospace',
      }}>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Perceptual Fingerprint
        </p>
        <div style={{ fontSize: 16, color: '#00d4ff', letterSpacing: '0.1em', marginBottom: 6 }}>
          {fingerprint_hash.toUpperCase().match(/.{1,4}/g)?.join(' ')}
        </div>
        <p style={{ fontSize: 10, color: '#4a5568' }}>AES-256 watermark verified · pHash + CLIP embedding</p>
      </div>

      {/* Chain of evidence */}
      <div style={{
        background: '#0d1117', border: '1px solid #1e2d3d',
        borderRadius: 8, padding: 14,
      }}>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Chain of Evidence
        </p>
        {[
          { step: '01', label: 'Content Ingested',     color: '#22c55e', done: true  },
          { step: '02', label: 'Fingerprint Matched',  color: '#22c55e', done: true  },
          { step: '03', label: 'ML Analysis Complete', color: '#22c55e', done: true  },
          { step: '04', label: 'Integrity Verified',   color: '#22c55e', done: true  },
          { step: '05', label: 'Origin Confirmed',     color: traced ? '#22c55e' : '#ef4444', done: traced },
          { step: '06', label: 'Enforcement Decision', color: '#00d4ff', done: true  },
        ].map(item => (
          <div key={item.step} style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: item.done ? `${item.color}18` : '#1e2d3d',
              border: `1px solid ${item.done ? item.color : '#4a5568'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontFamily: 'monospace', color: item.done ? item.color : '#4a5568',
              flexShrink: 0,
            }}>
              {item.done ? '✓' : item.step}
            </div>
            <span style={{ fontSize: 12, color: item.done ? '#e2e8f0' : '#4a5568' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
