import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import { listInvestigations, getInvestigationDetails, getInvestigationCandidates, getInvestigationReports, generateInvestigationReport } from '../../services/api'
import type { CaseRecord } from '../../types'

const DEC_COLOR: Record<string, string> = {
  'ALLOW': '#22c55e',
  'ATTRIBUTION': '#f59e0b',
  'REVIEW REQUIRED': '#6366f1',
  'SUSPECT': '#f97316',
  'TAKEDOWN': '#ef4444',
  'EMERGENCY_TAKEDOWN': '#dc2626',
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: '#f59e0b',
    under_review: '#6366f1',
    dmca_filed: '#ef4444',
    resolved: '#22c55e',
    closed: '#4a5568',
    ACTIVE: '#22c55e',
    ARCHIVED: '#64748b',
    PENDING: '#f59e0b'
  }
  const c = colors[status] || '#8899aa'
  return (
    <span style={{
      padding: '2px 7px',
      borderRadius: 4,
      background: `${c}18`,
      color: c,
      border: `1px solid ${c}33`,
      fontSize: 9,
      fontWeight: 700,
      fontFamily: 'monospace',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function CasesPanel() {
  const { cases, casesLoading } = useStore()
  const { refreshCases } = useDetection()
  const [activeSubTab, setActiveSubTab] = useState<'investigations' | 'cases' | 'candidates' | 'reports'>('investigations')

  // Real investigations state
  const [investigations, setInvestigations] = useState<any[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null)
  const [invDetails, setInvDetails] = useState<any | null>(null)
  const [invCandidates, setInvCandidates] = useState<any[]>([])
  const [invReports, setInvReports] = useState<any[]>([])
  const [generatingReport, setGeneratingReport] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  async function loadInvestigations() {
    setInvLoading(true)
    try {
      const res = await listInvestigations()
      const list = Array.isArray(res) ? res : (res?.investigations || [])
      setInvestigations(list)
      if (list.length > 0) {
        const idToSelect = selectedInvId && list.some((i: any) => i.id === selectedInvId) ? selectedInvId : list[0].id
        selectInvestigation(idToSelect)
      }
    } catch (e) {
      console.error('Failed to load investigations', e)
    } finally {
      setInvLoading(false)
    }
  }

  async function selectInvestigation(id: string) {
    setSelectedInvId(id)
    try {
      const [details, candidatesRes, reportsRes] = await Promise.all([
        getInvestigationDetails(id).catch(() => null),
        getInvestigationCandidates(id).catch(() => ({ candidates: [] })),
        getInvestigationReports(id).catch(() => ({ reports: [] }))
      ])
      setInvDetails(details?.investigation || details || null)
      const candList = Array.isArray(candidatesRes) ? candidatesRes : (candidatesRes?.candidates || candidatesRes?.results || [])
      const repList = Array.isArray(reportsRes) ? reportsRes : (reportsRes?.reports || [])
      setInvCandidates(candList)
      setInvReports(repList)
    } catch (err) {
      console.error('Error fetching investigation details', err)
    }
  }

  async function handleGenerateReport(id: string) {
    setGeneratingReport(true)
    setActionNotice(null)
    try {
      await generateInvestigationReport(id)
      setActionNotice('Forensic investigation report compiled and archived successfully.')
      const reportsRes = await getInvestigationReports(id)
      const repList = Array.isArray(reportsRes) ? reportsRes : (reportsRes?.reports || [])
      setInvReports(repList)
    } catch (e: any) {
      setActionNotice(`Report generation failed: ${e.message || 'Unknown error'}`)
    } finally {
      setGeneratingReport(false)
    }
  }

  useEffect(() => {
    refreshCases()
    loadInvestigations()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080c10', color: '#f8fafc' }}>
      {/* Top Bar with Navigation Tabs */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0d1117'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Forensic Dossiers & Cases
          </span>

          <div style={{ display: 'flex', gap: 6, background: '#080c10', padding: 3, borderRadius: 6, border: '1px solid #1e2d3d' }}>
            <button
              onClick={() => setActiveSubTab('investigations')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'investigations' ? 'rgba(0,212,255,0.2)' : 'transparent',
                color: activeSubTab === 'investigations' ? '#38bdf8' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              📂 Active Investigations ({investigations.length})
            </button>
            <button
              onClick={() => setActiveSubTab('cases')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'cases' ? 'rgba(239,68,68,0.2)' : 'transparent',
                color: activeSubTab === 'cases' ? '#f87171' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              ⚖️ DMCA & Enforcement ({cases.length})
            </button>
            <button
              onClick={() => setActiveSubTab('candidates')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'candidates' ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: activeSubTab === 'candidates' ? '#c084fc' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              🔎 Matched Candidates ({invCandidates.length})
            </button>
            <button
              onClick={() => setActiveSubTab('reports')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'reports' ? 'rgba(34,197,94,0.2)' : 'transparent',
                color: activeSubTab === 'reports' ? '#4ade80' : '#8899aa',
                cursor: 'pointer'
              }}
            >
              📄 Evidence Reports ({invReports.length})
            </button>
          </div>
        </div>

        <button
          className="vm-btn vm-btn-ghost"
          style={{ padding: '4px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => {
            refreshCases()
            loadInvestigations()
            if (selectedInvId) selectInvestigation(selectedInvId)
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {actionNotice && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(0, 212, 255, 0.1)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
          color: '#38bdf8',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>ℹ️ {actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: 'transparent', border: 'none', color: '#8899aa', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* SUBTAB 1: INVESTIGATIONS */}
        {activeSubTab === 'investigations' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, height: '100%' }}>
            {/* Left: Investigation List */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2d3d', fontSize: 11, fontWeight: 700, color: '#8899aa', textTransform: 'uppercase' }}>
                Active Investigations
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {invLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Loading investigations...</div>
                ) : investigations.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>No investigations found.</div>
                ) : (
                  investigations.map(inv => {
                    const isSelected = inv.id === selectedInvId
                    return (
                      <div
                        key={inv.id}
                        onClick={() => selectInvestigation(inv.id)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #1e2d3d',
                          background: isSelected ? 'rgba(0,212,255,0.06)' : 'transparent',
                          borderLeft: isSelected ? '3px solid #00d4ff' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#00d4ff' }}>
                            {inv.id}
                          </span>
                          <StatusBadge status={inv.status || 'ACTIVE'} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                          {inv.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#8899aa' }}>
                          <span>👤 {inv.leadInvestigator || 'ANALYST'}</span>
                          {inv.isDemo && (
                            <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                              DEMO CASE
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Investigation Dossier */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 18, overflowY: 'auto' }}>
              {invDetails ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#00d4ff', background: 'rgba(0,212,255,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.3)' }}>
                          {invDetails.id}
                        </span>
                        <StatusBadge status={invDetails.status} />
                        {invDetails.isDemo && (
                          <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>DEMO SCENARIO</span>
                        )}
                      </div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: '4px 0' }}>
                        {invDetails.title}
                      </h2>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                        {invDetails.description || 'No description recorded.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleGenerateReport(invDetails.id)}
                        disabled={generatingReport}
                        style={{
                          background: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          color: '#4ade80',
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {generatingReport ? '◌ Compiling...' : '⚡ Generate Report'}
                      </button>

                      <a
                        href={`/api/investigations/${invDetails.id}/report/export/json`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(0, 212, 255, 0.15)',
                          border: '1px solid rgba(0, 212, 255, 0.4)',
                          color: '#38bdf8',
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        JSON Export ↗
                      </a>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
                    <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase' }}>Provenance Confidence</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#00d4ff', fontFamily: 'monospace', marginTop: 4 }}>
                        {invDetails.provenanceConfidence ? `${Math.round(invDetails.provenanceConfidence * 100)}%` : 'PENDING'}
                      </div>
                    </div>
                    <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase' }}>Forensic Confidence</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7', fontFamily: 'monospace', marginTop: 4 }}>
                        {invDetails.forensicConfidence ? `${Math.round(invDetails.forensicConfidence * 100)}%` : 'PENDING'}
                      </div>
                    </div>
                    <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase' }}>Discovered Candidates</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: 4 }}>
                        {invCandidates.length}
                      </div>
                    </div>
                    <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#8899aa', textTransform: 'uppercase' }}>Compiled Reports</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace', marginTop: 4 }}>
                        {invReports.length}
                      </div>
                    </div>
                  </div>

                  {/* Limitations and Epistemic Demarcations */}
                  <div style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 14, marginBottom: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚠️ Epistemic Limitations & Forensic Scope
                    </div>
                    {invDetails.limitations && invDetails.limitations.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>
                        {invDetails.limitations.map((lim: string, idx: number) => (
                          <li key={idx}>{lim}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 11, color: '#64748b' }}>No special limitations recorded for this case.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  Select an investigation from the left panel to inspect forensic details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: DMCA & ENFORCEMENT CASES */}
        {activeSubTab === 'cases' && (
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, overflow: 'hidden' }}>
            {casesLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading enforcement cases...</div>
            ) : cases.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>No Enforcement Cases Filed Yet</div>
                <div style={{ fontSize: 11, color: '#8899aa', marginTop: 4 }}>
                  Cases are automatically queued when high-risk or takedown decisions are generated during media analysis.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2d3d', background: '#090d12' }}>
                    {['Case ID', 'Platform', 'Account', 'Decision', 'Severity', 'Status', 'Timestamp'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#8899aa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: CaseRecord) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #1a2535' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#00d4ff', fontWeight: 700 }}>
                        {c.case_id}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#8899aa' }}>{c.platform}</td>
                      <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>@{c.username}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ color: DEC_COLOR[c.decision] || '#8899aa', fontWeight: 700, fontFamily: 'monospace' }}>
                          {c.decision}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#f87171' }}>{c.severity}</td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>
                        {new Date(c.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SUBTAB 3: MATCHED CANDIDATES */}
        {activeSubTab === 'candidates' && (
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 12 }}>
              Discovered Candidates for Current Investigation ({invCandidates.length})
            </div>
            {invCandidates.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                No external candidates recorded for this investigation. Run discovery in the Multi-Source Discovery panel.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {invCandidates.map(cand => (
                  <div key={cand.id} style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                        {cand.id}
                      </span>
                      <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>
                        {cand.platform || 'Web'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                      {cand.title || 'Candidate Web Record'}
                    </div>
                    {cand.url && (
                      <a href={cand.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#00d4ff', textDecoration: 'none', display: 'block', marginBottom: 8, wordBreak: 'break-all' }}>
                        🔗 {cand.url}
                      </a>
                    )}
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#8899aa', fontFamily: 'monospace' }}>
                      <span>Relationship: <strong style={{ color: '#4ade80' }}>{cand.relationshipType}</strong></span>
                      <span>Similarity: <strong style={{ color: '#fbbf24' }}>{Math.round((cand.similarityMeasurements?.visualSimilarity || 1) * 100)}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 4: REPORTS */}
        {activeSubTab === 'reports' && (
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                Audit-Ready Investigation Reports Archive ({invReports.length})
              </div>
              {selectedInvId && (
                <button
                  onClick={() => handleGenerateReport(selectedInvId)}
                  disabled={generatingReport}
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#4ade80',
                    padding: '5px 12px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {generatingReport ? '◌ Compiling...' : '+ Compile New Report'}
                </button>
              )}
            </div>

            {invReports.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                No archived reports for this investigation yet. Click 'Compile New Report' to generate an immutable forensic record.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {invReports.map(rep => (
                  <div key={rep.id} style={{ background: '#080c10', border: '1px solid #1e2d3d', borderRadius: 6, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4ade80', fontWeight: 700 }}>
                          {rep.id}
                        </span>
                        <span style={{ fontSize: 10, color: '#8899aa' }}>
                          Generated: {new Date(rep.generatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                        {rep.executiveSummary?.headline || 'Comprehensive Forensic Media Dossier'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={`/api/investigations/${rep.investigationId}/report/export/json`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(0, 212, 255, 0.1)',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          color: '#38bdf8',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        JSON ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
