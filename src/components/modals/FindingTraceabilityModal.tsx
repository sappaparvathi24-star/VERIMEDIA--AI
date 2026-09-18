import React, { useEffect, useState } from 'react'
import { fetchFindingTraceability } from '../../services/api'

interface Props {
  findingId: string
  onClose: () => void
}

export function FindingTraceabilityModal({ findingId, onClose }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    fetchFindingTraceability(findingId)
      .then(res => {
        if (isMounted) {
          setData(res.chain || res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Failed to load traceability chain')
          setLoading(false)
        }
      })
    return () => { isMounted = false }
  }, [findingId])

  const statusColors: Record<string, string> = {
    OBSERVED: '#22c55e',
    SUPPORTED: '#3b82f6',
    INFERRED: '#a855f7',
    INCONCLUSIVE: '#f59e0b',
    UNSUPPORTED: '#ef4444',
    REFUTED: '#dc2626'
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <div onClick={e => e.stopPropagation()} className="vm-card" style={{
        width: 'min(920px, 94vw)', maxHeight: '90vh', overflowY: 'auto',
        background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 24
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e2d3d', pb: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🔍 Verified Chain of Evidence Traceability
            </div>
            <h3 style={{ fontSize: 16, color: '#f0f6fc', marginTop: 4, fontWeight: 700 }}>
              Finding ID: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{findingId}</span>
            </h3>
          </div>
          <button className="vm-btn vm-btn-ghost" onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>
            ✕ Close
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8899aa', fontSize: 13 }}>
            Loading evidence provenance chain...
          </div>
        ) : error ? (
          <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 6, fontSize: 12 }}>
            {error}
          </div>
        ) : !data ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Step 1: Finding */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f0f6fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. Derived Finding
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                  background: `${statusColors[data.finding?.epistemicStatus] || '#8899aa'}22`,
                  color: statusColors[data.finding?.epistemicStatus] || '#8899aa',
                  border: `1px solid ${statusColors[data.finding?.epistemicStatus] || '#8899aa'}`
                }}>
                  {data.finding?.epistemicStatus} ({Math.round((data.finding?.confidence || 0) * 100)}% Confidence)
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#c9d1d9', margin: '4px 0 8px 0', lineHeight: 1.5 }}>
                {data.finding?.statement}
              </p>
              <div style={{ fontSize: 11, color: '#8b949e', display: 'flex', gap: 16 }}>
                <span>Category: <strong style={{ color: '#58a6ff' }}>{data.finding?.category}</strong></span>
                <span>Artifact: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{data.finding?.artifactId}</strong></span>
              </div>
            </div>

            {/* Traceability arrow */}
            <div style={{ textAlign: 'center', color: '#58a6ff', fontSize: 16, margin: '-10px 0' }}>↓ Supported By Evidence Items ↓</div>

            {/* Step 2: Supporting Evidence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(data.supportingEvidence || data.evidence || []).map((ev: any, idx: number) => (
                <div key={ev.id || idx} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', fontFamily: 'monospace' }}>
                      2.{idx + 1} Evidence ID: {ev.id}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                      background: `${statusColors[ev.status] || '#8899aa'}22`,
                      color: statusColors[ev.status] || '#8899aa',
                      border: `1px solid ${statusColors[ev.status] || '#8899aa'}`
                    }}>
                      {ev.status} (Strength: {Math.round((ev.strength || 0) * 100)}%)
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#c9d1d9', margin: '4px 0' }}>
                    {ev.description || ev.type}
                  </p>
                  {ev.limitations && (
                    <div style={{ fontSize: 11, color: '#d29922', marginTop: 6, background: '#272115', padding: '6px 10px', borderRadius: 4 }}>
                      ⚠️ Caveat/Limitation: {ev.limitations}
                    </div>
                  )}

                  {/* Step 3: Underlying Observations */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #30363d' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#8b949e', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Underlying Technical Observations ({ev.observations?.length || 0}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(ev.observations || []).map((obs: any, oIdx: number) => (
                        <div key={obs.id || oIdx} style={{ background: '#0d1117', padding: '8px 12px', borderRadius: 4, fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#79c0ff', fontFamily: 'monospace', fontWeight: 600 }}>{obs.type}</span>
                            {obs.value !== undefined && <span style={{ color: '#c9d1d9', marginLeft: 8 }}>Value: {JSON.stringify(obs.value)}</span>}
                          </div>
                          <span style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace' }}>
                            {obs.status || 'OBSERVED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Traceability arrow */}
            <div style={{ textAlign: 'center', color: '#58a6ff', fontSize: 16, margin: '-10px 0' }}>↓ Anchored To Media Artifact ↓</div>

            {/* Step 4: Media Artifact */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 8 }}>
                Media Artifact Provenance Anchor
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11, color: '#c9d1d9' }}>
                <div>
                  <span style={{ color: '#8b949e' }}>Filename:</span> <strong style={{ color: '#f0f6fc' }}>{data.artifact?.filename || 'Media Asset'}</strong>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>MIME Type:</span> <strong style={{ color: '#f0f6fc' }}>{data.artifact?.mimeType || 'Unknown'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#8b949e' }}>FIPS 180-4 SHA-256 Digest:</span>
                  <div style={{ fontFamily: 'monospace', color: '#22c55e', fontSize: 11, background: '#0d1117', padding: '4px 8px', borderRadius: 4, marginTop: 4, wordBreak: 'break-all' }}>
                    {data.artifact?.sha256 || 'Calculated during Phase B ingestion'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
