import React, { useState } from 'react'
import {
  Upload,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  Layers,
  ArrowRight,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react'
import { useStore } from '../../store'
import {
  extractFilesFromInput,
  runRealCaseComparison,
  type BatchCaseFile,
  type BatchCompareItemResult,
  type BatchAuditReport
} from '../../utils/batchForensics'
import { TermLabel } from '../ui/TermLabel'
import { DataConfidenceBanner } from '../ui/DataConfidenceBanner'
import type { DetectionResult } from '../../types'
import { BatchComparePanel } from './BatchComparePanel'

export function BulkAuditPanel() {
  const setCurrentResult = useStore(s => s.setCurrentResult)
  const setActiveTab = useStore(s => s.setActiveTab)

  const [auditMode, setAuditMode] = useState<'server' | 'client'>('server')
  const [masterFile, setMasterFile] = useState<{ filename: string; dataUrl: string; fileSize: number } | null>(null)
  const [suspectCases, setSuspectCases] = useState<BatchCaseFile[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [auditReport, setAuditReport] = useState<BatchAuditReport | null>(null)
  const [isClientFallback, setIsClientFallback] = useState(false)

  const [filterVerdict, setFilterVerdict] = useState<'ALL' | 'DEEPFAKE' | 'MODIFIED' | 'AUTHENTIC' | 'SUSPECT'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Master Upload Handler
  const handleMasterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const reader = new FileReader()
    reader.onload = () => {
      setMasterFile({
        filename: file.name,
        dataUrl: reader.result as string,
        fileSize: file.size
      })
    }
    reader.readAsDataURL(file)
  }

  // Suspect Bulk Files Upload Handler (Zip or Multi-file)
  const handleSuspectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setIsExtracting(true)
    try {
      const extracted = await extractFilesFromInput(files)
      setSuspectCases(prev => [...prev, ...extracted])
    } catch (err) {
      console.error('Failed to extract suspect files:', err)
    } finally {
      setIsExtracting(false)
    }
  }

  // Clear loaded cases
  const handleClear = () => {
    setMasterFile(null)
    setSuspectCases([])
    setAuditReport(null)
    setAnalysisProgress(0)
  }

  // Execute Batch Analysis across all Engine metrics
  const handleRunBatchAudit = async () => {
    if (!masterFile || suspectCases.length === 0 || isAnalyzing) return
    setIsAnalyzing(true)
    setAnalysisProgress(0)

    try {
      const computedResults: BatchCompareItemResult[] = []

      for (let i = 0; i < suspectCases.length; i++) {
        const sc = suspectCases[i]
        // Run real client-side perceptual hash & pixel ELA comparison
        const itemResult = await runRealCaseComparison(masterFile.dataUrl, sc)
        computedResults.push(itemResult)
        setAnalysisProgress(Math.round(((i + 1) / suspectCases.length) * 100))
      }

      // Send to server endpoint to finalize audit report
      const res = await fetch('/api/batch-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterFile,
          suspectCases: computedResults
        })
      })

      if (res.ok) {
        const reportData = await res.json()
        setAuditReport(reportData)
        setIsClientFallback(false)
      } else {
        setIsClientFallback(true)
        // Fallback to local report if server fails
        let authCount = 0, modCount = 0, dfCount = 0, suspCount = 0, simSum = 0
        computedResults.forEach(r => {
          simSum += r.perceptualSimilarity
          if (r.verdict === 'DEEPFAKE') dfCount++
          else if (r.verdict === 'MODIFIED') modCount++
          else if (r.verdict === 'SUSPECT') suspCount++
          else authCount++
        })

        setAuditReport({
          timestamp: new Date().toISOString(),
          masterFilename: masterFile.filename,
          masterDataUrl: masterFile.dataUrl,
          masterSize: masterFile.fileSize,
          totalCases: computedResults.length,
          authenticCount: authCount,
          modifiedCount: modCount,
          deepfakeCount: dfCount,
          suspectCount: suspCount,
          avgSimilarity: Number((simSum / computedResults.length).toFixed(4)),
          items: computedResults
        })
      }
    } catch (err) {
      console.error('Error during batch audit:', err)
      setIsClientFallback(true)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Open single case in Forensic Inspector
  const handleInspectCaseInDetail = (item: BatchCompareItemResult) => {
    if (!masterFile) return

    const isDeepfake = item.verdict === 'DEEPFAKE'
    const isModified = item.verdict === 'MODIFIED'

    const mockDetectionResult: DetectionResult = {
      job_id: `job-${item.id}`,
      case_id: item.id,
      platform: 'YouTube',
      username: 'anonymous_case',
      caption: `Bulk Case Audit against Master Reference "${masterFile.filename}"`,
      content_type: 'news',
      scenario: 'manipulated',
      similarity: item.perceptualSimilarity,
      fingerprint_hash: item.pHash,
      timestamp: new Date().toISOString(),
      processing_ms: 120,
      ml: {
        label: isDeepfake ? 'TAMPERED' : isModified ? 'SUSPICIOUS' : 'SAFE',
        manipulation_probability: item.tamperingProbability,
        trust_score: Math.round((1 - item.tamperingProbability) * 100),
        confidence: 0.94,
        signals: {
          match_score: item.perceptualSimilarity,
          color_diff: 1 - item.colorHistogramCorrelation,
          jpeg_artifact: item.elaDeltaScore
        }
      },
      integrity: {
        score: Math.round((1 - item.tamperingProbability) * 100),
        flags: isDeepfake ? ['DEEPFAKE_SYNTHESIS'] : isModified ? ['PIXEL_TAMPERING'] : [],
        signals: {
          jpeg_artifact: item.elaDeltaScore,
          color_histogram: item.colorHistogramCorrelation
        }
      },
      trust: {
        trust_score: Math.round((1 - item.tamperingProbability) * 100),
        risk_tier: isDeepfake ? 'high_risk' : isModified ? 'suspect' : 'safe',
        verdict: item.verdict,
        factors: {
          perceptual_hash: item.perceptualSimilarity,
          ela_residual: item.elaDeltaScore
        }
      },
      artifact: {
        id: item.id,
        filename: item.filename,
        byteSize: item.fileSize,
        mimeType: item.mimeType,
        dataUrl: item.dataUrl
      },
      forensics: {
        visualFindings: [
          `Perceptual Hamming Distance: ${item.hammingDistance} bits`,
          `ELA Compression Residual Delta: ${(item.elaDeltaScore * 100).toFixed(1)}%`,
          `Color Histogram Correlation: ${(item.colorHistogramCorrelation * 100).toFixed(1)}%`
        ],
        trustScore: Math.round((1 - item.tamperingProbability) * 100),
        confidence: 0.94
      },
      ai_analysis: {
        threat_type: isDeepfake ? 'Deepfake Synthesis' : isModified ? 'Pixel Tampering' : 'None',
        decision: isDeepfake ? 'EMERGENCY_TAKEDOWN' : isModified ? 'REVIEW REQUIRED' : 'ALLOW',
        severity: isDeepfake ? 'CRITICAL' : isModified ? 'HIGH' : 'LOW',
        risk_label: isDeepfake ? 'HIGH_RISK' : isModified ? 'SUSPECT' : 'SAFE',
        confidence: 0.92,
        reasoning_points: [item.summaryText],
        action: isDeepfake ? 'Dispatch Emergency Takedown' : isModified ? 'Flag for Human Review' : 'Pass',
        recommended_action: item.summaryText,
        origin_traced: true,
        dmca_needed: isDeepfake || isModified,
        source: 'fallback'
      }
    }

    setCurrentResult(mockDetectionResult)
    setActiveTab('forensic')
  }

  // Export CSV Report
  const handleExportCSV = () => {
    if (!auditReport) return

    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Case ID,Filename,Verdict,Perceptual Similarity %,Tampering Risk %,Hamming Distance,ELA Delta Score,C2PA Status\n'

    auditReport.items.forEach(item => {
      csvContent += `"${item.id}","${item.filename}","${item.verdict}",${(item.perceptualSimilarity * 100).toFixed(1)}%,${(item.tamperingProbability * 100).toFixed(1)}%,${item.hammingDistance},${(item.elaDeltaScore * 100).toFixed(1)}%,"${item.c2paStatus}"\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Batch_Case_Audit_${masterFile?.filename.replace(/\.[^/.]+$/, '')}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredItems = (auditReport?.items || []).filter(item => {
    const matchesVerdict = filterVerdict === 'ALL' || item.verdict === filterVerdict
    const matchesQuery = !searchQuery || item.filename.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesVerdict && matchesQuery
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0d14', color: '#f8fafc', overflow: 'hidden' }}>
      {/* Mode Sub-nav Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: '#080b11', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engine Mode:</span>
          <div style={{ display: 'flex', background: '#0f172a', padding: 3, borderRadius: 8, border: '1px solid #1e293b' }}>
            <button
              onClick={() => setAuditMode('server')}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: auditMode === 'server' ? '#0284c7' : 'transparent',
                color: auditMode === 'server' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              📦 Async Batch Comparison (ZIP Bundle)
            </button>
            <button
              onClick={() => setAuditMode('client')}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: auditMode === 'client' ? '#0284c7' : 'transparent',
                color: auditMode === 'client' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              ⚡ Client Quick Multi-File Comparator
            </button>
          </div>
        </div>
      </div>

      {auditMode === 'server' ? (
        <BatchComparePanel />
      ) : (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1 }}>
          {/* Header Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #1e2d3d', paddingBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Layers size={22} color="#a855f7" />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: 0 }}>
              Bulk Case File Forensic Audit Engine
            </h1>
            <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              Engine 1 – 5 Integrated
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            Upload an authentic original master image along with a zip archive or bulk folder of suspect case files to execute automated pixel-level comparative forensics.
          </p>
        </div>

        {(masterFile || suspectCases.length > 0) && (
          <button
            onClick={handleClear}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Clear Loaded Session
          </button>
        )}
      </div>

      <DataConfidenceBanner
        confidence="LIVE"
        source="Engine 1 - 5 Comparative Pipeline"
        reason="Real client/server pHash, ELA, histogram correlation & C2PA analysis active"
      />

      {/* Dual Upload Zone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Zone 1: Authentic Master Reference */}
        <div style={{ background: '#0d1117', border: masterFile ? '1px solid #22c55e' : '1px dashed #1e2d3d', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>STEP 1</span> • Authentic Master Reference
            </span>
            {masterFile && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Master Loaded</span>}
          </div>

          {masterFile ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#161b22', padding: 12, borderRadius: 8, border: '1px solid #21262d' }}>
              <img src={masterFile.dataUrl} alt="Master" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #30363d' }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {masterFile.filename}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                  Size: {(masterFile.fileSize / 1024).toFixed(1)} KB • Reference Baseline
                </div>
              </div>
            </div>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 16px', background: '#161b22', borderRadius: 8, border: '1px dashed #30363d', cursor: 'pointer', textAlign: 'center' }}>
              <ImageIcon size={32} color="#38bdf8" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>Upload Authentic Master Image</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>JPEG, PNG, WebP or MP4 reference asset</div>
              <input type="file" accept="image/*,video/*" onChange={handleMasterUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Zone 2: Bulk Suspect Case Archive */}
        <div style={{ background: '#0d1117', border: suspectCases.length > 0 ? '1px solid #a855f7' : '1px dashed #1e2d3d', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>STEP 2</span> • Bulk Suspect Cases Archive
            </span>
            {suspectCases.length > 0 && <span style={{ fontSize: 11, color: '#c084fc', fontWeight: 700 }}>{suspectCases.length} Cases Loaded</span>}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#161b22', borderRadius: 8, border: '1px dashed #30363d', cursor: 'pointer', textAlign: 'center' }}>
            <FileArchive size={32} color="#c084fc" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>
              {isExtracting ? 'Extracting Zip Archive...' : 'Upload .ZIP Archive or Select Multiple Case Files'}
            </div>
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
              Supports .zip containing multiple suspect images/videos or multi-select file upload
            </div>
            <input type="file" accept=".zip,image/*,video/*" multiple onChange={handleSuspectUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Action Button */}
      {masterFile && suspectCases.length > 0 && (
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                Ready to Audit {suspectCases.length} Suspect Case Files against "{masterFile.filename}"
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Runs <TermLabel term="pHash" label="Perceptual pHash" />, <TermLabel term="ELA" label="Pixel ELA" />, Color Histogram Correlation, and C2PA Provenance delta analysis across all files.
              </div>
            </div>

            <button
              onClick={handleRunBatchAudit}
              disabled={isAnalyzing}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: isAnalyzing ? '#334155' : 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                border: 'none',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)'
              }}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Auditing Cases... ({analysisProgress}%)</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Execute Bulk Case Forensic Audit</span>
                </>
              )}
            </button>
          </div>

          {isAnalyzing && (
            <div style={{ width: '100%', background: '#161b22', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${analysisProgress}%`, background: 'linear-gradient(90deg, #a855f7, #38bdf8)', height: '100%', transition: 'width 0.2s ease' }} />
            </div>
          )}
        </div>
      )}

      {/* Audit Results Dashboard */}
      {auditReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isClientFallback && (
            <DataConfidenceBanner
              confidence="DEGRADED"
              source="Client-Side Heuristic Comparator"
              reason="Server batch endpoint offline or returned non-200. Audit computed using in-browser pHash and pixel ELA."
              isSystemAnalysisOnly={true}
            />
          )}

          {/* Executive KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>Total Audited Cases</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>{auditReport.totalCases}</div>
            </div>

            <div style={{ background: '#0d1117', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', fontFamily: 'monospace' }}>Authentic Match</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', marginTop: 4 }}>{auditReport.authenticCount}</div>
            </div>

            <div style={{ background: '#0d1117', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#fbbf24', textTransform: 'uppercase', fontFamily: 'monospace' }}>Pixel Modified</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>{auditReport.modifiedCount + auditReport.suspectCount}</div>
            </div>

            <div style={{ background: '#0d1117', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#f87171', textTransform: 'uppercase', fontFamily: 'monospace' }}>Deepfake Synthesis</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', marginTop: 4 }}>{auditReport.deepfakeCount}</div>
            </div>

            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#38bdf8', textTransform: 'uppercase', fontFamily: 'monospace' }}>Avg Perceptual SSIM</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>{(auditReport.avgSimilarity * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Filter & Export Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color="#64748b" />
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Filter:</span>
              </div>
              {(['ALL', 'DEEPFAKE', 'MODIFIED', 'AUTHENTIC', 'SUSPECT'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setFilterVerdict(v)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: filterVerdict === v ? '#a855f7' : '#1e2d3d',
                    background: filterVerdict === v ? 'rgba(168, 85, 247, 0.15)' : '#161b22',
                    color: filterVerdict === v ? '#c084fc' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Export Audit CSV</span>
            </button>
          </div>

          {/* Case Matrix Table */}
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#161b22', borderBottom: '1px solid #1e2d3d', color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 11 }}>
                  <th style={{ padding: '12px 16px' }}>Suspect Case File</th>
                  <th style={{ padding: '12px 16px' }}>Perceptual Match</th>
                  <th style={{ padding: '12px 16px' }}>ELA Delta</th>
                  <th style={{ padding: '12px 16px' }}>Tampering Risk</th>
                  <th style={{ padding: '12px 16px' }}>Verdict</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isDeepfake = item.verdict === 'DEEPFAKE'
                  const isModified = item.verdict === 'MODIFIED'
                  const isAuthentic = item.verdict === 'AUTHENTIC'

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #1e2d3d', background: '#0d1117' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img src={item.dataUrl} alt={item.filename} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #1e2d3d' }} />
                          <div>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{item.filename}</div>
                            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                              pHash: {item.pHash.slice(0, 8)}... • Hamming: {item.hammingDistance}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ width: 120 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>
                            <span>{(item.perceptualSimilarity * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ width: '100%', background: '#1e2d3d', height: 5, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${item.perceptualSimilarity * 100}%`, background: '#38bdf8', height: '100%' }} />
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: item.elaDeltaScore > 0.4 ? '#f87171' : '#a855f7' }}>
                          {(item.elaDeltaScore * 100).toFixed(1)}% Residual
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDeepfake ? '#f87171' : isModified ? '#fbbf24' : '#4ade80' }}>
                          {(item.tamperingProbability * 100).toFixed(1)}%
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          background: isDeepfake ? 'rgba(239, 68, 68, 0.15)' : isModified ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: isDeepfake ? '#f87171' : isModified ? '#fbbf24' : '#4ade80',
                          border: `1px solid ${isDeepfake ? 'rgba(239, 68, 68, 0.3)' : isModified ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                        }}>
                          {item.verdict}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleInspectCaseInDetail(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            background: '#161b22',
                            border: '1px solid #30363d',
                            color: '#c084fc',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={12} />
                          <span>Inspect Deep Dive</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  )
}
