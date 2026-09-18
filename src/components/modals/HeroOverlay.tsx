import { useStore } from '../../store'

const SCENARIOS = [
  { key: 'normal',        label: 'Normal Share',       color: '#22c55e', desc: 'Legitimate licensed content' },
  { key: 'deepfake',      label: 'Deepfake',           color: '#dc2626', desc: 'AI face synthesis' },
  { key: 'manipulated',   label: 'Manipulation',       color: '#ef4444', desc: 'Heavy modification' },
  { key: 'adversarial',   label: 'Adversarial Noise',  color: '#a855f7', desc: 'ML evasion attack' },
  { key: 'news',          label: 'News Attribution',   color: '#f59e0b', desc: 'Missing source credit' },
  { key: 'crop',          label: 'Crop Attack',        color: '#f97316', desc: 'Watermark removal' },
  { key: 'blur',          label: 'Blur/Filter',        color: '#6366f1', desc: 'Visual obfuscation' },
  { key: 'scam',          label: 'Scam Repost',        color: '#ef4444', desc: 'Fraudulent reupload' },
  { key: 'education',     label: 'Education Fair Use', color: '#22c55e', desc: 'Legitimate commentary' },
  { key: 'insufficient',  label: 'Low Evidence',       color: '#6366f1', desc: 'Ambiguous signals' },
]

export function HeroOverlay() {
  const { setShowHeroOverlay } = useStore()

  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <div
        className="vm-card"
        style={{
          width: 'min(820px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '36px',
          border: '1px solid #2a3f55',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d4ff22, #0ea5e922)',
              border: '2px solid #00d4ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#00d4ff', letterSpacing: '-0.02em' }}>
                VeriMedia AI
              </h1>
              <p style={{ fontSize: 11, color: '#8899aa', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
                DETECTION · VERIFICATION · ENFORCEMENT · v23
              </p>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#cbd5e1', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            AI-powered media intelligence platform. Detect unauthorized content, analyze deepfakes,
            and automate DMCA enforcement across social platforms in real time.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12, marginBottom: 28,
        }}>
          {[
            { label: 'Platforms', value: '6', color: '#00d4ff' },
            { label: 'ML Signals', value: '9', color: '#22c55e' },
            { label: 'Detection', value: '1.4s', color: '#f59e0b' },
            { label: 'Accuracy', value: '94%', color: '#a855f7' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#0d1117', border: '1px solid #1e2d3d',
              borderRadius: 8, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Scenarios */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: '#8899aa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Detection Scenarios
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {SCENARIOS.map(sc => (
              <div key={sc.key} style={{
                background: '#0d1117', border: '1px solid #1e2d3d',
                borderRadius: 6, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{sc.label}</div>
                  <div style={{ fontSize: 10, color: '#8899aa' }}>{sc.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="vm-btn vm-btn-primary"
            style={{ padding: '12px 32px', fontSize: 14 }}
            onClick={() => setShowHeroOverlay(false)}
          >
            🚀 Launch Platform
          </button>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="vm-btn vm-btn-ghost"
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            📖 API Docs
          </a>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#4a5568' }}>
          Powered by Claude AI · AES-256 Watermarking · pgvector Embedding Search
        </p>
      </div>
    </div>
  )
}
