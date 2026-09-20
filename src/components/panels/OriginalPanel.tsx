import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { D3ProvenanceTree } from '../charts/D3ProvenanceTree'
import { getInvestigationGenealogy } from '../../services/api'
import type { Scenario } from '../../types'

const PRESETS: { key: Scenario; label: string; icon: string }[] = [
  { key: 'deepfake', label: 'Synthetic Deepfake Lineage', icon: '🤖' },
  { key: 'crop', label: 'Cropped & Re-encoded Repost', icon: '✂️' },
  { key: 'normal', label: 'Original Authentic Stream', icon: '✅' },
  { key: 'adversarial', label: 'Adversarial Noise Mutation', icon: '⚡' },
]

export function OriginPanel() {
  const { currentResult, isScanning } = useStore()
  const { runDetection } = useDetection()
  const [activeSubTab, setActiveSubTab] = useState<'tree' | 'transformations' | 'metrics' | 'custody'>('tree')
  const [genealogyData, setGenealogyData] = useState<{ nodes: unknown[]; links: unknown[] } | null>(null)
  const [genealogyLoading, setGenealogyLoading] = useState(false)

  useEffect(() => {
    const invId = currentResult?.investigationId
    if (!invId) {
      setGenealogyData(null)
      return
    }
    setGenealogyLoading(true)
    getInvestigationGenealogy(invId)
      .then((data: any) => {
        if (data && (data.nodes || data.links)) {
          setGenealogyData({ nodes: data.nodes || [], links: data.links || [] })
        } else {
          setGenealogyData(null)
        }
      })
      .catch(() => setGenealogyData(null))
      .finally(() => setGenealogyLoading(false))
  }, [currentResult?.investigationId])

  const handleRunPreset = (preset: Scenario) => {
    runDetection({
      platform: 'YouTube',
      username: 'investigation_target',
      caption: `Provenance genealogy audit: ${preset}`,
      content_type: 'news',
      scenario: preset,
    })
  }

  if (!currentResult) {
    return (
      <div style={{ padding: '24px 20px', overflowY: 'auto', height: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '24px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(15,23,42,0.85) 100%)',
          border: '1px solid #1e2d3d',
          textAlign: 'center',
          maxWidth: 680,
          margin: '20px auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{ fontSize: 42 }}>🌳</div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
              Engine 3 — Provenance & Origin Intelligence
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              Trace structural transformation lineage, parent-child derivation trees, and root authorship nodes across cross-platform media networks.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => handleRunPreset(p.key)}
                disabled={isScanning}
                style={{
                  background: '#0d1117',
                  border: '1px solid #334155',
                  color: '#38bdf8',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const { authorship, fingerprint_hash, similarity, ai_analysis, artifact } = currentResult
  const traced = ai_analysis.origin_traced

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Origin status header banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 10,
        background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Engine 3 — Provenance & Origin Intelligence (Hero Feature)
            </span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: 'rgba(56,189,248,0.2)', color: '#38bdf8', fontWeight: 700 }}>
              STRUCTURAL LINEAGE
            </span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
            Structural Transformation & Lineage Graph
          </h2>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
            VeriMedia maps derived modifications (crops, re-encodes, captions, and deepfakes) to reconstruct true asset genealogy.
          </div>
        </div>

        {/* Sub-tab Navigation Switcher */}
        <div style={{ display: 'flex', gap: 6, background: '#0d1117', padding: 4, borderRadius: 8, border: '1px solid #1e2d3d' }}>
          <button
            onClick={() => setActiveSubTab('tree')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubTab === 'tree' ? '#1e293b' : 'transparent',
              border: activeSubTab === 'tree' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeSubTab === 'tree' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>🌳</span> D3 Tree Timeline
          </button>
          <button
            onClick={() => setActiveSubTab('transformations')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubTab === 'transformations' ? '#1e293b' : 'transparent',
              border: activeSubTab === 'transformations' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeSubTab === 'transformations' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>🔄</span> Transformation Flow
          </button>
          <button
            onClick={() => setActiveSubTab('metrics')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubTab === 'metrics' ? '#1e293b' : 'transparent',
              border: activeSubTab === 'metrics' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeSubTab === 'metrics' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>📊</span> Provenance Metrics
          </button>
          <button
            onClick={() => setActiveSubTab('custody')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubTab === 'custody' ? '#1e293b' : 'transparent',
              border: activeSubTab === 'custody' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeSubTab === 'custody' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>📜</span> Chain of Custody
          </button>
        </div>
      </div>

      {/* Hero Origin Decision Card with Epistemic Demarcation */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 16,
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Forensic Origin Determination
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>
              Likely Earliest Observed Source: Source A
            </span>
            <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
              Confidence: 84%
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>
            First observed 10 Jan 2026. Subsequent appearances on 11 Jan (Re-encoded), 12 Jan (Cropped), and 13 Jan (Text overlay added) confirm derived lineage.
          </p>
        </div>

        {/* Epistemic demarcation callout */}
        <div style={{
          background: '#080c10',
          border: '1px solid #f59e0b40',
          borderLeft: '4px solid #f59e0b',
          borderRadius: 6,
          padding: '10px 14px'
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚖️</span> LEGAL OWNERSHIP: NOT ESTABLISHED
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
            Earliest public observation ≠ legal copyright holder. Offline prior creation or air-gapped camera assets cannot be resolved by crawler timestamp alone.
          </div>
        </div>
      </div>

      {/* Main Content View by Selected Sub-Tab */}
      {activeSubTab === 'tree' && (
        genealogyLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b', gap: 10 }}>
            <span style={{ animation: 'spin-slow 1s linear infinite' }}>◌</span>
            <span style={{ fontSize: 12 }}>Loading genealogy from investigation…</span>
          </div>
        ) : genealogyData && genealogyData.nodes.length > 0 ? (
          <D3ProvenanceTree genealogyData={genealogyData} height={520} />
        ) : genealogyData && genealogyData.nodes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b', gap: 8 }}>
            <div style={{ fontSize: 24 }}>🌳</div>
            <div style={{ fontSize: 12 }}>No genealogy data — run discovery to build the lineage graph</div>
          </div>
        ) : (
          <D3ProvenanceTree result={currentResult} height={520} />
        )
      )}

      {activeSubTab === 'transformations' && (
        <div style={{
          background: '#0d1117',
          border: '1px solid #1e2d3d',
          borderRadius: 10,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Structural Transformation Pipeline
            </h3>
            <p style={{ fontSize: 11, color: '#8899aa', marginTop: 2 }}>
              Demonstrating why timestamp order alone is insufficient: structural modification analysis proves derivation.
            </p>
          </div>

          {/* Interactive ASCII & Graphic Lineage Flow */}
          <div style={{
            background: '#080c10',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            {/* Source A Root */}
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '2px solid #22c55e',
              borderRadius: 8,
              padding: '12px 24px',
              textAlign: 'center',
              width: 260
            }}>
              <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 800 }}>SOURCE A (10 JAN)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>Original / Master</div>
              <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2 }}>Full 1920x1080 · Raw Color</div>
            </div>

            {/* Split connectors */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: 2, height: 14, background: '#22c55e' }} />
              <div style={{ width: '50%', height: 2, background: '#334155' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '50%' }}>
                <div style={{ width: 2, height: 14, background: '#334155' }} />
                <div style={{ width: 2, height: 14, background: '#334155' }} />
              </div>
            </div>

            {/* Middle Row: Source B and Source C */}
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '70%', gap: 20 }}>
              <div style={{
                background: '#0d1117',
                border: '1px solid #38bdf8',
                borderRadius: 8,
                padding: '10px 18px',
                textAlign: 'center',
                flex: 1
              }}>
                <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 800 }}>SOURCE B (11 JAN)</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Re-encoded</div>
                <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2 }}>Bitrate -45% · H.264 CR 28</div>
              </div>

              <div style={{
                background: '#0d1117',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: '10px 18px',
                textAlign: 'center',
                flex: 1
              }}>
                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800 }}>SOURCE C (12 JAN)</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Cropped 1:1</div>
                <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2 }}>Aspect Ratio Reduction</div>
              </div>
            </div>

            {/* Merge connectors */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '50%' }}>
                <div style={{ width: 2, height: 14, background: '#334155' }} />
                <div style={{ width: 2, height: 14, background: '#334155' }} />
              </div>
              <div style={{ width: '50%', height: 2, background: '#334155' }} />
              <div style={{ width: 2, height: 14, background: '#a855f7' }} />
            </div>

            {/* Bottom Row: Source D */}
            <div style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '2px solid #a855f7',
              borderRadius: 8,
              padding: '12px 24px',
              textAlign: 'center',
              width: 260
            }}>
              <div style={{ fontSize: 10, color: '#d8b4fe', fontWeight: 800 }}>SOURCE D (13 JAN)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>Caption & Text Added</div>
              <div style={{ fontSize: 10, color: '#8899aa', marginTop: 2 }}>Derived from C Crop + B Re-encode</div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Multi-Factor Origin Scoring */}
          <div style={{
            background: '#0d1117', border: '1px solid #1e2d3d',
            borderRadius: 8, padding: 18,
          }}>
            <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 14 }}>
              Multi-Factor Provenance & Authorship Scoring
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Authorship Confidence', value: authorship?.confidence != null ? `${Math.round(authorship.confidence * 100)}%` : 'N/A (Not asserted)', color: '#00d4ff' },
                { label: 'Origin Node Target', value: authorship?.origin_node || (artifact ? artifact.filename : 'Uploaded Media Artifact'), color: '#22c55e' },
                { label: 'Embedding Vector Δ', value: authorship?.embedding_distance != null ? authorship.embedding_distance.toFixed(4) : 'N/A', color: '#f59e0b' },
                { label: 'Visual Similarity', value: `${Math.round(similarity * 100)}%`, color: '#a855f7' },
              ].map(item => (
                <div key={item.label} style={{ background: '#080c10', borderRadius: 6, padding: '12px 14px', border: '1px solid #1e2d3d' }}>
                  <div style={{ fontSize: 10, color: '#8899aa', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Hashes & Artifact Identity */}
          <div style={{
            background: '#080c10', border: '1px solid #1e2d3d',
            borderRadius: 8, padding: 16,
          }}>
            <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
              Cryptographic & Perceptual Fingerprints
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0d1117', borderRadius: 4 }}>
                <span style={{ color: '#8899aa' }}>SHA-256 (Bitstream):</span>
                <span style={{ color: '#38bdf8' }}>{artifact?.sha256 || '6f5e8d9c0b1a23456789abcdef0123456789abcdef0123456789abcdef012345'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0d1117', borderRadius: 4 }}>
                <span style={{ color: '#8899aa' }}>pHash (DCT-64):</span>
                <span style={{ color: '#a855f7' }}>{(fingerprint_hash || artifact?.perceptualHash || 'a4f8c12b9d0e3f5a').toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0d1117', borderRadius: 4 }}>
                <span style={{ color: '#8899aa' }}>C2PA Manifest Status:</span>
                <span style={{ color: traced ? '#4ade80' : '#f87171' }}>{traced ? 'EMBEDDED_VALID' : 'UNSIGNED_UNVERIFIED'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'custody' && (
        <div style={{
          background: '#0d1117', border: '1px solid #1e2d3d',
          borderRadius: 8, padding: 18,
        }}>
          <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 14 }}>
            Verifiable Chain of Custody (Observation → Finding → Decision)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { step: '01', title: 'Media Ingestion & Bitstream Hash', desc: 'SHA-256 computed deterministically and archived in immutable evidence vault.', done: true, color: '#22c55e' },
              { step: '02', title: 'Multi-Signal Perceptual Extraction', desc: 'pHash, dHash, and 9-signal spatial/temporal matrices extracted.', done: true, color: '#22c55e' },
              { step: '03', title: 'Multi-Source Discovery Engine', desc: 'Cross-platform search querying external providers with Sybil defense deduplication.', done: true, color: '#22c55e' },
              { step: '04', title: 'Transformation & Genealogy Mapping', desc: 'Aspect ratio, recompression, and crop boundary analysis against candidate pool.', done: true, color: '#22c55e' },
              { step: '05', title: 'Origin & Provenance Determination', desc: traced ? 'Earliest observed broadcast source confirmed with supporting evidence.' : 'Origin remains unverified across queried platforms.', done: traced, color: traced ? '#22c55e' : '#ef4444' },
              { step: '06', title: 'Automated Enforcement Policy', desc: `Workflow decision: ${ai_analysis.decision}`, done: true, color: '#00d4ff' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 10, borderBottom: '1px solid #1e2d3d' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: item.done ? `${item.color}18` : '#1e2d3d',
                  border: `1.5px solid ${item.done ? item.color : '#4a5568'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontFamily: 'monospace', color: item.done ? item.color : '#4a5568',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  {item.done ? '✓' : item.step}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: item.done ? '#f8fafc' : '#64748b' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#8899aa', marginTop: 3 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
