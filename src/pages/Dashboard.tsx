import { useState } from 'react'
import { useStore } from '../store'
import { Sidebar } from '../components/layout/Sidebar'
import { HeaderBar } from '../components/layout/HeaderBar'
import { GlobalProgressBar } from '../components/common/GlobalProgressBar'
import { InvestigationFlow } from '../components/scanner/InvestigationFlow'
import { FeedPanel } from '../components/panels/FeedPanel'
import { DetectionTrendChart } from '../components/charts/DetectionTrendChart'
import { PropagationGraph } from '../components/panels/PropagationGraph'
import { ForensicPanel } from '../components/panels/ForensicPanel'
import { DiscoveryPanel } from '../components/panels/DiscoveryPanel'
import { OriginPanel } from '../components/panels/OriginPanel'
import { EvidenceReasoningPanel } from '../components/panels/EvidenceReasoningPanel'
import { CasesPanel } from '../components/panels/CasesPanel'
import { SystemPanel } from '../components/panels/SystemPanel'
import { GeminiIntelligencePanel } from '../components/panels/GeminiIntelligencePanel'
import { DebugPanel } from '../components/panels/DebugPanel'
import { EvidenceModal } from '../components/modals/EvidenceModal'
import { DMCAModal } from '../components/modals/DMCAModal'
import { MonitoringJobModal } from '../components/modals/MonitoringJobModal'
import { HeroOverlay } from '../components/modals/HeroOverlay'
import { CommandPalette } from '../components/modals/CommandPalette'
import { ClaimVerificationModal } from '../components/modals/ClaimVerificationModal'
import { VerificationHistorySidePanel } from '../components/layout/VerificationHistorySidePanel'

export function Dashboard() {
  const {
    activeTab,
    showEvidenceModal, showDMCAModal, showMonitoringModal, showHeroOverlay,
    currentResult,
  } = useStore()

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#080c10', color: '#f8fafc' }}>
      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <HeaderBar />
        <GlobalProgressBar />

        {/* Content View Routing & Side-Panel */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0 }}>
            {/* Workspaces */}
            {activeTab === 'scanner' && (
              <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <InvestigationFlow />
              </div>
            )}

            {activeTab === 'intelligence' && (
              <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <GeminiIntelligencePanel />
              </div>
            )}

            {activeTab === 'forensic' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <ForensicPanel />
              </div>
            )}

            {activeTab === 'discovery' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <DiscoveryPanel />
              </div>
            )}

            {activeTab === 'origin' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <OriginPanel />
              </div>
            )}

            {activeTab === 'propagation' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#080c10' }}>
                <PropagationGraph />
              </div>
            )}

            {activeTab === 'reasoning' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <EvidenceReasoningPanel />
              </div>
            )}

            {activeTab === 'cases' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <CasesPanel />
              </div>
            )}

            {activeTab === 'trends' && (
              <div style={{ minHeight: '100%', width: '100%', overflowY: 'auto', padding: 20 }}>
                <DetectionTrendChart />
              </div>
            )}

            {activeTab === 'system' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <SystemPanel />
              </div>
            )}

            {activeTab === 'debug' && (
              <div style={{ minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <DebugPanel />
              </div>
            )}

            {activeTab === 'feed' && (
              <div style={{ minHeight: '100%', width: '100%', overflowY: 'auto', padding: 20 }}>
                <FeedPanel />
              </div>
            )}
          </main>

          {/* Search-Grounded Verification Session History & Recharts Side-Panel */}
          <VerificationHistorySidePanel />
        </div>
      </div>

      {/* Modals */}
      {showEvidenceModal && currentResult && (
        <EvidenceModal result={currentResult} />
      )}
      {showDMCAModal && <DMCAModal />}
      {showMonitoringModal && <MonitoringJobModal />}
      {showHeroOverlay && <HeroOverlay />}
      <CommandPalette />
      <ClaimVerificationModal />
    </div>
  )
}
