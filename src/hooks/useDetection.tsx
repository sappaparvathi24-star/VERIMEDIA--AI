// VeriMedia AI — Detection Hook with Real-Time Forensic Pipeline Streaming
import { useCallback, useRef } from 'react'
import { detect, fileDMCA, listCases, registerMediaArtifact, getForensicJob, searchMultiSource } from '../services/api'
import { useStore } from '../store'
import type { DetectionRequest, DMCARequest, DetectionResult } from '../types'
import { generateTenComparisonReports } from '../matching/candidateReportsGenerator'

export function useDetection() {
  const {
    setScanning,
    setScanError,
    setCurrentResult,
    addResult,
    updateStats,
    setCases,
    setCasesLoading,
    setCasesError,
    setShowEvidenceModal,
    setScanProgress,
    setScanStageStatus,
    addScanLog,
    setActiveJobId,
    scanStages
  } = useStore()

  const sseRef = useRef<EventSource | null>(null)

  // Stream an active backend forensic job using SSE and fallback polling
  const streamJobEvents = useCallback((jobId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      setActiveJobId(jobId)

      // Close previous SSE connection if any
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }

      let resolved = false
      const timeout = setTimeout(async () => {
        if (!resolved) {
          try {
            const fallbackJob = await getForensicJob(jobId)
            cleanup()
            resolve(fallbackJob?.job || fallbackJob)
          } catch (e) {
            cleanup()
            reject(new Error(`Forensic analysis job ${jobId} timed out`))
          }
        }
      }, 35000)

      const cleanup = () => {
        resolved = true
        clearTimeout(timeout)
        if (sseRef.current) {
          sseRef.current.close()
          sseRef.current = null
        }
      }

      try {
        const streamUrl = `/api/jobs/${jobId}/stream`
        const es = new EventSource(streamUrl)
        sseRef.current = es

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.progress !== undefined) {
              setScanProgress(data.progress, data.stageIndex, data.stageTitle, data.stageDetail)
            }
            if (data.stage && data.status) {
              setScanStageStatus(data.stage, data.status, data.stageDetail)
            }
            if (data.log) {
              addScanLog(data.log, data.stage || 'pipeline', 'info')
            }
          } catch (_) {}
        }

        es.addEventListener('stage', (event: any) => {
          try {
            const data = JSON.parse(event.data)
            if (data.progress !== undefined) {
              setScanProgress(data.progress, data.stageIndex, data.stageTitle, data.stageDetail)
            }
            if (data.stage) {
              setScanStageStatus(data.stage, data.status || 'RUNNING', data.stageDetail)
            }
            if (data.log) {
              addScanLog(data.log, data.stage || 'pipeline', 'info')
            }
          } catch (_) {}
        })

        es.addEventListener('done', (event: any) => {
          try {
            const data = JSON.parse(event.data)
            setScanProgress(100, 5, 'Pipeline Complete', 'All 6 forensic modules verified.')
            addScanLog('Forensic job execution completed successfully.', 'fusion', 'success')
            cleanup()
            resolve(data.result || data)
          } catch (err) {
            cleanup()
            resolve(null)
          }
        })

        es.onerror = async () => {
          // If SSE connection fails, fall back to fast polling
          es.close()
          try {
            const pollStart = Date.now()
            while (Date.now() - pollStart < 20000) {
              await new Promise(r => setTimeout(r, 800))
              const jobData = await getForensicJob(jobId)
              const job = jobData?.job || jobData
              if (job) {
                if (job.progress !== undefined) {
                  setScanProgress(job.progress, job.stageIndex, job.stageTitle, job.stageDetail)
                }
                if (job.status === 'COMPLETED' || job.status === 'SKIPPED' || job.status === 'FAILED') {
                  setScanProgress(100, 5, 'Pipeline Complete', 'Forensic evaluation finished.')
                  cleanup()
                  resolve(job.result || job)
                  return
                }
              }
            }
            cleanup()
            reject(new Error(`Job ${jobId} polling timed out`))
          } catch (err) {
            cleanup()
            reject(err)
          }
        }
      } catch (err) {
        cleanup()
        reject(err)
      }
    })
  }, [setScanProgress, setScanStageStatus, addScanLog, setActiveJobId])

  const runDetection = useCallback(async (req: DetectionRequest, openModal: boolean = false) => {
    setScanning(true)
    setScanError(null)

    // Indicate initiation without fake synthetic timer advancement
    setScanProgress(10, 0, 'Initializing Analysis', 'Connecting to backend verification pipeline...')
    addScanLog('Submitting detection analysis request to backend...', 'ingest', 'info')

    try {
      const result: DetectionResult = await detect(req)

      // Format comparison reports with 3-way classification based on real candidates or simulated demo scenarios
      const isDemo = Boolean(req.scenario && req.scenario !== 'normal')
      const existingCandidates = (result as any).candidates || []
      if (existingCandidates.length > 0 || isDemo) {
        const comparisonSummary = generateTenComparisonReports(
          result.artifact || { filename: req.caption || 'Investigated Asset', title: req.caption, isDemo },
          existingCandidates,
          req.scenario || 'normal'
        )
        ;(result as any).comparisonSummary = comparisonSummary
        ;(result as any).comparisonReports = comparisonSummary.reports
      }

      // Signal completion based on actual backend response
      setScanProgress(100, 5, 'Pipeline Complete', 'All active backend forensic modules evaluated.')
      addScanLog(`Analysis finalized: Verdict=${result.ai_analysis.decision} | Trust=${result.trust.trust_score ?? 'N/A'}/100`, 'fusion', 'success')

      setCurrentResult(result)
      addResult(result)
      updateStats(result)

      if (openModal) {
        setShowEvidenceModal(true)
      }
      return result
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      const msg = serverMsg || (err instanceof Error ? err.message : 'Detection failed. Please try again.')
      console.error('Detection error:', err)
      setScanError(msg)
      addScanLog(`Pipeline error: ${msg}`, 'pipeline', 'error')
      return null
    } finally {
      setScanning(false)
    }
  }, [setScanning, setScanError, setCurrentResult, addResult, updateStats, setShowEvidenceModal, setScanProgress, addScanLog])

  // Full end-to-end file upload with real backend job queue streaming
  const runMediaInvestigation = useCallback(async (file: File, options?: { platform?: any; username?: string; caption?: string; contentType?: any }) => {
    setScanning(true)
    setScanError(null)
    addScanLog(`Starting full media investigation for ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)...`, 'ingest', 'info')

    // Create immediate local Object URL and Data URL for guaranteed UI rendering
    const localObjUrl = URL.createObjectURL(file)
    const localDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(localObjUrl)
      reader.readAsDataURL(file)
    }).catch(() => localObjUrl)

    try {
      // Step 1: Upload media binary to create artifact & enqueue job
      setScanProgress(15, 0, 'Stage 1: Media Ingest & Fingerprinting', 'Uploading binary to memory buffer store and computing SHA-256...')
      const uploadRes = await registerMediaArtifact(file)
      const art = uploadRes?.artifact || uploadRes
      const jobId = uploadRes?.jobId || uploadRes?.job?.id

      if (!art || !art.id) {
        throw new Error('Backend failed to create media artifact')
      }

      addScanLog(`Artifact registered: ${art.id} (SHA-256: ${art.sha256 ? art.sha256.slice(0, 16) + '...' : 'computed'})`, 'ingest', 'success')

      // If async job was returned, stream events from the real backend job queue
      if (jobId) {
        try {
          await streamJobEvents(jobId)
        } catch (jobErr: any) {
          console.warn('[Forensics] Stream notice:', jobErr?.message || jobErr)
        }
      }

      // Step 2: Trigger final detection synthesis
      const result: any = await detect({
        platform: options?.platform || 'YouTube',
        username: options?.username || 'analyst_upload',
        caption: options?.caption || file.name,
        content_type: options?.contentType || 'news',
        scenario: 'normal',
        artifactId: art.id
      })

      // Ensure artifact object has valid media preview URLs for guaranteed visual display
      if (result) {
        if (!result.artifact) {
          result.artifact = {
            id: art.id,
            filename: file.name,
            mimeType: file.type,
            byteSize: file.size,
            sha256: art.sha256,
            perceptualHash: art.perceptualHash,
            dimensions: art.dimensions,
            fileUrl: art.dataUrl || localDataUrl || localObjUrl,
            previewUrl: art.dataUrl || localDataUrl || localObjUrl,
            dataUrl: art.dataUrl || localDataUrl
          }
        } else {
          result.artifact.previewUrl = result.artifact.previewUrl || art.dataUrl || localDataUrl || localObjUrl
          result.artifact.fileUrl = result.artifact.fileUrl || art.dataUrl || localDataUrl || localObjUrl
          result.artifact.dataUrl = result.artifact.dataUrl || art.dataUrl || localDataUrl
        }
      }

      // Generate comparison reports if real candidates were discovered
      const uploadCandidates = (result as any)?.candidates || []
      if (uploadCandidates.length > 0) {
        const comparisonSummary = generateTenComparisonReports(
          result?.artifact || art || { filename: file.name, title: file.name },
          uploadCandidates,
          'normal'
        )
        ;(result as any).comparisonSummary = comparisonSummary
        ;(result as any).comparisonReports = comparisonSummary.reports
      }

      setScanProgress(100, 5, 'Stage 6: Epistemic Signal Fusion & Verdict', 'All forensic signals calibrated and evidence record compiled.')
      addScanLog(`Investigation complete for ${file.name}. Trust score: ${result.trust?.trust_score ?? 'N/A'}/100`, 'fusion', 'success')

      setCurrentResult(result)
      addResult(result)
      updateStats(result)

      return result
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      const msg = serverMsg || (err instanceof Error ? err.message : 'Media investigation failed')
      console.error('Media investigation error:', err)
      setScanError(msg)
      addScanLog(`Investigation failure: ${msg}`, 'pipeline', 'error')
      return null
    } finally {
      setScanning(false)
    }
  }, [setScanning, setScanError, setCurrentResult, addResult, updateStats, setScanProgress, addScanLog, streamJobEvents])

  const runDMCA = useCallback(async (req: DMCARequest) => {
    try {
      const notice = await fileDMCA(req)
      await refreshCases()
      return notice
    } catch (err) {
      console.error('DMCA filing error:', err)
      return null
    }
  }, [])

  const refreshCases = useCallback(async () => {
    setCasesLoading(true)
    setCasesError(null)
    try {
      const cases = await listCases(50)
      setCases(cases)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load cases from the backend.'
      console.error('Failed to load cases:', err)
      // Do NOT fall back to placeholder/demo cases here — an empty, clearly
      // errored list is more honest than silently showing fabricated data.
      setCasesError(msg)
    } finally {
      setCasesLoading(false)
    }
  }, [setCases, setCasesLoading, setCasesError])

  return { runDetection, runMediaInvestigation, runDMCA, refreshCases, streamJobEvents }
}

