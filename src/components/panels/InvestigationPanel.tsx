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
import { ForensicPanel } from './ForensicPanel'

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

export function InvestigationPanel({ initialSelectedId }: { initialSelectedId?: string | null }) {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvId, setSelectedInvId] = useState<string | null>(initialSelectedId || null)
  const [invPackage, setInvPackage] = useState<any>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'evidence' | 'artifacts' | 'timeline' | 'notes'>('overview')

  // Selected artifact forensic view
  const [selectedArtifactForForensics, setSelectedArtifactForForensics] = useState<string | null>(null)

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [newTags, setNewTags] = useState('')
  const [newFile, setNewFile] = useState<File | null>(null)
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

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedInvId(initialSelectedId)
    }
  }, [initialSelectedId])

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)

    try {
      const res = await createInvestigationApi({
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        createdBy: 'Senior Forensic Analyst',
        mode: 'REAL_INVESTIGATION'
      })

      const invId = res.investigation?.id
      if (invId && newFile) {
        // Handle file upload
        await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = async () => {
            try {
              const base64 = reader.result as string
              await attachArtifactToInvestigationApi(invId, {
                fileData: base64,
                filename: newFile.name,
                mimeType: newFile.type
              })
              resolve(true)
            } catch (err) {
              reject(err)
            }
          }
          reader.onerror = reject
          reader.readAsDataURL(newFile)
        })
      }

      setCreating(false)
      setShowCreateModal(false)
      setNewTitle('')
      setNewDesc('')
      setNewTags('')
      setNewFile(null)
      loadInvestigations()
      if (invId) {
        setSelectedInvId(invId)
      }
    } catch (err) {
      setCreating(false)
    }
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
    addInvestigationNoteApi(selectedInvId, noteText.trim(), 'Senior Analyst')
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
      {/* Top Header / Action Bar */}
      {!selectedInvId ? (
        <div style={{ padding: '20px 24px', background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
          {/* Main Hero Title */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f6fc', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              VeriMedia AI
            </h1>
            <p style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600, margin: '0 0 10px 0' }}>
              Media Provenance, Integrity & Investigation
            </p>
            <p style={{ fontSize: 12, color: '#8b949e', maxWidth: 640, lineHeight: 1.5, margin: 0 }}>
              Investigate media. Understand what was observed. Trace the evidence. See what remains unknown.
            </p>
          </div>

          {/* Action Launcher Bar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTop: '1px solid #21262d' }}>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff',
                border: '1px solid #38bdf8', borderRadius: 6, padding: '9px 20px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 0 16px rgba(56,189,248,0.25)'
              }}
            >
              <span>+</span> New Investigation
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: '#161b22', color: '#c9d1d9',
                border: '1px solid #30363d', borderRadius: 6, padding: '9px 18px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <span>📤</span> Upload Media
            </button>

            <div style={{ flex: 1 }} />

            {/* Search & Status Filters */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search cases by title, ID, tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                  borderRadius: 6, padding: '6px 12px', fontSize: 11, width: 220
                }}
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                  borderRadius: 6, padding: '6px 10px', fontSize: 11
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_REVIEW">IN REVIEW</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: 12, background: '#0d1117' }}>
          <button
            onClick={() => { setSelectedInvId(null); setInvPackage(null); setSelectedArtifactForForensics(null); }}
            style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            ← Back to Investigations List
          </button>
          <span style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
            {selectedInvId}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: selectedInvId ? 0 : 20 }}>
        {!selectedInvId ? (
          /* List View */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                Recent Investigations ({filteredInvestigations.length})
              </h3>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
                Loading investigations...
              </div>
            ) : filteredInvestigations.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#8b949e', background: '#0d1117', border: '1px dashed #30363d', borderRadius: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 6 }}>No investigations found</p>
                <p style={{ fontSize: 12, color: '#8b949e', maxWidth: 400, margin: '0 auto 16px' }}>
                  Create an investigation or upload media to start forensic analysis and evidence gathering.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Create First Investigation
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {filteredInvestigations.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvId(inv.id)}
                    style={{
                      background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16,
                      cursor: 'pointer', transition: 'all 0.15s ease', position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#21262d'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
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

                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc', marginBottom: 8, lineHeight: 1.4 }}>
                      {inv.title}
                    </h4>

                    {inv.description && (
                      <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                        {inv.description}
                      </p>
                    )}

                    {inv.tags && inv.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                        {inv.tags.map((t, idx) => (
                          <span key={idx} style={{ fontSize: 9, background: '#161b22', border: '1px solid #30363d', color: '#8b949e', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#6e7681', borderTop: '1px solid #161b22', paddingTop: 10, marginTop: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: inv.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e'
                        }} />
                        <strong style={{ color: inv.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e' }}>{inv.mode}</strong>
                      </span>
                      <span>Updated {new Date(inv.updatedAt || inv.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Detail / Workspace View */
          pkgLoading || !invPackage ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
              Loading investigation workspace...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Case Header Box */}
              <div style={{ padding: 20, background: '#0d1117', borderBottom: '1px solid #21262d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                        {invPackage.investigation?.id}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                        background: `${priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa'}22`,
                        color: priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa',
                        border: `1px solid ${priorityColors[invPackage.investigation?.priority as keyof typeof priorityColors] || '#8899aa'}`
                      }}>
                        PRIORITY: {invPackage.investigation?.priority}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                        background: invPackage.investigation?.mode === 'DEMO_SCENARIO' ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.15)',
                        color: invPackage.investigation?.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e',
                        border: `1px solid ${invPackage.investigation?.mode === 'DEMO_SCENARIO' ? '#a855f7' : '#22c55e'}`
                      }}>
                        {invPackage.investigation?.mode === 'DEMO_SCENARIO' ? 'DEMO SCENARIO — SIMULATED' : 'REAL INVESTIGATION'}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f0f6fc', margin: 0 }}>
                      {invPackage.investigation?.title}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 600 }}>Status:</span>
                      <select
                        value={invPackage.investigation?.status}
                        onChange={e => handleStatusChange(invPackage.investigation?.id, e.target.value)}
                        style={{
                          background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc',
                          borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700
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
                        background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6,
                        padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      📥 Export Audit Package
                    </button>
                  </div>
                </div>

                {invPackage.investigation?.description && (
                  <p style={{ fontSize: 12, color: '#8b949e', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                    {invPackage.investigation?.description}
                  </p>
                )}
              </div>

              {/* Sub-Navigation Tabs */}
              <div style={{ display: 'flex', background: '#161b22', borderBottom: '1px solid #21262d', padding: '0 20px' }}>
                {[
                  { id: 'overview', label: `Overview` },
                  { id: 'findings', label: `What We Found (${invPackage.findings?.length || 0})` },
                  { id: 'evidence', label: `Evidence (${invPackage.evidence?.length || 0})` },
                  { id: 'artifacts', label: `Media (${invPackage.artifacts?.length || 0})` },
                  { id: 'timeline', label: `Timeline (${invPackage.timeline?.length || 0})` },
                  { id: 'notes', label: `Analyst Notes (${invPackage.notes?.length || 0})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any)
                      setSelectedArtifactForForensics(null)
                    }}
                    style={{
                      padding: '12px 18px', fontSize: 11, fontWeight: 700, background: 'none', border: 'none',
                      color: activeTab === tab.id ? '#38bdf8' : '#8b949e',
                      borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Workspace Body */}
              <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Metrics Overview Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Media Artifacts</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{invPackage.artifacts?.length || 0}</div>
                      </div>

                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Supported Findings</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{invPackage.whatWeKnow?.length || 0}</div>
                      </div>

                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Evidence Items</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#a855f7', fontFamily: 'monospace' }}>{invPackage.evidence?.length || 0}</div>
                      </div>

                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Known (Confirmed)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
                          {invPackage.whatWeKnow?.filter((f: any) => f.epistemicStatus === 'OBSERVED' || f.epistemicStatus === 'SUPPORTED').length || 0}
                        </div>
                      </div>

                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Unknown (Gaps)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>{invPackage.whatRemainsUnknown?.length || 0}</div>
                      </div>

                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Conflicting Signals</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>{invPackage.conflictingEvidence?.length || 0}</div>
                      </div>
                    </div>

                    {/* Summary Card */}
                    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 18 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', margin: '0 0 10px 0' }}>
                        Epistemic Summary & Case Intent
                      </h3>
                      <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.6, margin: 0 }}>
                        This investigation workspace correlates physical, signal-based, and container observations across media artifacts into an evidence graph. All findings preserve explicit limits of inference and confidence metrics.
                      </p>
                    </div>
                  </div>
                )}

                {/* WHAT WE FOUND TAB */}
                {activeTab === 'findings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Section 1: What We Know */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#22c55e', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✓ What We Know (Supported Findings)</span>
                      </h3>
                      {!invPackage.whatWeKnow || invPackage.whatWeKnow.length === 0 ? (
                        <div style={{ padding: 16, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, fontSize: 11, color: '#8b949e' }}>
                          No supported findings derived yet for this investigation.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {invPackage.whatWeKnow.map((f: any) => (
                            <div key={f.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                                  Category: {f.category}
                                </span>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(34,197,94,0.2)' }}>
                                    {f.epistemicStatus} ({Math.round((f.confidence || 0) * 100)}% Confidence)
                                  </span>
                                  <button
                                    onClick={() => setInspectFindingId(f.id)}
                                    style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Trace Evidence →
                                  </button>
                                </div>
                              </div>
                              <p style={{ fontSize: 13, color: '#f0f6fc', margin: '6px 0 10px 0', fontWeight: 600, lineHeight: 1.4 }}>
                                {f.statement}
                              </p>
                              {f.limitations && (
                                <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '6px 10px', borderRadius: 4, borderLeft: '3px solid #f59e0b' }}>
                                  <strong>Limitation / Caveat:</strong> {f.limitations}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 2: What Remains Unknown */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.08em', marginBottom: 12 }}>
                        ❓ What Remains Unknown (Information Gaps)
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(invPackage.whatRemainsUnknown || []).map((u: any, idx: number) => (
                          <div key={idx} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14, fontSize: 11 }}>
                            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>{u.topic}</div>
                            <div style={{ color: '#c9d1d9', lineHeight: 1.4 }}>{u.reason || u.statement || u.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Conflicting Evidence */}
                    <div>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.08em', marginBottom: 12 }}>
                        ⚠️ Conflicting Signals (Preserved Separately)
                      </h3>
                      {!invPackage.conflictingEvidence || invPackage.conflictingEvidence.length === 0 ? (
                        <div style={{ padding: 14, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, fontSize: 11, color: '#8b949e' }}>
                          No conflicting signals preserved for this case.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {invPackage.conflictingEvidence.map((ce: any) => (
                            <div key={ce.id} style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 14, fontSize: 11 }}>
                              <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>
                                {ce.type} — CONFLICTING SIGNAL
                              </div>
                              <div style={{ color: '#c9d1d9' }}>{ce.description}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* EVIDENCE TAB */}
                {activeTab === 'evidence' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b949e', margin: 0 }}>
                      All Evidence Ledger Items ({invPackage.evidence?.length || 0})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(invPackage.evidence || []).map((ev: any) => (
                        <div key={ev.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>{ev.type}</span>
                            <span style={{ fontSize: 10, background: '#161b22', color: '#22c55e', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                              Status: {ev.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#f0f6fc', marginBottom: 6 }}>{ev.description}</div>
                          {ev.limitations && (
                            <div style={{ fontSize: 10, color: '#8b949e' }}>Caveat: {ev.limitations}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MEDIA ARTIFACTS TAB */}
                {activeTab === 'artifacts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b949e', margin: 0 }}>
                        Attached Media Artifacts ({invPackage.artifacts?.length || 0})
                      </h3>
                      <button
                        onClick={() => setShowAttachModal(true)}
                        style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Attach Media Artifact
                      </button>
                    </div>

                    {/* Artifacts List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {invPackage.artifacts?.map((art: any) => (
                        <div key={art.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', marginRight: 10 }}>{art.filename}</span>
                              <span style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace' }}>({art.mimeType || 'media'})</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                                REAL INVESTIGATION
                              </span>
                              <button
                                onClick={() => setSelectedArtifactForForensics(selectedArtifactForForensics === art.id ? null : art.id)}
                                style={{
                                  background: selectedArtifactForForensics === art.id ? '#0284c7' : '#161b22',
                                  color: selectedArtifactForForensics === art.id ? '#fff' : '#38bdf8',
                                  border: '1px solid #38bdf8', borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                {selectedArtifactForForensics === art.id ? 'Hide Forensic Analysis' : '🔬 View Forensic Analysis'}
                              </button>
                            </div>
                          </div>

                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', background: '#161b22', padding: '6px 10px', borderRadius: 4, wordBreak: 'break-all' }}>
                            SHA-256 Digest: {art.sha256 || 'Calculated cryptographic fingerprint anchored'}
                          </div>

                          {/* Embedded Forensic Panel if toggled */}
                          {selectedArtifactForForensics === art.id && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #21262d', background: '#080c10', borderRadius: 6 }}>
                              <ForensicPanel artifactId={art.id} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TIMELINE TAB */}
                {activeTab === 'timeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b949e', margin: 0 }}>
                      Persisted Investigation Audit Timeline
                    </h3>
                    {(invPackage.timeline || []).map((evt: any) => (
                      <div key={evt.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14, fontSize: 11, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 10, width: 150, flexShrink: 0 }}>
                          {new Date(evt.timestamp).toLocaleString()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#f0f6fc', marginBottom: 2 }}>
                            {evt.type} <span style={{ color: '#8b949e', fontWeight: 400 }}>by {evt.actor}</span>
                          </div>
                          <div style={{ color: '#8b949e' }}>{evt.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ANALYST NOTES TAB */}
                {activeTab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#f0f6fc', display: 'block', marginBottom: 6 }}>
                        Record Analyst Action or Investigation Context
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Record analyst field observations, chain of custody notes, or investigation notes..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 6, padding: 10, fontSize: 12, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <button
                          type="submit"
                          disabled={addingNote || !noteText.trim()}
                          style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {addingNote ? 'Recording...' : 'Record Analyst Note'}
                        </button>
                      </div>
                    </form>

                    {/* Notes List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(invPackage.notes || []).map((n: any) => (
                        <div key={n.id} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14, fontSize: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 6 }}>
                            <span style={{ color: '#a855f7', fontWeight: 700 }}>📝 Analyst Note — {n.authorId}</span>
                            <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{new Date(n.createdAt).toLocaleString()}</span>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, padding: 28, width: 480, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc', margin: '0 0 4px 0' }}>New Investigation Case</h3>
            <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 18 }}>
              Create an investigation and attach media artifacts for forensic analysis.
            </p>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', display: 'block', marginBottom: 4 }}>Case Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Media Provenance Inquiry — High Profile Clip"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of investigation objectives..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', display: 'block', marginBottom: 4 }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', display: 'block', marginBottom: 4 }}>Tags</label>
                  <input
                    type="text"
                    placeholder="provenance, deepfake"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Optional Initial File Upload */}
              <div style={{ borderTop: '1px dashed #30363d', paddingTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: 4 }}>
                  Add Media Artifact (Optional)
                </label>
                <input
                  type="file"
                  onChange={e => setNewFile(e.target.files?.[0] || null)}
                  style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: 8, borderRadius: 6, fontSize: 11, width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {creating ? 'Creating Case...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Attach Artifact */}
      {showAttachModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, padding: 24, width: 420 }}>
            <h3 style={{ fontSize: 15, color: '#f0f6fc', margin: '0 0 6px 0', fontWeight: 700 }}>Attach Media File</h3>
            <p style={{ fontSize: 11, color: '#8b949e', marginBottom: 16 }}>Upload an image, video, or audio file for investigation.</p>
            <form onSubmit={handleAttachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="file"
                required
                onChange={e => setAttachFile(e.target.files?.[0] || null)}
                style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', padding: 10, borderRadius: 6, fontSize: 11 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAttachModal(false)}
                  style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attaching || !attachFile}
                  style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {attaching ? 'Ingesting File...' : 'Attach & Ingest File'}
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
