import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'

const SIGNALS = [
  { key: 'jpeg_artifact',      label: 'Error Level Analysis (ELA)', invert: false, desc: 'Compression grid residual variance' },
  { key: 'noise_pattern',      label: 'Sensor Noise PRNU',           invert: false, desc: 'Photo-response non-uniformity' },
  { key: 'edge_consistency',   label: 'Edge & Boundary Coherence',   invert: true,  desc: 'Boundary gradient continuity & cloning' },
  { key: 'metadata_coherence', label: 'EXIF & Header Integrity',     invert: true,  desc: 'EXIF hardware and timestamp match' },
  { key: 'color_histogram',    label: 'Color Space & Gamut',         invert: false, desc: 'Chroma sub-sampling & gamut distribution' },
  { key: 'face_landmark',      label: 'Facial Landmark Mesh',        invert: false, desc: 'Facial symmetry & neural synthesis cues' },
  { key: 'lipsync',            label: 'Audio/Video Sync',            invert: false, desc: 'Acoustic-viseme alignment' },
  { key: 'temporal_mismatch',  label: 'Frame & Optical Flow',        invert: false, desc: 'Inter-frame motion vector continuity' },
  { key: 'watermark_presence', label: 'Watermark & Signature',       invert: true,  desc: 'Broadcast bug or steganographic tag' },
]

function getSignalColor(anomaly: number): string {
  if (anomaly < 0.25) return '#22c55e'
  if (anomaly < 0.50) return '#f59e0b'
  if (anomaly < 0.70) return '#f97316'
  return '#ef4444'
}

export function ForensicPanel() {
  const { currentResult } = useStore()

  if (!currentResult) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#080c10' }}>
        <div style={{ textAlign: 'center', color: '#64748b', maxWidth: 360 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>No Active Scan</p>
          <p style={{ fontSize: 12, margin: 0 }}>Drop an image above or select a scenario to run a forensic audit.</p>
        </div>
      </div>
    )
  }

  const sigs = currentResult?.integrity?.signals || {}
  const score = currentResult?.integrity?.score ?? 0
  const artifact = currentResult?.artifact
  const forensics = currentResult?.forensics
  const visualFindings = currentResult?.visual_findings || forensics?.visualFindings || []
  const anomalies = currentResult?.detected_anomalies || forensics?.detectedAnomalies || currentResult?.integrity?.flags || []

  const isReal = currentResult.mode === 'REAL_PIPELINE' || Boolean(artifact)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: '16px 20px',
      background: '#080c10',
      color: '#f8fafc',
      gap: 16
    }}>
      {/* Top Status Banner */}
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: isReal ? 'rgba(0, 212, 255, 0.08)' : 'rgba(30, 41, 59, 0.5)',
        border: `1px solid ${isReal ? 'rgba(0, 212, 255, 0.3)' : '#1e2d3d'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{isReal ? '🔬' : '📊'}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                {isReal ? 'Real Media Forensic Audit' : 'Forensic Simulation Matrix'}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: isReal ? 'rgba(0, 212, 255, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                color: isReal ? '#38bdf8' : '#cbd5e1',
                fontFamily: 'monospace'
              }}>
                {isReal ? 'LIVE PIPELINE' : 'SCENARIO'}
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
              {currentResult.subject_description || currentResult.caption || currentResult.platform}
            </p>
          </div>
        </div>

        {/* Primary Verdict & Integrity Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            padding: '6px 12px',
            borderRadius: 6,
            background: score > 0.7 ? 'rgba(34,197,94,0.15)' : score > 0.4 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${score > 0.7 ? '#22c55e' : score > 0.4 ? '#f59e0b' : '#ef4444'}50`,
            color: score > 0.7 ? '#4ade80' : score > 0.4 ? '#fbbf24' : '#f87171',
            fontSize: 12,
            fontWeight: 800,
            fontFamily: 'monospace'
          }}>
            {Math.round(score * 100)}% INTEGRITY
          </div>

          <div style={{
            padding: '6px 12px',
            borderRadius: 6,
            background: currentResult.ml?.label === 'SAFE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${currentResult.ml?.label === 'SAFE' ? '#22c55e' : '#ef4444'}50`,
            color: currentResult.ml?.label === 'SAFE' ? '#4ade80' : '#f87171',
            fontSize: 12,
            fontWeight: 800
          }}>
            {currentResult.ml?.label === 'SAFE' ? 'AUTHENTIC' : (currentResult.ml?.label || 'SUSPECT')}
          </div>
        </div>
      </div>

      {/* Media Artifact & Vision Findings (When available) */}
      {artifact && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: artifact.fileUrl || artifact.dataUrl ? '160px 1fr' : '1fr',
          gap: 16,
          background: '#0d1117',
          border: '1px solid #1e2d3d',
          borderRadius: 8,
          padding: 14
        }}>
          {(artifact.fileUrl || artifact.dataUrl) && (
            <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid #334155', background: '#000', maxHeight: 150 }}>
              <img
                src={artifact.fileUrl || artifact.dataUrl}
                alt="Analyzed media"
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                {artifact.filename}
              </div>
              <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
                {artifact.dimensions ? `${artifact.dimensions.width}×${artifact.dimensions.height}px` : ''} {artifact.byteSize ? `• ${(artifact.byteSize / 1024).toFixed(1)} KB` : ''}
              </div>
            </div>

            {/* Visual Inspection Points */}
            {visualFindings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {visualFindings.map((finding, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#00d4ff', fontSize: 10, marginTop: 3 }}>▸</span>
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Technical Metadata summary pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {artifact.sha256 && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 6px', background: '#1e293b', borderRadius: 4, color: '#94a3b8' }}>
                  SHA256: {artifact.sha256.slice(0, 12)}...
                </span>
              )}
              {forensics?.exif?.model && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 6px', background: '#1e293b', borderRadius: 4, color: '#4ade80' }}>
                  📷 {forensics.exif.make || ''} {forensics.exif.model}
                </span>
              )}
              {forensics?.stats?.entropy !== undefined && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 6px', background: '#1e293b', borderRadius: 4, color: '#38bdf8' }}>
                  Entropy: {forensics.stats.entropy.toFixed(2)}
                </span>
              )}
              {forensics?.ela?.meanError !== undefined && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 6px', background: '#1e293b', borderRadius: 4, color: forensics.ela.hasCompressionAnomaly ? '#f87171' : '#4ade80' }}>
                  ELA Error: {forensics.ela.meanError.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9-Signal Forensic Heatmap Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Multi-Signal Forensic Matrix
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Lower anomaly % = Authentic optical baseline
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {SIGNALS.map(sig => {
            const raw = (sigs as unknown as Record<string, number>)[sig.key] ?? 0
            const anomaly = sig.invert ? 1 - raw : raw
            const color = getSignalColor(anomaly)
            const pct = Math.round(anomaly * 100)

            return (
              <div key={sig.key} style={{
                background: '#0d1117',
                border: `1px solid ${anomaly > 0.65 ? color + '55' : '#1e2d3d'}`,
                borderRadius: 8,
                padding: '10px 12px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                      {sig.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'monospace' }}>
                      {pct}%
                    </div>
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                    {sig.desc}
                  </div>

                  <div style={{ height: 4, background: '#1e2d3d', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Anomalies List (if any) */}
      {anomalies.length > 0 && (
        <div style={{
          background: '#0d1117',
          border: '1px solid #1e2d3d',
          borderRadius: 8,
          padding: '12px 14px'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Flagged Items & Anomaly Observations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {anomalies.map((anom, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
                <span style={{ color: '#ef4444' }}>⚠</span>
                <span>{anom}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Summary Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        background: '#0d1117',
        border: '1px solid #1e2d3d',
        borderRadius: 8,
        padding: 12
      }}>
        {[
          { label: 'Recommended Action', value: currentResult.ai_analysis?.action || 'No Action', color: currentResult.ai_analysis?.dmca_needed ? '#f87171' : '#4ade80' },
          { label: 'Perceptual Match', value: `${Math.round(currentResult.similarity * 100)}%`, color: currentResult.similarity > 0.8 ? '#f87171' : '#38bdf8' },
          { label: 'Manipulation Risk', value: `${Math.round((currentResult.ml?.manipulation_probability ?? 0) * 100)}%`, color: (currentResult.ml?.manipulation_probability ?? 0) > 0.5 ? '#f87171' : '#4ade80' },
          { label: 'Confidence', value: `${Math.round((currentResult.ai_analysis?.confidence ?? currentResult.ml?.confidence ?? 0.85) * 100)}%`, color: '#00d4ff' },
        ].map(item => (
          <div key={item.label} style={{ background: '#080c10', borderRadius: 6, padding: '8px 10px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
