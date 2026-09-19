import { useEffect } from 'react'
import { useStore } from '../store'
import { useDetection } from '../hooks/useDetection'
import { Sidebar } from '../components/layout/Sidebar'
import { HeaderBar } from '../components/layout/HeaderBar'
import { ScannerBar } from '../components/layout/ScannerBar'
import { FeedPanel } from '../components/panels/FeedPanel'
import { DetectionTrendChart } from '../components/charts/DetectionTrendChart'
import { PropagationGraph } from '../components/panels/PropagationGraph'
import { ForensicPanel } from '../components/panels/ForensicPanel'
import { OriginPanel } from '../components/panels/OriginPanel'
import { CasesPanel } from '../components/panels/CasesPanel'
import { SystemPanel } from '../components/panels/SystemPanel'
import { EvidenceModal } from '../components/modals/EvidenceModal'
import { DMCAModal } from '../components/modals/DMCAModal'
import { MonitoringJobModal } from '../components/modals/MonitoringJobModal'
import { HeroOverlay } from '../components/modals/HeroOverlay'
import { CommandPalette } from '../components/modals/CommandPalette'

export function Dashboard() {
  const {
    activeTab,
    showEvidenceModal, showDMCAModal, showMonitoringModal, showHeroOverlay,
    currentResult,
  } = useStore()

  const { runDetection } = useDetection()

  // Auto-run initial showcase scan on mount if no current result exists
  useEffect(() => {
    if (!currentResult) {
      runDetection({
        platform: 'YouTube',
        username: 'ai_generated_news',
        caption: 'BREAKING: exclusive leaked interview with the player!',
        content_type: 'news',
        scenario: 'deepfake',
      })
    }
  }, [])

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#080c10', color: '#f8fafc' }}>
      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <HeaderBar />

        {/* Content View Routing */}
        <main style={{ flex: 1, overflow: 'auto', padding: activeTab === 'scanner' ? '16px' : '0' }}>
          {/* Active Investigation Quick Context Ribbon */}
          {currentResult && activeTab === 'scanner' && (
            <div style={{
              marginBottom: 12,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(13, 17, 23, 0.95) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid #1e2d3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#00d4ff' }}>🎯 Active Investigation:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                  Job #{currentResult.job_id} · @{currentResult.username} ({currentResult.platform})
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: currentResult.ai_analysis.decision === 'ALLOW' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: currentResult.ai_analysis.decision === 'ALLOW' ? '#4ade80' : '#f87171',
                  border: `1px solid ${currentResult.ai_analysis.decision === 'ALLOW' ? '#22c55e' : '#ef4444'}40`
                }}>
                  {currentResult.ai_analysis.decision}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => useStore.getState().setActiveTab('forensic')}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#38bdf8',
                    padding: '3px 10px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  className="hover:border-cyan-400 hover:text-white"
                >
                  🔬 Forensic Matrix
                </button>

                <button
                  onClick={() => useStore.getState().setActiveTab('origin')}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#c084fc',
                    padding: '3px 10px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  className="hover:border-purple-400 hover:text-white"
                >
                  🔗 C2PA Lineage
                </button>

                <button
                  onClick={() => useStore.getState().setShowEvidenceModal(true)}
                  style={{
                    background: 'rgba(0, 212, 255, 0.15)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#38bdf8',
                    padding: '3px 10px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📄 Full Report
                </button>
              </div>
            </div>
          )}

          {/* Workspaces */}
          {activeTab === 'scanner' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Top Scanner Input Bar */}
              <ScannerBar />

              {/* Main Split: Left Propagation Mesh, Right Live Ingestion Feed */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, minHeight: 480, overflow: 'hidden' }}>
                <div style={{
                  background: '#0d1117',
                  border: '1px solid #1e2d3d',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}>
                  <PropagationGraph />
                </div>

                <div style={{
                  background: '#0d1117',
                  border: '1px solid #1e2d3d',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}>
                  <FeedPanel />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'propagation' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#080c10' }}>
              <PropagationGraph />
            </div>
          )}

          {activeTab === 'forensic' && (
            <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              <ForensicPanel />
            </div>
          )}

          {activeTab === 'origin' && (
            <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              <OriginPanel />
            </div>
          )}

          {activeTab === 'cases' && (
            <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              <CasesPanel />
            </div>
          )}

          {activeTab === 'trends' && (
            <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              <DetectionTrendChart />
            </div>
          )}

          {activeTab === 'system' && (
            <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              <SystemPanel />
            </div>
          )}

          {activeTab === 'feed' && (
            <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
              <FeedPanel />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showEvidenceModal && currentResult && (
        <EvidenceModal result={currentResult} />
      )}
      {showDMCAModal && <DMCAModal />}
      {showMonitoringModal && <MonitoringJobModal />}
      {showHeroOverlay && <HeroOverlay />}
      <CommandPalette />
    </div>
  )
}
