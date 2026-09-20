import { useState } from 'react'
import { useStore } from '../store'
import { Sidebar } from '../components/layout/Sidebar'
import { HeaderBar } from '../components/layout/HeaderBar'
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

        {/* Content View Routing */}
        <main style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
          {/* Workspaces */}
          {activeTab === 'scanner' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <InvestigationFlow />
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <GeminiIntelligencePanel />
            </div>
          )}

          {activeTab === 'forensic' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <ForensicPanel />
            </div>
          )}

          {activeTab === 'discovery' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <DiscoveryPanel />
            </div>
          )}

          {activeTab === 'origin' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <OriginPanel />
            </div>
          )}

          {activeTab === 'propagation' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#080c10' }}>
              <PropagationGraph />
            </div>
          )}

          {activeTab === 'reasoning' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <EvidenceReasoningPanel />
            </div>
          )}

          {activeTab === 'cases' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <CasesPanel />
            </div>
          )}

          {activeTab === 'trends' && (
            <div style={{ height: '100%', width: '100%', overflow: 'auto', padding: 20 }}>
              <DetectionTrendChart />
            </div>
          )}

          {activeTab === 'system' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <SystemPanel />
            </div>
          )}

          {activeTab === 'debug' && (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <DebugPanel />
            </div>
          )}

          {activeTab === 'feed' && (
            <div style={{ height: '100%', width: '100%', overflow: 'auto', padding: 20 }}>
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
