// VeriMedia AI — Human Review Panel (Task 1)
// Implements the core principle: AI assists the investigation; the investigator decides.
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../store'

const API = (path: string) => `/api${path}`

const STATUS_COLOR: Record<string, string> = {
  SUPPORTED: '#4ade80',
  PARTIALLY_SUPPORTED: '#86efac',
  CONTRADICTED: '#f87171',
  INFERRED: '#60a5fa',
  INCONCLUSIVE: '#fbbf24',
  CONFLICTING: '#fb923c',
  UNKNOWN: '#94a3b8',
  UNASSESSED: '#94a3b8',
  RESOLVED: '#a78bfa',
}

interface Finding {
  id: string
  investigationId: string
  title: string
  statement: string
  summary: string
  category: string
  status: string
  confidence: number
  evidenceCount: number
  reviewCount: number
  evidenceIds: string[]
  createdAt: string
}

interface Review {
  id: string
  reviewerEmail: string
  decision: string
  rationale: string
  statusBefore: string
  statusAfter: string
  createdAt: string
}

interface Evidence {
  id: string
  title: string
  polarity?: string
  strengthScore?: number
  category?: string
}

const DECISION_LABEL: Record<string, string> = {
  ACCEPT: 'Accept finding',
  REJECT: 'Reject finding',
  INCONCLUSIVE: 'Mark inconclusive',
  REQUEST_FURTHER_INVESTIGATION: 'Request further investigation',
}

const DECISION_COLOR: Record<string, string> = {
  ACCEPT: '#4ade80',
  REJECT: '#f87171',
  INCONCLUSIVE: '#fbbf24',
  REQUEST_FURTHER_INVESTIGATION: '#60a5fa',
}

function token(): string {
  return typeof window !== 'undefined'
    ? (localStorage.getItem('verimedia_token') || 'analyst_active_session')
    : 'analyst_active_session'
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(API(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function ReviewPanel() {
  const { currentResult } = useStore()
  const investigationId: string | null =
    (currentResult as any)?.investigationId ||
    (currentResult as any)?.investigation_id ||
    null

  const [findings, setFindings] = useState<Finding[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence>>({})
  const [decision, setDecision] = useState<string>('')
  const [rationale, setRationale] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selected = findings.find(f => f.id === selectedId) || null

  const loadFindings = useCallback(async () => {
    if (!investigationId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch(`/investigations/${investigationId}/findings`)
      setFindings(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [investigationId])

  const loadReviews = useCallback(async (findingId: string) => {
    try {
      const data = await apiFetch(`/findings/${findingId}/reviews`)
      setReviews(Array.isArray(data) ? data : [])
    } catch {
      setReviews([])
    }
  }, [])

  const loadEvidence = useCallback(async (evidenceIds: string[]) => {
    const fetched: Record<string, Evidence> = {}
    await Promise.all(
      evidenceIds.map(async id => {
        try {
          const ev = await apiFetch(`/evidence/${id}`)
          fetched[id] = ev
        } catch {
          fetched[id] = { id, title: id, category: 'UNKNOWN' }
        }
      })
    )
    setEvidenceMap(prev => ({ ...prev, ...fetched }))
  }, [])

  useEffect(() => { loadFindings() }, [loadFindings])

  useEffect(() => {
    if (!selectedId) { setReviews([]); return }
    loadReviews(selectedId)
    const f = findings.find(x => x.id === selectedId)
    if (f?.evidenceIds?.length) loadEvidence(f.evidenceIds)
  }, [selectedId, findings, loadReviews, loadEvidence])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setDecision('')
    setRationale('')
    setError(null)
    setSuccess(null)
  }

  const rationale_required = decision === 'REJECT' || decision === 'INCONCLUSIVE'

  const handleSubmit = async () => {
    if (!selectedId || !decision) return
    if (rationale_required && !rationale.trim()) {
      setError('Rationale is required for this decision.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch(`/findings/${selectedId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, rationale }),
      })
      setSuccess(`Decision "${DECISION_LABEL[decision]}" recorded.`)
      setDecision('')
      setRationale('')
      await loadReviews(selectedId)
      await loadFindings()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const supporting = selected?.evidenceIds?.filter(id => {
    const ev = evidenceMap[id]
    return !ev || ev.polarity === 'SUPPORTING' || !ev.polarity
  }) || []
  const conflicting = selected?.evidenceIds?.filter(id => {
    const ev = evidenceMap[id]
    return ev?.polarity === 'REFUTING'
  }) || []

  const sectionStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #1e2d3d',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
    fontFamily: 'monospace',
  }

  if (!investigationId) {
    return (
      <div style={{ padding: 32, color: '#64748b', textAlign: 'center' }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No active investigation</div>
        <div style={{ fontSize: 12 }}>Run a scan first to load findings for review.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#080c10' }}>
      {/* Left: findings list */}
      <div style={{
        width: 300,
        flexShrink: 0,
        borderRight: '1px solid #1e2d3d',
        overflow: 'auto',
        padding: '12px 10px',
      }}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Findings · {findings.length}</div>
        {loading && <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>Loading…</div>}
        {!loading && findings.length === 0 && (
          <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>
            No findings yet. Run forensic analysis to generate findings.
          </div>
        )}
        {findings.map(f => (
          <button
            key={f.id}
            onClick={() => handleSelect(f.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: 6,
              borderRadius: 6,
              border: selectedId === f.id ? '1px solid #00d4ff' : '1px solid #1e2d3d',
              background: selectedId === f.id ? 'rgba(0,212,255,0.07)' : '#0d1117',
              cursor: 'pointer',
              color: '#f8fafc',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.title || f.statement?.slice(0, 60) || f.id}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: STATUS_COLOR[f.status] || '#94a3b8',
                background: 'rgba(255,255,255,0.05)',
                padding: '1px 5px',
                borderRadius: 4,
              }}>
                {f.status}
              </span>
              <span style={{ fontSize: 9, color: '#64748b' }}>
                {f.evidenceCount} evidence · {f.reviewCount} review{f.reviewCount !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Right: detail + review form */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!selected && (
          <div style={{ color: '#64748b', fontSize: 14, padding: 32, textAlign: 'center' }}>
            Select a finding to review
          </div>
        )}

        {selected && (
          <>
            {/* Statement */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Finding</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                {selected.title}
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
                {selected.statement}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                  Category: {selected.category}
                </span>
                <span style={{ fontSize: 10, color: STATUS_COLOR[selected.status] || '#94a3b8', fontFamily: 'monospace' }}>
                  Status: {selected.status}
                </span>
                {selected.confidence != null && (
                  <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                    Confidence: {(selected.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* Evidence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Supporting evidence ({supporting.length})</div>
                {supporting.length === 0 && <div style={{ fontSize: 11, color: '#64748b' }}>None recorded</div>}
                {supporting.map(id => {
                  const ev = evidenceMap[id]
                  return (
                    <div key={id} style={{ fontSize: 11, color: '#4ade80', marginBottom: 4, fontFamily: 'monospace' }}>
                      {ev ? `[${ev.category || 'EV'}] ${ev.title}` : id}
                    </div>
                  )
                })}
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Conflicting evidence ({conflicting.length})</div>
                {conflicting.length === 0 && <div style={{ fontSize: 11, color: '#64748b' }}>None recorded</div>}
                {conflicting.map(id => {
                  const ev = evidenceMap[id]
                  return (
                    <div key={id} style={{ fontSize: 11, color: '#f87171', marginBottom: 4, fontFamily: 'monospace' }}>
                      {ev ? `[${ev.category || 'EV'}] ${ev.title}` : id}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Unknown / limitations */}
            {selected.status === 'UNKNOWN' || selected.status === 'UNASSESSED' ? (
              <div style={{ ...sectionStyle, borderColor: '#fbbf2440' }}>
                <div style={labelStyle}>What is unknown</div>
                <div style={{ fontSize: 12, color: '#fbbf24' }}>
                  This finding has not yet been supported or contradicted by evidence. Additional analysis may be needed.
                </div>
              </div>
            ) : null}

            {/* Review form */}
            {selected.status !== 'RESOLVED' && (
              <div style={{ ...sectionStyle, borderColor: '#334155' }}>
                <div style={labelStyle}>Record a decision</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {Object.entries(DECISION_LABEL).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setDecision(val)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: decision === val
                          ? `1px solid ${DECISION_COLOR[val]}`
                          : '1px solid #334155',
                        background: decision === val
                          ? `${DECISION_COLOR[val]}18`
                          : '#0d1117',
                        color: decision === val ? DECISION_COLOR[val] : '#94a3b8',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={rationale}
                  onChange={e => setRationale(e.target.value)}
                  placeholder={rationale_required ? 'Rationale is required for this decision…' : 'Rationale (optional)…'}
                  style={{
                    width: '100%',
                    minHeight: 72,
                    background: '#0a0f16',
                    border: rationale_required && !rationale.trim() ? '1px solid #f87171' : '1px solid #1e2d3d',
                    borderRadius: 6,
                    color: '#f8fafc',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />

                {error && (
                  <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</div>
                )}
                {success && (
                  <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 8 }}>{success}</div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !decision}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: '1px solid #00d4ff',
                    background: 'rgba(0,212,255,0.1)',
                    color: '#38bdf8',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: submitting || !decision ? 'not-allowed' : 'pointer',
                    opacity: submitting || !decision ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Recording…' : 'Record decision'}
                </button>
              </div>
            )}

            {selected.status === 'RESOLVED' && (
              <div style={{ ...sectionStyle, borderColor: '#a78bfa40' }}>
                <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>
                  This finding has been resolved by a human reviewer.
                </div>
              </div>
            )}

            {/* Prior review chain */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Review chain ({reviews.length})</div>
              {reviews.length === 0 && (
                <div style={{ fontSize: 11, color: '#64748b' }}>No reviews recorded yet.</div>
              )}
              {reviews.map((r, i) => (
                <div key={r.id} style={{
                  borderLeft: `3px solid ${DECISION_COLOR[r.decision] || '#334155'}`,
                  paddingLeft: 10,
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: DECISION_COLOR[r.decision] || '#94a3b8' }}>
                      #{i + 1} · {r.decision}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>by {r.reviewerEmail}</span>
                    <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>
                    Status: {r.statusBefore} → {r.statusAfter}
                  </div>
                  {r.rationale && (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                      "{r.rationale}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
