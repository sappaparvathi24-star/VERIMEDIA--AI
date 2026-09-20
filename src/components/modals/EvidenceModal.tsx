import { useState } from 'react'
import { useStore } from '../../store'
import type { DetectionResult } from '../../types'
import { D3ProvenanceTree } from '../charts/D3ProvenanceTree'
import { SequentialForensicReport } from '../forensics/SequentialForensicReport'

interface Props {
  result: DetectionResult
}

export function EvidenceModal({ result }: Props) {
  const { setShowEvidenceModal, setShowDMCAModal } = useStore()
  const [modalTab, setModalTab] = useState<'sequential' | 'tree'>('sequential')

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
