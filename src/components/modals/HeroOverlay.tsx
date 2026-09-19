import { useStore } from '../../store'

const FIVE_ENGINES_OVERVIEW = [
  {
    num: 'Engine 1',
    name: 'Media Forensics',
    icon: '🔬',
    color: '#22c55e',
    input: 'Image / Video / Audio',
    produces: 'SHA-256, Perceptual Hashes, EXIF/Metadata, OCR, ELA, Resampling, Face Landmarks, AV-Sync',
    principle: 'No single signal is ground truth; ensemble multi-signal corroboration builds certainty.'
  },
  {
    num: 'Engine 2',
    name: 'Discovery Intelligence',
    icon: '🌐',
    color: '#00d4ff',
    input: 'Target URL / Media Hash / Query',
    produces: 'Provider-agnostic Discovery Orchestrator, normalized observation streams, Sybil defense',
    principle: 'Multi-source decoupled architecture abstracting YouTube, Reddit, X, TikTok, Web crawlers.'
  },
  {
    num: 'Engine 3 (Hero)',
    name: 'Provenance & Origin',
    icon: '🌳',
    color: '#38bdf8',
    input: 'Observation Pool & Perceptual Matches',
    produces: 'D3 Lineage Tree, Transformation Pipeline (Re-encode, Crop, Caption) & Earliest Source ID',
    principle: 'Epistemic Demarcation: Earliest observed timestamp ≠ proven legal ownership.'
  },
  {
    num: 'Engine 4',
    name: 'Propagation Intelligence',
    icon: '📡',
    color: '#a855f7',
    input: 'Platform Timestamps & Reposts',
    produces: 'Content Genealogy Graph, Viral Velocity (shares/min), Platform Propagation Vectors',
    principle: 'Turns flat search results into multi-generational viral lineage trees.'
  },
  {
    num: 'Engine 5',
    name: 'Evidence Reasoning',
    icon: '⚖️',
    color: '#fbbf24',
    input: 'Combined Forensic, Discovery & Provenance Findings',
    produces: 'Explainable AI Reasoning Dossier, Supporting/Contradicting Evidence, IBM AI Governance Audit',
    principle: 'Transparent calculus with epistemic boundaries and verifiable audit trail.'
  },
]

export function HeroOverlay() {
  const { setShowHeroOverlay, setActiveTab } = useStore()

  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <div
        className="vm-card"
        style={{
          width: 'min(920px, 95vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: '32px',
          border: '1px solid #2a3f55',
          position: 'relative',
          background: '#0d1117'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #00d4ff22, #0ea5e922)',
              border: '2px solid #00d4ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#00d4ff', letterSpacing: '-0.02em', margin: 0 }}>
                VeriMedia AI Engine Architecture
              </h1>
              <p style={{ fontSize: 11, color: '#8899aa', fontFamily: 'monospace', letterSpacing: '0.15em', margin: '4px 0 0 0' }}>
                THE FIVE MAJOR ENGINES · EXPLAINABLE AI · GOVERNANCE READY
              </p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#cbd5e1', maxWidth: 640, margin: '0 auto', lineHeight: 1.5 }}>
            VeriMedia operates as five coordinated, provider-agnostic intelligence engines delivering forensic proof, origin attribution, propagation genealogy, and explainable AI reasoning.
          </p>
        </div>

        {/* 5 Engines Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {FIVE_ENGINES_OVERVIEW.map(engine => (
            <div
              key={engine.num}
              style={{
                background: '#080c10',
                border: '1px solid #1e2d3d',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: '180px 1fr auto',
                gap: 16,
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{engine.icon}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: engine.color }}>{engine.num}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>{engine.name}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  <strong style={{ color: '#8899aa' }}>Produces:</strong> {engine.produces}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>
                  💡 {engine.principle}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowHeroOverlay(false)
                  if (engine.name.includes('Forensics')) setActiveTab('forensic')
                  else if (engine.name.includes('Discovery')) setActiveTab('discovery')
                  else if (engine.name.includes('Provenance')) setActiveTab('origin')
                  else if (engine.name.includes('Propagation')) setActiveTab('propagation')
                  else if (engine.name.includes('Reasoning')) setActiveTab('reasoning')
                }}
                style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#38bdf8',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Launch Engine →
              </button>
            </div>
          ))}
        </div>

        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setShowHeroOverlay(false)}
            style={{
              background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              color: '#080c10',
              fontWeight: 800,
              fontSize: 13,
              padding: '10px 32px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Enter VeriMedia Workspace
          </button>
        </div>
      </div>
    </div>
  )
}
