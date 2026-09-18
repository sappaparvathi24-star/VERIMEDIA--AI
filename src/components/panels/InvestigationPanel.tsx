import React, { useEffect, useState } from 'react'
import {
  fetchInvestigations,
  fetchInvestigation,
  createInvestigationApi,
  updateInvestigationApi,
  addInvestigationNoteApi,
  attachArtifactToInvestigationApi
} from '../../services/api'
import { FindingTraceabilityModal } from '../modals/FindingTraceabilityModal'

interface Investigation {
  id: string
  title: string
  description?: string
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'ARCHIVED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  mode: 'REAL_INVESTIGATION' | 'DEMO_SCENARIO'
  createdBy?: string
  tags?: string[]
  artifactIds?: string[]
  createdAt: string
  updatedAt: string
}

export function InvestigationPanel() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null)
  const [invPackage, setInvPackage] = useState<any>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'findings' | 'artifacts' | 'timeline' | 'notes'>('findings')

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [newTags, setNewTags] = useState('')
  const [creating, setCreating] = useState(false)

  // Attach Artifact Modal
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [attaching, setAttaching] = useState(false)

  // Note state
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Traceability Modal
  const [inspectFindingId, setInspectFindingId] = useState<string | null>(null)

  const loadInvestigations = () => {
    setLoading(true)
    fetchInvestigations()
      .then(res => {
        setInvestigations(Array.isArray(res) ? res : res.investigations || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadInvestigations()
  }, [])

  const loadSingleInvestigation = (id: string) => {
    setPkgLoading(true)
    fetchInvestigation(id)
      .then(res => {
        setInvPackage(res.package || res)
        setPkgLoading(false)
      })
      .catch(() => setPkgLoading(false))
  }

  useEffect(() => {
    if (selectedInvId) {
      loadSingleInvestigation(selectedInvId)
    }
  }, [selectedInvId])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    createInvestigationApi({
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      createdBy: 'Senior Forensic Analyst',
      mode: 'REAL_INVESTIGATION'
    })
      .then(res => {
        setCreating(false)
        setShowCreateModal(false)
        setNewTitle('')
        setNewDesc('')
        setNewTags('')
        loadInvestigations()
        if (res.investigation?.id) {
          setSelectedInvId(res.investigation.id)
        }
      })
      .catch(() => setCreating(false))
  }

  const handleStatusChange = (id: string, newStatus: string) => {
    updateInvestigationApi(id, { status: newStatus })
      .then(() => {
        loadSingleInvestigation(id)
        loadInvestigations()
      })
      .catch(() => {})
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim() || !selectedInvId) return
    setAddingNote(true)
    addInvestigationNoteApi(selectedInvId, noteText.trim(), 'Lead Analyst')
      .then(() => {
        setNoteText('')
        setAddingNote(false)
        loadSingleInvestigation(selectedInvId)
      })
      .catch(() => setAddingNote(false))
  }

  const handleAttachSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!attachFile || !selectedInvId) return
    setAttaching(true)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      attachArtifactToInvestigationApi(selectedInvId, {
        fileData: base64,
        filename: attachFile.name,
        mimeType: attachFile.type
      })
        .then(() => {
          setAttaching(false)
          setShowAttachModal(false)
          setAttachFile(null)
          loadSingleInvestigation(selectedInvId)
        })
        .catch(() => setAttaching(false))
    }
    reader.readAsDataURL(attachFile)
  }

  const filteredInvestigations = investigations.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleMatch = inv.title.toLowerCase().includes(q)
      const idMatch = inv.id.toLowerCase().includes(q)
      const tagMatch = (inv.tags || []).some(t => t.toLowerCase().includes(q))
      if (!titleMatch && !idMatch && !tagMatch) return false
    }
    return true
  })

  const exportPackage = () => {
    if (!invPackage) return
    const blob = new Blob([JSON.stringify(invPackage, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verimedia_investigation_${invPackage.investigation?.id || 'case'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const priorityColors = {
    LOW: '#22c55e',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#dc2626'
  }

  const statusColors = {
    OPEN: '#3b82f6',
    IN_REVIEW: '#a855f7',
    CLOSED: '#22c55e',
    ARCHIVED: '#6b7280'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080c10', color: '#c9d1d9' }}>
      {/* Search & Action Bar */}
      {!selectedInvId ? (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#0d1117' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <input
              type="text"
              placeholder="Search investigations by title, ID, tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                borderRadius: 4, padding: '6px 12px', fontSize: 11, width: 260
              }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                borderRadius: 4, padding: '6px 10px', fontSize: 11
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_REVIEW">IN REVIEW</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#238636', color: '#fff', border: 'none', borderRadius: 4,
              padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            + New Investigation
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: 12, background: '#0d1117' }}>
          <button
            onClick={() => { setSelectedInvId(null); setInvPackage(null); }}
            style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            ← Back to Investigations List
          </button>
          <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>
            {selectedInvId}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: selectedInvId ? 0 : 16 }}>
        {!selectedInvId ? (
          /* List View */
          <div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
                Loading cases...
              </div>
            ) : filteredInvestigations.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', background: '#0d1117', border: '1px border-dashed #30363d', borderRadius: 6 }}>
                <p style={{ fontSize: 13, color: '#f0f6fc', marginBottom: 6 }}>No investigations found</p>
                <p style={{ fontSize: 11 }}>Create an investigation or upload media to start forensic analysis.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {filteredInvestigations.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvId(inv.id)}
                    style={{
                      background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14,
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#58a6ff'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#21262d'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>
                        {inv.id}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3,
                          background: `${priorityColors[inv.priority] || '#8899aa'}22`,
                          color: priorityColors[inv.priority] || '#8899aa',
                          border: `1px solid ${priorityColors[inv.priority] || '#8899aa'}`
                        }}>
                          {inv.priority}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3,
                          background: `${statusColors[inv.status] || '#8899aa'}22`,
                          color: statusColors[inv.status] || '#8899aa',
                          border: `1px solid ${statusColors[inv.status] || '#8899aa'}`
                        }}>
                          {inv.status}
                        </span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc', marginBottom: 6, lineHeight: 1.4 }}>
                      {inv.title}
                    </h4>

                    {inv.description && (
                      <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {inv.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#6e7681', borderTop: '1px solid #161b22', paddingTop: 8, marginTop: 8 }}>
                      <span>Mode: <strong style={{ color: inv.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e' }}>{inv.mode}</strong></span>
                      <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Detail View */
          pkgLoading || !invPackage ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
              Loading investigation details...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header Box */}
              <div style={{ padding: 16, background: '#0d1117', borderBottom: '1px solid #21262d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>
                        {invPackage.investigation?.id}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3,
                        background: `${priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa'}22`,
                        color: priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa',
                        border: `1px solid ${priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa'}`
                      }}>
                        PRIORITY: {invPackage.investigation?.priority}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3,
                        background: invPackage.investigation?.mode === 'DEMO_SCENARIO' ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.15)',
                        color: invPackage.investigation?.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e',
                        border: `1px solid ${invPackage.investigation?.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e'}`
                      }}>
                        {invPackage.investigation?.mode}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc', margin: 0 }}>
                      {invPackage.investigation?.title}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#8b949e' }}>Status:</span>
                      <select
                        value={invPackage.investigation?.status}
                        onChange={e => handleStatusChange(invPackage.investigation?.id, e.target.value)}
                        style={{
                          background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                          borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600
                        }}
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_REVIEW">IN REVIEW</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>

                    <button
                      onClick={exportPackage}
                      style={{
                        background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4,
                        padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      📥 Export Audit Package
                    </button>
                  </div>
                </div>

                {invPackage.investigation?.description && (
                  <p style={{ fontSize: 12, color: '#8b949e', marginTop: 4, marginBottom: 0 }}>
                    {invPackage.investigation?.description}
                  </p>
                )}
              </div>

              {/* Navigation Tabs */}
              <div style={{ display: 'flex', background: '#161b22', borderBottom: '1px solid #21262d', padding: '0 16px' }}>
                {[
                  { id: 'findings', label: `Findings & Evidence (${invPackage.findings?.length || 0})` },
                  { id: 'artifacts', label: `Media Artifacts (${invPackage.artifacts?.length || 0})` },
                  { id: 'timeline', label: `Timeline (${invPackage.timeline?.length || 0})` },
                  { id: 'notes', label: `Analyst Notes (${invPackage.notes?.length || 0})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '10px 16px', fontSize: 11, fontWeight: 600, background: 'none', border: 'none',
                      color: activeTab === tab.id ? '#58a6ff' : '#8b949e',
                      borderBottom: activeTab === tab.id ? '2px solid #58a6ff' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab View Body */}
              <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                {activeTab === 'findings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Section 1: What We Know (Supported Findings) */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#22c55e', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✓ What We Know (Supported Findings)</span>
                      </h3>
                      {invPackage.whatWeKnow?.length === 0 ? (
                        <div style={{ padding: 16, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, fontSize: 11, color: '#8b949e' }}>
                          No supported findings derived yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {invPackage.whatWeKnow?.map((f: any) => (
                            <div key={f.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#58a6ff' }}>
                                  Category: {f.category}
                                </span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                    {f.epistemicStatus} ({Math.round((f.confidence || 0) * 100)}%)
                                  </span>
                                  <button
                                    onClick={() => setInspectFindingId(f.id)}
                                    style={{ background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Trace Evidence →
                                  </button>
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: '#f0f6fc', margin: '4px 0 8px 0', fontWeight: 500 }}>
                                {f.statement}
                              </p>
                              {f.limitations && (
                                <div style={{ fontSize: 10, color: '#d29922', background: 'rgba(210,153,34,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                                  Caveat: {f.limitations}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 2: What Remains Unknown */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.08em', marginBottom: 10 }}>
                        ❓ What Remains Unknown
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(invPackage.whatRemainsUnknown || []).map((u: any, idx: number) => (
                          <div key={idx} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12, fontSize: 11 }}>
                            <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>{u.topic}</div>
                            <div style={{ color: '#8b949e' }}>{u.reason || u.statement || u.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Conflicting Evidence */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.08em', marginBottom: 10 }}>
                        ⚠️ Conflicting Evidence (Preserved Separately)
                      </h3>
                      {invPackage.conflictingEvidence?.length === 0 ? (
                        <div style={{ padding: 12, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, fontSize: 11, color: '#8b949e' }}>
                          No conflicting evidence recorded for this case.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {invPackage.conflictingEvidence?.map((ce: any) => (
                            <div key={ce.id} style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 12, fontSize: 11 }}>
                              <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
                                {ce.type} — CONFLICTING
                              </div>
                              <div style={{ color: '#c9d1d9' }}>{ce.description}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'artifacts' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b949e', margin: 0 }}>
                        Attached Media Artifacts ({invPackage.artifacts?.length || 0})
                      </h3>
                      <button
                        onClick={() => setShowAttachModal(true)}
                        style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        + Attach Media Artifact
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {invPackage.artifacts?.map((art: any) => (
                        <div key={art.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f6fc' }}>{art.filename}</span>
                            <span style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace' }}>{art.mimeType}</span>
                          </div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', background: '#161b22', padding: '4px 8px', borderRadius: 4, wordBreak: 'break-all' }}>
                            SHA-256: {art.sha256}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b949e', margin: 0 }}>
                      Audit Timeline & Activity Feed
                    </h3>
                    {(invPackage.timeline || []).map((evt: any) => (
                      <div key={evt.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12, fontSize: 11, display: 'flex', gap: 12 }}>
                        <div style={{ color: '#58a6ff', fontFamily: 'monospace', fontSize: 10, width: 140, flexShrink: 0 }}>
                          {new Date(evt.timestamp).toLocaleString()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 2 }}>
                            {evt.type} <span style={{ color: '#8b949e', fontWeight: 400 }}>by {evt.actor}</span>
                          </div>
                          <div style={{ color: '#8b949e' }}>{evt.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12 }}>
                      <textarea
                        rows={3}
                        placeholder="Type analyst notes, field observations, or investigatory context..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 4, padding: 8, fontSize: 11, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          type="submit"
                          disabled={addingNote || !noteText.trim()}
                          style={{ background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {addingNote ? 'Saving...' : 'Add Analyst Note'}
                        </button>
                      </div>
                    </form>

                    {/* Notes List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(invPackage.notes || []).map((n: any) => (
                        <div key={n.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12, fontSize: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 6 }}>
                            <strong style={{ color: '#a855f7' }}>📝 {n.authorId}</strong>
                            <span style={{ fontSize: 10 }}>{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p style={{ color: '#c9d1d9', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {n.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal: Create Investigation */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 24, width: 440 }}>
            <h3 style={{ fontSize: 15, color: '#f0f6fc', margin: '0 0 16px 0' }}>Create New Investigation Case</h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Case Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Election Media Alteration Inquiry"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of case objectives and background..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Priority</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as any)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="deepfake, video, social_media"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '6px 12px', fontSize: 11 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontSize: 11, fontWeight: 600 }}
                >
                  {creating ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Attach Artifact */}
      {showAttachModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 24, width: 400 }}>
            <h3 style={{ fontSize: 14, color: '#f0f6fc', margin: '0 0 16px 0' }}>Attach Media File to Investigation</h3>
            <form onSubmit={handleAttachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="file"
                required
                onChange={e => setAttachFile(e.target.files?.[0] || null)}
                style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: 8, borderRadius: 4, fontSize: 11 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAttachModal(false)}
                  style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '6px 12px', fontSize: 11 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attaching || !attachFile}
                  style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontSize: 11, fontWeight: 600 }}
                >
                  {attaching ? 'Ingesting...' : 'Attach File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {inspectFindingId && (
        <FindingTraceabilityModal
          findingId={inspectFindingId}
          onClose={() => setInspectFindingId(null)}
        />
      )}
    </div>
  )
}
