import { useState } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'

export function DMCAModal() {
  const { currentResult, setShowDMCAModal } = useStore()
  const { runDMCA } = useDetection()
  const [notice, setNotice] = useState<{ subject: string; body: string; evidence_summary: string; source: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!currentResult) return null

  async function handleGenerate() {
    if (!currentResult) return
    setLoading(true)
    const result = await runDMCA({
      case_id: currentResult.case_id || `VM-${currentResult.job_id.slice(0, 8).toUpperCase()}`,
      platform: currentResult.platform,
      username: currentResult.username,
      caption: currentResult.caption,
      content_type: currentResult.content_type,
      analysis: {
        similarity: currentResult.similarity,
        integrity_score: currentResult.integrity.score,
        ml_label: currentResult.ml.label,
        ml_confidence: currentResult.ml.confidence,
        decision: currentResult.ai_analysis.decision,
        severity: currentResult.ai_analysis.severity,
        scenario: currentResult.scenario,
      },
    })
    if (result) setNotice(result)
    setLoading(false)
  }

  function handleCopy() {
    if (!notice) return
    navigator.clipboard.writeText(`${notice.subject}\n\n${notice.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={() => setShowDMCAModal(false)}>
      <div
        onClick={e => e.stopPropagation()}
        className="vm-card"
        style={{
          width: 'min(760px, 96vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid #ef4444',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'rgba(239,68,68,0.08)',
          borderBottom: '1px solid #ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>📋 DMCA Takedown Notice</h2>
            <p style={{ fontSize: 11, color: '#8899aa', marginTop: 2 }}>
              Case: {currentResult.case_id || 'Pending'} · @{currentResult.username} · {currentResult.platform}
            </p>
          </div>
          <button
            onClick={() => setShowDMCAModal(false)}
            style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: 20, cursor: 'pointer' }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {!notice ? (
            <>
              {/* Evidence summary */}
              <div style={{
                background: '#080c10', border: '1px solid #1e2d3d',
                borderRadius: 8, padding: 16, marginBottom: 20,
              }}>
                <p style={{ fontSize: 11, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Evidence Summary
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Similarity', value: `${Math.round(currentResult.similarity * 100)}%`, color: '#00d4ff' },
                    { label: 'ML Label', value: currentResult.ml.label, color: currentResult.ml.label === 'TAMPERED' ? '#ef4444' : '#f59e0b' },
                    { label: 'Decision', value: currentResult.ai_analysis.decision, color: '#ef4444' },
                    { label: 'Severity', value: currentResult.ai_analysis.severity, color: '#f97316' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: '#0d1117', border: '1px solid #1e2d3d',
                      borderRadius: 6, padding: '8px 12px',
                    }}>
                      <span style={{ fontSize: 10, color: '#8899aa' }}>{item.label}: </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 13, color: '#8899aa', marginBottom: 20 }}>
                  Claude AI will generate a formal DMCA takedown notice with evidence citations.
                </p>
                <button
                  className="vm-btn vm-btn-danger"
                  style={{ padding: '12px 32px', fontSize: 14 }}
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? '⏳ Generating...' : '⚡ Generate DMCA Notice'}
                </button>
              </div>
            </>
          ) : (
            <>
              {notice.source === 'claude' && (
                <div style={{
                  padding: '8px 14px', borderRadius: 6, marginBottom: 14,
                  background: 'rgba(168,85,247,0.1)', border: '1px solid #a855f7',
                }}>
                  <span style={{ fontSize: 11, color: '#a855f7' }}>✦ Generated by Claude AI</span>
                </div>
              )}
              <div style={{
                background: '#080c10', border: '1px solid #1e2d3d',
                borderRadius: 8, padding: 16, marginBottom: 14,
              }}>
                <p style={{ fontSize: 11, color: '#8899aa', marginBottom: 6 }}>SUBJECT</p>
                <p style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{notice.subject}</p>
              </div>
              <div style={{
                background: '#080c10', border: '1px solid #1e2d3d',
                borderRadius: 8, padding: 16, marginBottom: 16,
                maxHeight: 320, overflow: 'auto',
              }}>
                <p style={{ fontSize: 11, color: '#8899aa', marginBottom: 8 }}>NOTICE BODY</p>
                <pre style={{
                  fontSize: 12, color: '#cbd5e1', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                }}>
                  {notice.body}
                </pre>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="vm-btn vm-btn-ghost" onClick={handleCopy}>
                  {copied ? '✓ Copied!' : '📋 Copy Notice'}
                </button>
                <button className="vm-btn vm-btn-danger" onClick={() => setShowDMCAModal(false)}>
                  File Notice
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
