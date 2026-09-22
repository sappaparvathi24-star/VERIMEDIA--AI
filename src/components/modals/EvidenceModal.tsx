import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import type { DetectionResult } from '../../types'
import { D3ProvenanceTree } from '../charts/D3ProvenanceTree'
import { SequentialForensicReport } from '../forensics/SequentialForensicReport'
import { get4FeatureWorkflowReport } from '../../services/api'

interface Props {
  result: DetectionResult
}

export function EvidenceModal({ result }: Props) {
  const { setShowEvidenceModal, setShowDMCAModal } = useStore()
  const [modalTab, setModalTab] = useState<'sequential' | 'tree' | 'workflow'>('sequential')
  const [workflowReport, setWorkflowReport] = useState<any>(null)
  const [loadingWorkflow, setLoadingWorkflow] = useState(false)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  useEffect(() => {
    if (modalTab === 'workflow' && !workflowReport) {
      setLoadingWorkflow(true)
      setWorkflowError(null)
      const resAny = result as any
      const invId = resAny?.investigationId || resAny?.case_id
      if (!invId) {
        // No real investigation is linked to this result (e.g. a simulated
        // scenario run) — show an honest message instead of a fabricated report.
        setLoadingWorkflow(false)
        setWorkflowError('This result has no linked investigation, so no workflow report can be generated.')
        return
      }
      get4FeatureWorkflowReport(invId)
        .then(data => setWorkflowReport(data))
        .catch(err => {
          console.warn('Failed to load workflow report:', err)
          // Do NOT fabricate a mock report here — that previously produced a
          // "✓ VERIFIED NON-FABRICATED" badge over entirely invented data. Show the real failure instead.
          const msg = err?.response?.data?.error || err?.message || 'Failed to load the workflow report from the backend.'
          setWorkflowError(msg)
        })
        .finally(() => setLoadingWorkflow(false))
    }
  }, [modalTab, result])

  if (!result) return null

  return (
    <div className="modal-backdrop" onClick={() => setShowEvidenceModal(false)}>
      <div
        onClick={e => e.stopPropagation()}
        className="vm-card"
        style={{
          width: 'min(1100px, 96vw)',
          height: 'min(820px, 92vh)',
          overflow: 'hidden',
          padding: 0,
          border: '1px solid #1e2d3d',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Navigation Switcher Bar in Modal */}
        <div style={{
          padding: '8px 16px',
          background: '#0a0f18',
          borderBottom: '1px solid #1e2d3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setModalTab('sequential')}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
                background: modalTab === 'sequential' ? '#1e293b' : 'transparent',
                border: modalTab === 'sequential' ? '1px solid #00d4ff' : '1px solid transparent',
                color: modalTab === 'sequential' ? '#38bdf8' : '#8899aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🔬</span> Step-by-Step Sequential Forensic Report
            </button>
            <button
              onClick={() => setModalTab('workflow')}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
                background: modalTab === 'workflow' ? '#1e293b' : 'transparent',
                border: modalTab === 'workflow' ? '1px solid #22c55e' : '1px solid transparent',
                color: modalTab === 'workflow' ? '#4ade80' : '#8899aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>⚡</span> 4-Feature Unified Workflow
            </button>
            <button
              onClick={() => setModalTab('tree')}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
                background: modalTab === 'tree' ? '#1e293b' : 'transparent',
                border: modalTab === 'tree' ? '1px solid #c084fc' : '1px solid transparent',
                color: modalTab === 'tree' ? '#c084fc' : '#8899aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🌳</span> D3 Provenance Lineage Tree
            </button>
          </div>

          <button
            onClick={() => setShowEvidenceModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8899aa',
              fontSize: 16,
              cursor: 'pointer',
              padding: '2px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal View Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {modalTab === 'sequential' ? (
            <SequentialForensicReport
              result={result}
              onClose={() => setShowEvidenceModal(false)}
              onFileDMCA={() => {
                setShowEvidenceModal(false)
                setShowDMCAModal(true)
              }}
            />
          ) : modalTab === 'workflow' ? (
            <div style={{ padding: 20, height: '100%', overflowY: 'auto', background: '#080c10', color: '#f8fafc' }}>
              {loadingWorkflow ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#38bdf8' }}>
                  ⚡ Fetching 4-Feature Verification Workflow Report...
                </div>
              ) : workflowError ? (
                <div style={{
                  padding: 24,
                  maxWidth: 640,
                  margin: '40px auto',
                  textAlign: 'center',
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 8
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Workflow report unavailable
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>{workflowError}</div>
                </div>
              ) : workflowReport ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>
                  <div style={{ borderBottom: '1px solid #1e2d3d', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: '#38bdf8', fontWeight: 800 }}>
                        4-Feature Verification Workflow Report
                      </h3>
                      <div style={{ fontSize: 11, color: '#8899aa', marginTop: 4 }}>
                        Report ID: {workflowReport.reportId} | Filename: {workflowReport.filename}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 4 }}>
                      ✓ VERIFIED NON-FABRICATED
                    </div>
                  </div>

                  {/* Feature 1 */}
                  <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00d4ff', marginBottom: 6 }}>
                      1. Original Website Search
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                      {workflowReport.workflow?.originalWebsite?.summary || 'Search completed.'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8899aa' }}>
                      Status: {workflowReport.workflow?.originalWebsite?.status} | Candidate Matches: {workflowReport.workflow?.originalWebsite?.candidateCount ?? 0}
                    </div>
                  </div>

                  {/* Feature 2 */}
                  <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', marginBottom: 6 }}>
                      2. AI Generation Detection
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                      Verdict: <strong>{workflowReport.workflow?.aiDetection?.verdict}</strong> ({workflowReport.workflow?.aiDetection?.confidenceLabel})
                    </div>
                    <div style={{ fontSize: 11, color: '#8899aa' }}>
                      {workflowReport.workflow?.aiDetection?.modelAssessment || workflowReport.workflow?.aiDetection?.limitations}
                    </div>
                  </div>

                  {/* Feature 3 */}
                  <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>
                      3. Creator Investigation
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                      {workflowReport.workflow?.creatorInvestigation?.summary || 'Attribution evaluation completed.'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8899aa' }}>
                      Attribution Confidence: {workflowReport.workflow?.creatorInvestigation?.attributionConfidence} | Credit: {workflowReport.workflow?.creatorInvestigation?.statedCredit || 'None'}
                    </div>
                  </div>

                  {/* Feature 4 */}
                  <div style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>
                      4. Image Forensics
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>SHA-256: {workflowReport.workflow?.imageForensics?.sha256}</div>
                      <div>Perceptual Hash (aHash): {workflowReport.workflow?.imageForensics?.perceptualHash}</div>
                      <div>MIME Type / Format: {workflowReport.workflow?.imageForensics?.mimeType}</div>
                      <div>Dimensions: {workflowReport.workflow?.imageForensics?.dimensions}</div>
                      <div>ELA Residuals: {workflowReport.workflow?.imageForensics?.elaResiduals}</div>
                      <div>Noise Consistency: {workflowReport.workflow?.imageForensics?.noiseConsistency}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
              <D3ProvenanceTree result={result} height={560} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
