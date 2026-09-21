// VeriMedia AI — Candidate Comparison Hub (10 Reports & 3-Way Classification)
import { useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Layers,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  Maximize2,
  ArrowRightLeft,
  Eye
} from 'lucide-react'
import type { ComparisonReport, ThreeWayClassification } from '../../types'

interface CandidateComparisonHubProps {
  reports: ComparisonReport[]
  activeCandidateId?: string | null
  onSelectCandidate: (candidate: ComparisonReport) => void
  onOpenReportModal?: (candidate: ComparisonReport) => void
  uploadedMediaUrl?: string | null
  uploadedFilename?: string
}

export function CandidateComparisonHub({
  reports,
  activeCandidateId,
  onSelectCandidate,
  onOpenReportModal,
  uploadedMediaUrl,
  uploadedFilename = 'Uploaded Reference Media'
}: CandidateComparisonHubProps) {
  const [filter, setFilter] = useState<'ALL' | ThreeWayClassification>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReportForModal, setSelectedReportForModal] = useState<ComparisonReport | null>(null)

  const knownCount = reports.filter(r => r.classification === 'KNOWN').length
  const unknownCount = reports.filter(r => r.classification === 'UNKNOWN').length
  const notSoCount = reports.filter(r => r.classification === 'NOT_SO').length

  const filteredReports = reports.filter(r => {
    if (filter !== 'ALL' && r.classification !== filter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        (r.publisher && r.publisher.toLowerCase().includes(q)) ||
        (r.platform && r.platform.toLowerCase().includes(q))
      )
    }
    return true
  })

  const handleOpenModal = (report: ComparisonReport) => {
    if (onOpenReportModal) {
      onOpenReportModal(report)
    } else {
      setSelectedReportForModal(report)
    }
  }

  const exportAllReportsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reports, null, 2))
    const dlAnchor = document.createElement('a')
    dlAnchor.setAttribute('href', dataStr)
    dlAnchor.setAttribute('download', `verimedia_10_comparison_reports_${Date.now()}.json`)
    document.body.appendChild(dlAnchor)
    dlAnchor.click()
    dlAnchor.remove()
  }

  return (
    <div className="space-y-4">
      {/* Top Controls: 3-Way Filter Tabs & Search */}
      <div className="bg-[#0b1018] border border-[#1e2d3d] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mr-1">
            Classification Filter:
          </span>

          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-1.5 ${
              filter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'bg-[#121a28] text-slate-300 hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <span>All Results</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${filter === 'ALL' ? 'bg-slate-900 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
              {reports.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('KNOWN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-1.5 ${
              filter === 'KNOWN'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-700/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Known ({knownCount})</span>
          </button>

          <button
            onClick={() => setFilter('UNKNOWN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-1.5 ${
              filter === 'UNKNOWN'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 border border-amber-700/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Unknown / Manipulated ({unknownCount})</span>
          </button>

          <button
            onClick={() => setFilter('NOT_SO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-1.5 ${
              filter === 'NOT_SO'
                ? 'bg-slate-400 text-slate-950 shadow-md font-bold'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Not So / Dissimilar ({notSoCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 10 reports..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#121a28] border border-slate-700/70 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 md:w-56"
            />
          </div>

          <button
            onClick={exportAllReportsJson}
            title="Download full 10 reports forensic JSON dossier"
            className="px-2.5 py-1.5 bg-[#121a28] hover:bg-slate-800 border border-slate-700/70 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Dossier</span>
          </button>
        </div>
      </div>

      {/* 10 Candidate Result Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredReports.map((report) => {
          const isSelected = activeCandidateId === report.id
          const isKnown = report.classification === 'KNOWN'
          const isUnknown = report.classification === 'UNKNOWN'
          const isNotSo = report.classification === 'NOT_SO'

          const borderColor = isSelected
            ? 'border-cyan-400 shadow-[0_0_16px_rgba(0,212,255,0.25)]'
            : isKnown
            ? 'border-emerald-800/40 hover:border-emerald-500/60'
            : isUnknown
            ? 'border-amber-800/40 hover:border-amber-500/60'
            : 'border-slate-800 hover:border-slate-700'

          const badgeBg = isKnown
            ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50'
            : isUnknown
            ? 'bg-amber-950 text-amber-300 border-amber-600/50'
            : 'bg-slate-900 text-slate-400 border-slate-700/50'

          return (
            <div
              key={report.id}
              className={`bg-[#0c121d] border rounded-xl p-3.5 flex flex-col justify-between transition relative overflow-hidden ${borderColor}`}
            >
              {/* Top Row: Index Badge, Title & 3-Way Classification Pill */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      #{report.candidateIndex}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100 truncate font-mono">
                      {report.title}
                    </h4>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${badgeBg}`}>
                    {isKnown && <CheckCircle2 className="w-3 h-3" />}
                    {isUnknown && <AlertTriangle className="w-3 h-3" />}
                    {isNotSo && <XCircle className="w-3 h-3" />}
                    {report.classificationLabel}
                  </span>
                </div>

                {/* Candidate Thumbnail & Key Metadata */}
                <div className="flex items-center gap-3 bg-[#080d16] p-2 rounded-lg border border-slate-800/60">
                  {report.thumbnailUrl || report.mediaUrl ? (
                    <img
                      src={report.thumbnailUrl || report.mediaUrl || ''}
                      alt={report.title}
                      className="w-14 h-14 object-cover rounded border border-slate-700/60 shrink-0 bg-slate-900"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-lg text-slate-500 shrink-0">
                      📄
                    </div>
                  )}

                  <div className="space-y-1 min-w-0 flex-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Match Score:</span>
                      <span className={`font-mono font-bold ${report.matchScore >= 90 ? 'text-emerald-400' : report.matchScore >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {report.matchScore}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Publisher:</span>
                      <span className="text-slate-200 font-semibold truncate max-w-[120px]">{report.publisher || report.domain}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Platform:</span>
                      <span className="text-cyan-400 font-mono text-[10px]">{report.platform}</span>
                    </div>
                  </div>
                </div>

                {/* Transformation Indicators Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] font-mono">
                  {report.transformations?.isCropped && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/40 text-amber-300">
                      ✂️ Cropped {report.transformations.cropPercentage}%
                    </span>
                  )}
                  {report.transformations?.isManipulated && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-700/40 text-rose-300">
                      🎭 Deepfake Alteration
                    </span>
                  )}
                  {report.transformations?.isRecompressed && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      🎨 Recompressed
                    </span>
                  )}
                  {report.provenance?.isEarliestAppearance && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                      ⭐ Earliest Known
                    </span>
                  )}
                  {isKnown && !report.transformations?.isCropped && !report.transformations?.isManipulated && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-600/40 text-emerald-300">
                      ✅ Authentic Mirror
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {report.classificationReason}
                </p>
              </div>

              {/* Bottom Actions: Compare & View In-Depth Report */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/80 gap-2">
                <button
                  onClick={() => onSelectCandidate(report)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                      : 'bg-[#131c2a] hover:bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Active In Dual-Pane' : 'Compare Side-by-Side'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {report.url && report.url !== '#' && (
                    <a
                      href={report.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 rounded transition"
                      title="Open source link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenModal(report)}
                    className="px-2.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono rounded-lg flex items-center gap-1 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Report #{report.candidateIndex}</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* In-Depth Comparative Report Modal */}
      {selectedReportForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1018] border border-[#1e2d3d] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-[#101827] to-[#0c121d] border-b border-[#1e2d3d] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-cyan-500 text-slate-950 font-mono text-xs font-bold flex items-center justify-center">
                  #{selectedReportForModal.candidateIndex}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Forensic Comparative Report #{selectedReportForModal.candidateIndex}
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{selectedReportForModal.publisher || selectedReportForModal.domain}</span>
                    <span>•</span>
                    <span>{selectedReportForModal.formattedDate || 'Recent'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedReportForModal(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* Section 1: Executive 3-Way Classification */}
              <div className="p-3.5 bg-[#080d16] border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    3-Way Grounded Decision
                  </div>
                  <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    {selectedReportForModal.classification === 'KNOWN' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                    {selectedReportForModal.classification === 'UNKNOWN' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {selectedReportForModal.classification === 'NOT_SO' && <HelpCircle className="w-4 h-4 text-slate-400" />}
                    <span>{selectedReportForModal.classificationLabel}</span>
                  </div>
                  <div className="text-slate-400 text-xs">
                    {selectedReportForModal.classificationReason}
                  </div>
                </div>

                <div className="text-right shrink-0 bg-[#0e1726] p-3 rounded-lg border border-cyan-900/40">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Grounded Similarity</div>
                  <div className="text-xl font-mono font-bold text-cyan-400">
                    {selectedReportForModal.matchScore}%
                  </div>
                </div>
              </div>

              {/* Section 2: Side-by-Side Visual Comparison Preview */}
              <div className="space-y-2">
                <div className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Visual Side-by-Side Comparison
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#080d16] border border-slate-800 rounded-lg p-2.5 space-y-2 text-center">
                    <div className="text-[11px] font-mono text-emerald-400 font-bold">Uploaded Reference</div>
                    {uploadedMediaUrl ? (
                      <img
                        src={uploadedMediaUrl}
                        alt="Uploaded Reference"
                        className="w-full h-36 object-contain rounded bg-slate-950 border border-slate-800"
                      />
                    ) : (
                      <div className="w-full h-36 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
                        Reference Media
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 truncate">{uploadedFilename}</div>
                  </div>

                  <div className="bg-[#080d16] border border-slate-800 rounded-lg p-2.5 space-y-2 text-center">
                    <div className="text-[11px] font-mono text-cyan-400 font-bold">Comparing Discovered Match</div>
                    {selectedReportForModal.thumbnailUrl || selectedReportForModal.mediaUrl ? (
                      <img
                        src={selectedReportForModal.thumbnailUrl || selectedReportForModal.mediaUrl || ''}
                        alt={selectedReportForModal.title}
                        className="w-full h-36 object-contain rounded bg-slate-950 border border-slate-800"
                      />
                    ) : (
                      <div className="w-full h-36 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
                        Discovered Match
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 truncate">{selectedReportForModal.domain}</div>
                  </div>
                </div>
              </div>

              {/* Section 3: Signal Delta Matrix */}
              <div className="space-y-2">
                <div className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Signal Delta & Forensic Measurements
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-[#080d16] p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">pHash Similarity</div>
                    <div className="font-mono font-bold text-slate-200">
                      {selectedReportForModal.phashSimilarity != null ? `${(selectedReportForModal.phashSimilarity * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>

                  <div className="bg-[#080d16] p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">Hamming Distance</div>
                    <div className="font-mono font-bold text-cyan-400">
                      {selectedReportForModal.hammingDistance != null ? `${selectedReportForModal.hammingDistance} / 64 bits` : '—'}
                    </div>
                  </div>

                  <div className="bg-[#080d16] p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">Crop Ratio</div>
                    <div className="font-mono font-bold text-amber-400">
                      {selectedReportForModal.transformations?.cropPercentage ? `${selectedReportForModal.transformations.cropPercentage}%` : 'None (1:1)'}
                    </div>
                  </div>

                  <div className="bg-[#080d16] p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">EXIF Consistency</div>
                    <div className="font-mono font-bold text-slate-200">
                      {selectedReportForModal.signalDelta?.exifConsistency || 'UNVERIFIED'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Transformation Details */}
              <div className="p-3 bg-[#080d16] border border-slate-800 rounded-xl space-y-2">
                <div className="font-mono text-xs font-bold text-slate-200 uppercase">
                  Detected Transformations
                </div>
                <ul className="space-y-1 text-slate-400 text-xs list-disc list-inside">
                  <li>{selectedReportForModal.transformations?.cropDetails || 'Aspect ratio intact.'}</li>
                  <li>{selectedReportForModal.transformations?.compressionDelta || 'Standard DCT quantization.'}</li>
                  {selectedReportForModal.transformations?.manipulationFlags?.map((flag, idx) => (
                    <li key={idx} className="text-rose-400">Anomaly flag: {flag}</li>
                  ))}
                </ul>
              </div>

              {/* Section 5: Legal & Rights Enforcement Recommendation */}
              <div className="p-3.5 bg-gradient-to-r from-[#0d1726] to-[#080d16] border border-cyan-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs font-bold text-cyan-400 uppercase">
                    Recommended Investigative Action
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                    {selectedReportForModal.recommendation?.riskTier || 'STANDARD'} RISK
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  {selectedReportForModal.recommendation?.rationale}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#080d16] border-t border-[#1e2d3d] flex items-center justify-between">
              <button
                onClick={() => {
                  onSelectCandidate(selectedReportForModal)
                  setSelectedReportForModal(null)
                }}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs rounded-lg flex items-center gap-1.5 transition"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Open in Dual-Pane Comparison</span>
              </button>

              <button
                onClick={() => setSelectedReportForModal(null)}
                className="px-4 py-2 bg-[#121a28] hover:bg-slate-800 text-slate-300 font-mono text-xs rounded-lg border border-slate-700 transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
