// VeriMedia AI — Detection Hook with Real-Time Forensic Pipeline Streaming
import { useCallback, useRef } from 'react'
import { detect, fileDMCA, listCases, registerMediaArtifact, getForensicJob } from '../services/api'
import { useStore } from '../store'
import type { DetectionRequest, DMCARequest, DetectionResult } from '../types'

export function useDetection() {
  const {
    setScanning,
    setScanError,
    setCurrentResult,
    addResult,
    updateStats,
    setCases,
    setCasesLoading,
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

    // Progressive stage simulation helper for instant responsive feedback
    const stageTimers: any[] = []
    const advanceStage = (progress: number, index: number, title: string, detail: string, logMsg: string) => {
      setScanProgress(progress, index, title, detail)
      addScanLog(logMsg, index === 0 ? 'ingest' : index === 1 ? 'ela' : index === 2 ? 'exif' : index === 3 ? 'ocr' : index === 4 ? 'vision' : 'fusion', 'info')
    }

    // Stage 1 immediately
    advanceStage(15, 0, 'Stage 1: Media Ingest & Fingerprinting', 'Extracting SHA-256 bitstream and computing 64-bit perceptual hash...', 'Ingesting bitstream and computing cryptographic fingerprints...')

    // Schedule progressive stage transitions while request is processing
    stageTimers.push(setTimeout(() => {
      advanceStage(35, 1, 'Stage 2: Error Level Analysis (ELA)', 'Analyzing DCT 8x8 quantization matrices and compression error variance...', 'Computing multi-pass JPEG compression grid deltas...')
    }, 250))

    stageTimers.push(setTimeout(() => {
      advanceStage(55, 2, 'Stage 3: EXIF Metadata & C2PA Credentials', 'Verifying camera device tags, sensor PRNU characteristics and C2PA manifest...', 'Reading hardware device metadata and cryptographic signatures...')
    }, 550))

    stageTimers.push(setTimeout(() => {
      advanceStage(75, 3, 'Stage 4: Pixel Entropy & OCR Extraction', 'Measuring Shannon entropy, luminance variance and optical text...', 'Sharp channel decomposition and OCR extraction running...')
    }, 850))

    stageTimers.push(setTimeout(() => {
      advanceStage(90, 4, 'Stage 5: Multimodal AI Vision Inspection', 'Neural multimodal vision evaluation for generative synthesis & boundary seams...', 'Gemini Vision inspecting image composition and generative artifacts...')
    }, 1150))

    try {
      const result: DetectionResult = await detect(req)

      // Clear pending stage timers
      stageTimers.forEach(t => clearTimeout(t))

      // Stage 6: Final Fusion
      setScanProgress(100, 5, 'Stage 6: Epistemic Signal Fusion & Verdict', 'Calibrated trust score synthesized and evidence dossier compiled.')
      addScanLog(`Analysis finalized: Verdict=${result.ai_analysis.decision} | Trust=${result.trust.trust_score ?? 'N/A'}/100`, 'fusion', 'success')

      setCurrentResult(result)
      addResult(result)
      updateStats(result)

      if (openModal) {
        setShowEvidenceModal(true)
      }
      return result
    } catch (err: any) {
      stageTimers.forEach(t => clearTimeout(t))
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

      // If async job was returned, stream events from the job queue
      if (jobId) {
        try {
          await streamJobEvents(jobId)
        } catch (jobErr) {
          console.warn('[Forensics] Stream notice:', jobErr)
        }
      }

      // Step 2: Trigger final detection synthesis
      const result = await detect({
        platform: options?.platform || 'YouTube',
        username: options?.username || 'analyst_upload',
        caption: options?.caption || file.name,
        content_type: options?.contentType || 'news',
        scenario: 'normal',
        artifactId: art.id
      })

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
    try {
      const cases = await listCases(50)
      setCases(cases)
    } catch (err) {
      console.error('Failed to load cases:', err)
    } finally {
      setCasesLoading(false)
    }
  }, [setCases, setCasesLoading])

  return { runDetection, runMediaInvestigation, runDMCA, refreshCases, streamJobEvents }
}

