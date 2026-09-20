// VeriMedia AI — Simple Mode front door for non-technical users.
// Calls the same real backend pipelines (upload → forensic job → discovery → compare)
// used by the full analyst dashboard, but surfaces only plain-language results.
import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import {
  uploadArtifactAsync,
  pollForensicJob,
  runDiscoveryJob,
  getInvestigationCandidates,
  compareArtifacts,
  getApiBaseUrl,
} from '../services/api'

// ---------------------------------------------------------------------------
// Plain-language label mappings
// ---------------------------------------------------------------------------

const VERDICT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  GENUINE:             { label: 'Looks authentic',                  color: '#15803d', bg: '#f0fdf4' },
  AI_GENERATED:        { label: 'Likely AI-generated',             color: '#92400e', bg: '#fffbeb' },
  DEEPFAKE_MANIPULATED:{ label: 'Signs of manipulation detected',  color: '#991b1b', bg: '#fff1f2' },
  SPLICED_COMPOSITE:   { label: 'Signs of editing detected',       color: '#991b1b', bg: '#fff1f2' },
  TAMPERED:            { label: 'Signs of editing detected',       color: '#991b1b', bg: '#fff1f2' },
  MANIPULATED:         { label: 'Signs of editing detected',       color: '#991b1b', bg: '#fff1f2' },
  INCONCLUSIVE:        { label: 'Inconclusive — needs a closer look', color: '#1d4ed8', bg: '#eff6ff' },
  SKIPPED:             { label: 'File type not supported for visual analysis', color: '#374151', bg: '#f9fafb' },
}

function getVerdict(authenticity: string | null | undefined) {
  if (!authenticity) return VERDICT_MAP.INCONCLUSIVE
  return VERDICT_MAP[authenticity.toUpperCase()] ?? VERDICT_MAP.INCONCLUSIVE
}

const CANDIDATE_RELATIONSHIP_MAP: Record<string, string> = {
  EXACT_OR_NEAR_MATCH: 'Same content',
  TRANSFORMED_VERSION: 'Modified version',
  POSSIBLE_VARIANT:    'Possibly related',
  POSSIBLE_MATCH:      'Possibly related',
  LOW_SIMILARITY:      'Not a strong match',
  UNRELATED:           'Not a strong match',
}

function plainRelationship(rel: string | null | undefined): string {
  if (!rel) return 'Possibly related'
  return CANDIDATE_RELATIONSHIP_MAP[rel.toUpperCase()] ?? rel
}

const COMPARE_RELATIONSHIP_MAP: Record<string, string> = {
  IDENTICAL:           'Same content',
  NEAR_DUPLICATE:      'Same content',
  TRANSFORMED_VERSION: 'Likely transformed version',
  LIKELY_DERIVATIVE:   'Likely transformed version',
  DIFFERENT_CONTENT:   'Different content',
  INCONCLUSIVE:        'Inconclusive',
}

function plainCompareRelationship(rel: string | null | undefined): string {
  if (!rel) return 'Inconclusive'
  return COMPARE_RELATIONSHIP_MAP[rel.toUpperCase()] ?? rel
}

// Plain-language bullets from a forensic job result
function buildResultBullets(jobResult: any): string[] {
  if (!jobResult) return []
  const bullets: string[] = []

  // ELA compression anomaly
  const ela = jobResult.elaResult ?? jobResult.ela
  if (ela?.hasCompressionAnomaly === true) {
    bullets.push('Compression pattern looks edited — areas show inconsistent re-saving traces.')
  } else if (ela?.status === 'COMPLETED' && ela.hasCompressionAnomaly === false) {
    bullets.push('Compression pattern looks uniform across the file.')
  }

  // EXIF editing software
  const exif = jobResult.exif ?? jobResult.exifMetadata
  if (exif) {
    const sw = exif.Software || exif.ProcessingSoftware || exif.SoftwareAgent || ''
    const lower = typeof sw === 'string' ? sw.toLowerCase() : ''
    if (['photoshop', 'gimp', 'canva', 'lightroom', 'affinity', 'snapseed'].some(e => lower.includes(e))) {
      bullets.push(`File metadata shows editing software: "${sw}".`)
    }
    if (exif.Make || exif.Model) {
      bullets.push(`Camera metadata present: ${[exif.Make, exif.Model].filter(Boolean).join(' ')}.`)
    }
  }

  // Visual findings (already human-readable strings from Gemini)
  const findings: string[] = Array.isArray(jobResult.visualFindings)
    ? jobResult.visualFindings
    : Array.isArray(jobResult.keyInsights)
      ? jobResult.keyInsights
      : []
  for (const f of findings.slice(0, 3 - bullets.length)) {
    if (f && typeof f === 'string' && !bullets.includes(f)) {
      bullets.push(f)
    }
  }

  return bullets.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DropZone({
  label,
  onFile,
  disabled,
  previewUrl,
  sublabel,
}: {
  label: string
  onFile: (f: File) => void
  disabled?: boolean
  previewUrl?: string | null
  sublabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        'border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none',
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        previewUrl ? 'p-2' : 'p-10',
      ].join(' ')}
      style={{ minHeight: previewUrl ? 120 : 180 }}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Preview"
          className="max-h-40 rounded-xl object-contain"
        />
      ) : (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm font-semibold text-gray-600">{label}</p>
          {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}

function VerdictBadge({ authenticity }: { authenticity: string | null | undefined }) {
  const v = getVerdict(authenticity)
  return (
    <span
      className="inline-block text-sm font-semibold rounded-full px-4 py-1"
      style={{ color: v.color, background: v.bg, border: `1px solid ${v.color}30` }}
    >
      {v.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main SimpleView
// ---------------------------------------------------------------------------

type Phase = 'upload' | 'analyzing' | 'result'

interface AnalysisState {
  jobResult: any
  artifactId: string
  investigationId: string
  previewUrl: string | null
  geminiConfigured: boolean
}

export function SimpleView() {
  const { setViewMode } = useStore()

  // Step 1 — upload + analyze
  const [phase, setPhase] = useState<Phase>('upload')
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)

  // Step 2 — show/hide technical details
  const [showTechnical, setShowTechnical] = useState(false)

  // Step 3a — discovery
  const [discoveryPhase, setDiscoveryPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [candidates, setCandidates] = useState<any[] | null>(null)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)

  // Step 3b — compare
  const [comparePhase, setComparePhase] = useState<'idle' | 'awaiting-upload' | 'uploading' | 'comparing' | 'done'>('idle')
  const [comparePreviewUrl, setComparePreviewUrl] = useState<string | null>(null)
  const [compareResult, setCompareResult] = useState<any | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)

  // ----- Step 1: upload + analyze -----
  const handleFileSelect = async (file: File) => {
    setError(null)
    setPhase('analyzing')

    let previewUrl: string | null = null
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file)
    }

    try {
      // 1. Upload — calls real backend; kicks off ELA + EXIF + stats + Gemini vision
      const uploadRes = await uploadArtifactAsync(file)
      const jobId: string = uploadRes?.jobId ?? uploadRes?.job?.id
      const artifactId: string = uploadRes?.artifact?.id ?? uploadRes?.artifactId
      const investigationId: string = uploadRes?.job?.investigationId ?? uploadRes?.investigationId

      if (!jobId) throw new Error('Upload did not return a job ID.')

      // 2. Poll until the forensic job completes (up to 60 s)
      const job = await pollForensicJob(jobId, 60_000, 1500)
      const jobResult = job?.result ?? {}

      // Heuristic: if Gemini ran, the result will have an `authenticity` field with a string label
      const geminiConfigured = !!(
        jobResult.authenticity &&
        typeof jobResult.authenticity === 'string' &&
        jobResult.authenticity !== 'INCONCLUSIVE' ||
        jobResult.summary
      )

      setAnalysis({ jobResult, artifactId, investigationId, previewUrl, geminiConfigured })
      setPhase('result')
    } catch (err: any) {
      setError(err?.message ?? 'Analysis failed. Please try again.')
      setPhase('upload')
    }
  }

  // ----- Step 3a: discovery -----
  const handleDiscover = async () => {
    if (!analysis) return
    setDiscoveryPhase('running')
    setDiscoveryError(null)
    setCandidates(null)
    try {
      // Kick off a discovery job; server will search configured providers
      await runDiscoveryJob(analysis.investigationId)
      // Fetch the resulting candidates
      const raw = await getInvestigationCandidates(analysis.investigationId)
      const list: any[] = Array.isArray(raw) ? raw : (raw?.candidates ?? [])
      setCandidates(list)
      setDiscoveryPhase('done')
    } catch (err: any) {
      setDiscoveryError(err?.message ?? 'Discovery failed.')
      setDiscoveryPhase('done')
      setCandidates([])
    }
  }

  // ----- Step 3b: compare -----
  const handleCompareFileSelect = async (file: File) => {
    if (!analysis) return
    setCompareError(null)
    setComparePhase('uploading')

    let prevUrl: string | null = null
    if (file.type.startsWith('image/')) {
      prevUrl = URL.createObjectURL(file)
      setComparePreviewUrl(prevUrl)
    }

    try {
      // Upload the second file first so we get its artifactId
      const uploadRes = await uploadArtifactAsync(file, analysis.investigationId)
      const artifactBId: string = uploadRes?.artifact?.id ?? uploadRes?.artifactId
      if (!artifactBId) throw new Error('Could not register second file.')

      setComparePhase('comparing')
      const result = await compareArtifacts(analysis.artifactId, artifactBId, analysis.investigationId)
      setCompareResult(result)
      setComparePhase('done')
    } catch (err: any) {
      setCompareError(err?.message ?? 'Comparison failed.')
      setComparePhase('done')
    }
  }

  const base = getApiBaseUrl()
  const artifactImageUrl = analysis?.artifactId
    ? `${base}/api/artifacts/${analysis.artifactId}/file`
    : null

  // ----- Render -----
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#1e293b" />
            <text x="50%" y="56%" fontFamily="monospace" fontSize="18" fontWeight="bold" fill="#38bdf8" textAnchor="middle" dominantBaseline="middle">V</text>
          </svg>
          <span className="font-semibold text-gray-800 text-base">VeriMedia AI</span>
        </div>
        <button
          onClick={() => setViewMode('advanced')}
          className="text-xs text-gray-400 hover:text-blue-600 transition-colors underline underline-offset-2"
        >
          Advanced view →
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* ── Step 1: Upload ── */}
        {phase === 'upload' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check a photo or video</h1>
              <p className="text-gray-500 text-sm">Upload a file and we'll run forensic checks to look for signs of AI generation, editing, or manipulation.</p>
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <DropZone
              label="Upload a photo or video to check it"
              sublabel="JPG, PNG, WebP, MP4 — up to 100 MB"
              onFile={handleFileSelect}
            />
          </div>
        )}

        {/* ── Step 1: Analyzing ── */}
        {phase === 'analyzing' && (
          <Spinner label="Analyzing your file — this takes up to 30 seconds…" />
        )}

        {/* ── Step 2: Result ── */}
        {phase === 'result' && analysis && (() => {
          const { jobResult, previewUrl, geminiConfigured } = analysis
          const authenticity: string = jobResult?.authenticity ?? ''
          const bullets = buildResultBullets(jobResult)
          const summary: string = jobResult?.summary ?? jobResult?.verdict ?? ''
          const confidenceSource = geminiConfigured
            ? null
            : 'Based on file-level forensic checks (AI visual review not configured).'

          return (
            <div className="flex flex-col gap-8">

              {/* Result card */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Preview */}
                {(previewUrl || artifactImageUrl) && (
                  <img
                    src={previewUrl ?? artifactImageUrl!}
                    alt="Uploaded file"
                    className="w-full max-h-64 object-contain bg-gray-50"
                  />
                )}

                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <VerdictBadge authenticity={authenticity || (jobResult?.status === 'SKIPPED' ? 'SKIPPED' : null)} />
                  </div>

                  {confidenceSource && (
                    <p className="text-xs text-gray-400 italic">{confidenceSource}</p>
                  )}

                  {summary && (
                    <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
                  )}

                  {bullets.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-600">
                          <span className="mt-0.5 text-gray-400 shrink-0">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Technical details toggle */}
                  <button
                    onClick={() => setShowTechnical(v => !v)}
                    className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2 text-left w-fit mt-1"
                  >
                    {showTechnical ? 'Hide technical details ↑' : 'Show technical details ↓'}
                  </button>

                  {showTechnical && (
                    <pre className="text-xs text-gray-500 bg-gray-50 rounded-xl p-4 overflow-auto max-h-96 border border-gray-100 whitespace-pre-wrap break-words">
                      {JSON.stringify(jobResult, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {/* ── Step 3: Contextual actions ── */}
              <div className="flex flex-col gap-6">

                {/* ── 3a: Discovery ── */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Check if this appeared anywhere else</p>
                    <p className="text-xs text-gray-500 mt-1">Search configured discovery providers for matching or similar content online.</p>
                  </div>

                  {discoveryPhase === 'idle' && (
                    <button
                      onClick={handleDiscover}
                      className="self-start bg-gray-900 text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-gray-700 transition-colors"
                    >
                      Search for matches online
                    </button>
                  )}

                  {discoveryPhase === 'running' && (
                    <Spinner label="Searching for matches online…" />
                  )}

                  {discoveryPhase === 'done' && (
                    <>
                      {discoveryError && (
                        <p className="text-sm text-gray-500 italic">
                          External discovery encountered an error: {discoveryError}. Local analysis above still stands.
                        </p>
                      )}
                      {!discoveryError && candidates && candidates.length === 0 && (
                        <p className="text-sm text-gray-500 italic">
                          External discovery found no matches. Local analysis above still stands.
                        </p>
                      )}
                      {!discoveryError && candidates && candidates.length > 0 && (
                        <div className="flex flex-col gap-3">
                          {candidates.map((c: any, i: number) => (
                            <CandidateCard key={c.id ?? i} candidate={c} />
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => { setDiscoveryPhase('idle'); setCandidates(null) }}
                        className="text-xs text-gray-400 hover:text-blue-500 underline underline-offset-2 w-fit"
                      >
                        Search again
                      </button>
                    </>
                  )}
                </div>

                {/* ── 3b: Compare ── */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Compare against another version</p>
                    <p className="text-xs text-gray-500 mt-1">Upload a second file to compare it against your reference media.</p>
                  </div>

                  {comparePhase === 'idle' && (
                    <button
                      onClick={() => setComparePhase('awaiting-upload')}
                      className="self-start bg-gray-900 text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-gray-700 transition-colors"
                    >
                      Upload a version to compare
                    </button>
                  )}

                  {comparePhase === 'awaiting-upload' && (
                    <div className="flex flex-col gap-3">
                      <ComparisonThumbnails
                        referenceUrl={previewUrl ?? artifactImageUrl}
                        suspectedUrl={null}
                        referenceLabel="Reference Media"
                        suspectedLabel="Upload here…"
                      />
                      <DropZone
                        label="Upload the version you want to compare this against"
                        sublabel="This is 'Suspected Media' — not assumed to be authentic"
                        onFile={handleCompareFileSelect}
                      />
                    </div>
                  )}

                  {(comparePhase === 'uploading' || comparePhase === 'comparing') && (
                    <Spinner label={comparePhase === 'uploading' ? 'Uploading second file…' : 'Comparing files…'} />
                  )}

                  {comparePhase === 'done' && (
                    <CompareResult
                      result={compareResult}
                      error={compareError}
                      referenceUrl={previewUrl ?? artifactImageUrl}
                      suspectedUrl={comparePreviewUrl}
                      onReset={() => { setComparePhase('idle'); setCompareResult(null); setCompareError(null); setComparePreviewUrl(null) }}
                    />
                  )}
                </div>
              </div>

              {/* Start over */}
              <button
                onClick={() => {
                  setPhase('upload')
                  setAnalysis(null)
                  setError(null)
                  setShowTechnical(false)
                  setDiscoveryPhase('idle')
                  setCandidates(null)
                  setDiscoveryError(null)
                  setComparePhase('idle')
                  setCompareResult(null)
                  setCompareError(null)
                  setComparePreviewUrl(null)
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 w-fit"
              >
                ← Check a different file
              </button>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CandidateCard
// ---------------------------------------------------------------------------

function CandidateCard({ candidate }: { candidate: any }) {
  const url: string = candidate.url ?? candidate.canonicalUrl ?? ''
  const domain: string = candidate.domain ?? candidate.sourceDomain ?? (url ? new URL(url).hostname : '') ?? ''
  const publishedAt: string | null = candidate.publishedAt ?? candidate.discoveredAt ?? null
  const relationship: string = plainRelationship(candidate.matchStrategy ?? candidate.relationshipType ?? candidate.relationship)
  const thumbnail: string | null = candidate.thumbnailUrl ?? candidate.thumbnail ?? null
  const similarity: number | null = candidate.similarityScore ?? candidate.similarity ?? null

  return (
    <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
      {thumbnail && (
        <img src={thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 bg-gray-100" />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-xs font-semibold text-gray-700 truncate">{domain || 'Unknown source'}</span>
        <span className="text-xs text-gray-400">{relationship}</span>
        {similarity !== null && (
          <span className="text-xs text-gray-400">Similarity: {Math.round(similarity * 100)}%</span>
        )}
        {publishedAt && (
          <span className="text-xs text-gray-400">{new Date(publishedAt).toLocaleDateString()}</span>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate">
            {url}
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ComparisonThumbnails
// ---------------------------------------------------------------------------

function ComparisonThumbnails({
  referenceUrl,
  suspectedUrl,
  referenceLabel,
  suspectedLabel,
}: {
  referenceUrl: string | null | undefined
  suspectedUrl: string | null | undefined
  referenceLabel: string
  suspectedLabel: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { url: referenceUrl, label: referenceLabel },
        { url: suspectedUrl, label: suspectedLabel },
      ].map(({ url, label }, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
            {url
              ? <img src={url} alt={label} className="w-full h-full object-contain" />
              : <span className="text-xs text-gray-400">{label}</span>}
          </div>
          <span className="text-xs text-gray-500 text-center">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompareResult
// ---------------------------------------------------------------------------

function CompareResult({
  result,
  error,
  referenceUrl,
  suspectedUrl,
  onReset,
}: {
  result: any
  error: string | null
  referenceUrl: string | null | undefined
  suspectedUrl: string | null | undefined
  onReset: () => void
}) {
  const relationship = plainCompareRelationship(result?.relationship ?? result?.relationshipType)
  const transformations: string[] = Array.isArray(result?.transformations)
    ? result.transformations
    : Array.isArray(result?.transformationIndicators)
      ? result.transformationIndicators
      : []
  const limitations: string[] = Array.isArray(result?.limitations) ? result.limitations : []

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600 italic">{error}</p>
      )}
      {result && (
        <>
          <ComparisonThumbnails
            referenceUrl={referenceUrl}
            suspectedUrl={suspectedUrl}
            referenceLabel="Reference Media"
            suspectedLabel="Suspected Media"
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Relationship</span>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{relationship}</p>
            </div>
            {transformations.length > 0 && (
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">What changed</span>
                <ul className="mt-1 flex flex-col gap-1">
                  {transformations.map((t: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {limitations.length > 0 && (
              <p className="text-xs text-gray-400 italic mt-1">{limitations[0]}</p>
            )}
          </div>
        </>
      )}
      <button
        onClick={onReset}
        className="text-xs text-gray-400 hover:text-blue-500 underline underline-offset-2 w-fit"
      >
        Compare a different file
      </button>
    </div>
  )
}
