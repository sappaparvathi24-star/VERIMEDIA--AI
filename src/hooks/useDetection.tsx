// VeriMedia AI — Detection Hook
import { useCallback } from 'react'
import { detect, fileDMCA, listCases } from '../services/api'
import { useStore } from '../store'
import type { DetectionRequest, DMCARequest } from '../types'

export function useDetection() {
  const {
    setScanning, setScanError, setCurrentResult,
    addResult, updateStats, setCases, setCasesLoading,
    setShowEvidenceModal,
  } = useStore()

  const runDetection = useCallback(async (req: DetectionRequest, openModal: boolean = false) => {
    setScanning(true)
    setScanError(null)
    try {
      const result = await detect(req)
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
      return null
    } finally {
      setScanning(false)
    }
  }, [setScanning, setScanError, setCurrentResult, addResult, updateStats, setShowEvidenceModal])

  const runDMCA = useCallback(async (req: DMCARequest) => {
    try {
      const notice = await fileDMCA(req)
      // Refresh cases after DMCA
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

  return { runDetection, runDMCA, refreshCases }
}
