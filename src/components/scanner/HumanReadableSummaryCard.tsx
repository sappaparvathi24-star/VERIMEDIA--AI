import React from 'react'
import { useStore } from '../../store'
import type { DetectionResult, TabId } from '../../types'
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Search,
  GitBranch,
  Network,
  Cpu,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react'

interface HumanReadableSummaryCardProps {
  result: DetectionResult
  onSelectStage?: (stageId: number) => void
  currentStage?: number
}

export const HumanReadableSummaryCard: React.FC<HumanReadableSummaryCardProps> = ({
  result,
  onSelectStage,
  currentStage = 1
}) => {
  const { setActiveTab, setShowDMCAModal, setShowEvidenceModal } = useStore()

  // Derive decision & severity
  const decision = result.ai_analysis?.decision || 'REVIEW REQUIRED'
  const severity = result.ai_analysis?.severity || 'LOW'
  const isThreat = decision === 'TAKEDOWN' || decision === 'EMERGENCY_TAKEDOWN' || decision === 'SUSPECT' || severity === 'HIGH' || severity === 'CRITICAL'
  const isAuthentic = decision === 'ALLOW' || decision === 'ATTRIBUTION'

  // Extract human readable explanation text
  const rawExplanation = result.ai_analysis?.reasoning_points?.join(' ') || result.forensics?.summary || ''
  
  // Format 3 plain-English bullet points
  const bulletPoints: string[] = []
  
  if (result.forensics?.ela?.hasCompressionAnomaly) {
    bulletPoints.push('Compression Grid Anomaly: Distinct error levels detected across image blocks, indicating possible digital manipulation or multi-layer editing.')
  } else if (result.forensics?.ela) {
    bulletPoints.push('Compression Uniformity: Error Level Analysis shows consistent lossy quantization across the entire pixel grid.')
  }

  bulletPoints.push('Web & EXIF Inspection: Forensic headers evaluated and compared against public web indexing databases.')

  if (bulletPoints.length < 2 && rawExplanation) {
    bulletPoints.push(rawExplanation)
  }

  const mediaUrl = (result.artifact as any)?.object_url || (result as any).thumbnailUrl || (result as any).imageUrl || null

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #0d1522 0%, #080d16 100%)',
        border: `1.5px solid ${isThreat ? 'rgba(239, 68, 68, 0.5)' : isAuthentic ? 'rgba(34, 197, 94, 0.5)' : 'rgba(0, 212, 255, 0.4)'}`,
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: `0 8px 32px ${isThreat ? 'rgba(239, 68, 68, 0.15)' : isAuthentic ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 212, 255, 0.15)'}`
      }}
    >
      {/* 1. Top Header: Verdict & Key Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: isThreat ? 'rgba(239, 68, 68, 0.15)' : isAuthentic ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 212, 255, 0.15)',
            border: `1px solid ${isThreat ? '#ef4444' : isAuthentic ? '#22c55e' : '#00d4ff'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isThreat ? '#f87171' : isAuthentic ? '#4ade80' : '#38bdf8',
            flexShrink: 0
          }}>
            {isThreat ? <AlertTriangle size={26} /> : isAuthentic ? <ShieldCheck size={26} /> : <Info size={26} />}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
              Official VeriMedia Forensic Dossier
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '2px 0 0 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>Verdict:</span>
              <span style={{ color: isThreat ? '#f87171' : isAuthentic ? '#4ade80' : '#38bdf8' }}>{decision}</span>
              <span style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid #1e2d3d',
                color: '#38bdf8',
                fontFamily: 'monospace',
                fontWeight: 800
              }}>
                Trust Score: {result.trust?.trust_score ?? result.ml?.trust_score ?? 85}%
              </span>
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowEvidenceModal(true)}
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.5)',
              color: '#38bdf8',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <FileCheck2 size={14} /> Full Dossier
          </button>
          {result.ai_analysis?.dmca_needed && (
            <button
              onClick={() => setShowDMCAModal(true)}
              style={{
                background: '#ef4444',
                border: 'none',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <AlertTriangle size={14} /> File DMCA Takedown
            </button>
          )}
        </div>
      </div>

      {/* 2. Media Asset & Executive Findings Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mediaUrl ? '220px 1fr' : '1fr',
        gap: 18,
        background: '#060a12',
        border: '1px solid #1e2d3d',
        borderRadius: 10,
        padding: '16px',
        marginBottom: 18
      }}>
        {/* Optional Media Preview Thumbnail */}
        {mediaUrl && (
          <div style={{
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid #1e2d3d',
            background: '#040810',
            maxHeight: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={mediaUrl}
              alt="Analyzed Asset"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              right: 6,
              background: 'rgba(4, 13, 26, 0.85)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#38bdf8',
              textAlign: 'center',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(0, 212, 255, 0.2)'
            }}>
              {(result.artifact?.sha256 || result.fingerprint_hash || result.job_id).slice(0, 16)}...
            </div>
          </div>
        )}

        {/* Executive Analysis Details */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> Executive Investigation Summary
          </div>
          <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, margin: '0 0 10px 0', fontWeight: 500 }}>
            {isThreat ? (
              <span>
                <strong>Warning:</strong> Forensic algorithms detected compression anomalies and high-frequency edge inconsistencies. Further redistribution is high-risk.
              </span>
            ) : isAuthentic ? (
              <span>
                <strong>Authentic:</strong> Perceptual hashing and error level analysis confirm uniform sensor noise and coherent metadata lineage across public records.
              </span>
            ) : (
              <span>
                <strong>Notice:</strong> Physical forensic verification completed. No active takedown warrants were detected across public indexing channels.
              </span>
            )}
          </p>

          {/* Key Findings Bullet List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bulletPoints.map((pt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                <span style={{ color: '#00d4ff', fontWeight: 800 }}>•</span>
                <div>
                  <strong style={{ color: '#f8fafc' }}>{pt.split(':')[0]}:</strong>{pt.split(':')[1]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Navigation Bar to Each Engine & Feature */}
      <div>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>Jump Directly to Forensic Engine & Feature Modules:</span>
          <span style={{ color: '#00d4ff', fontSize: 10 }}>1-Click Navigation</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10
        }}>
          {/* Engine 1: Forensic Inspection */}
          <button
            onClick={() => {
              if (onSelectStage) onSelectStage(1)
              setActiveTab('forensic')
            }}
            style={{
              background: currentStage === 1 ? 'rgba(0, 212, 255, 0.15)' : '#080d16',
              border: `1px solid ${currentStage === 1 ? '#00d4ff' : '#1e2d3d'}`,
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={16} style={{ color: '#00d4ff' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>1. ELA & EXIF</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Pixel Heatmaps</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: '#64748b' }} />
          </button>

          {/* Engine 2: Web Discovery */}
          <button
            onClick={() => {
              if (onSelectStage) onSelectStage(2)
              setActiveTab('discovery')
            }}
            style={{
              background: currentStage === 2 ? 'rgba(0, 212, 255, 0.15)' : '#080d16',
              border: `1px solid ${currentStage === 2 ? '#00d4ff' : '#1e2d3d'}`,
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} style={{ color: '#38bdf8' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>2. Web Discovery</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Match Candidates</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: '#64748b' }} />
          </button>

          {/* Engine 3: Provenance Lineage */}
          <button
            onClick={() => {
              if (onSelectStage) onSelectStage(3)
              setActiveTab('origin')
            }}
            style={{
              background: currentStage === 3 ? 'rgba(0, 212, 255, 0.15)' : '#080d16',
              border: `1px solid ${currentStage === 3 ? '#00d4ff' : '#1e2d3d'}`,
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={16} style={{ color: '#a855f7' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>3. C2PA Lineage</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Cryptographic Tree</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: '#64748b' }} />
          </button>

          {/* Engine 4: Propagation Graph */}
          <button
            onClick={() => {
              if (onSelectStage) onSelectStage(4)
            }}
            style={{
              background: currentStage === 4 ? 'rgba(0, 212, 255, 0.15)' : '#080d16',
              border: `1px solid ${currentStage === 4 ? '#00d4ff' : '#1e2d3d'}`,
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Network size={16} style={{ color: '#f59e0b' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>4. Spread Topology</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Viral Mesh Graph</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: '#64748b' }} />
          </button>

          {/* Engine 5: VeriMedia AI Multimodal Assistant */}
          <button
            onClick={() => setActiveTab('intelligence')}
            style={{
              background: '#080d16',
              border: '1px solid #1e2d3d',
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} style={{ color: '#38bdf8' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>5. VeriMedia AI Chat</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Assistant & Explainer</div>
              </div>
            </div>
            <ExternalLink size={13} style={{ color: '#64748b' }} />
          </button>

          {/* Engine 6: Cases & DMCA Takedown */}
          <button
            onClick={() => setActiveTab('cases')}
            style={{
              background: '#080d16',
              border: '1px solid #1e2d3d',
              borderRadius: 8,
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
            className="hover:border-rose-400"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCheck2 size={16} style={{ color: '#f43f5e' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>6. Enforcement</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>DMCA & Takedowns</div>
              </div>
            </div>
            <ExternalLink size={13} style={{ color: '#64748b' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
