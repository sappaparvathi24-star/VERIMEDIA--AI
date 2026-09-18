import { useState } from 'react'
import { useStore } from '../store'
import { Nav } from '../components/layout/Nav'
import { ControlBar } from '../components/layout/controlBar'
import { FeedPanel } from '../components/panels/FeedPanel'
import { PropagationGraph } from '../components/panels/PropagationGraph'
import { ForensicPanel } from '../components/panels/ForensicPanel'
import { OriginPanel } from '../components/panels/OriginPanel'
import { CasesPanel } from '../components/panels/CasesPanel'
import { SystemPanel } from '../components/panels/SystemPanel'
import { InvestigationPanel } from '../components/panels/InvestigationPanel'
import { EvidenceModal } from '../components/modals/EvidenceModal'
import { DMCAModal } from '../components/modals/DMCAModal'
import type { TabId } from '../types'

const DEMO_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'feed', label: 'Live Feed', icon: '📡' },
  { id: 'origin', label: 'Origin', icon: '🔗' },
  { id: 'forensic', label: 'Forensic', icon: '🔬' },
  { id: 'cases', label: 'Cases Summary', icon: '📋' },
]

export function Dashboard() {
  const [navTab, setNavTab] = useState<'investigations' | 'demo' | 'system'>('investigations')
  const {
    activeTab, setActiveTab,
    showEvidenceModal, showDMCAModal,
    currentResult,
  } = useStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080c10' }}>
      <Nav currentTab={navTab} onTabChange={(tab: any) => setNavTab(tab)} />

      {/* Primary Experience: Investigations */}
      {navTab === 'investigations' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <InvestigationPanel />
        </div>
      )}

      {/* Secondary Experience: Demo Scenarios */}
      {navTab === 'demo' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Banner */}
          <div style={{ padding: '6px 16px', background: 'rgba(168,85,247,0.12)', borderBottom: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡ DEMO SCENARIO</span>
            <span style={{ fontWeight: 400, color: '#e9d5ff' }}>— Preset media samples for quick demonstration and signal testing</span>
          </div>

          <ControlBar />

          {/* Main 3-panel layout */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
            {/* Left: propagation graph */}
            <div style={{
              borderRight: '1px solid #1e2d3d',
              background: '#080c10',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <PropagationGraph />
            </div>

            {/* Right: tabbed detail panel */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #1e2d3d',
                background: '#0d1117',
                padding: '0 8px',
                flexShrink: 0,
              }}>
                {DEMO_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`vm-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ padding: '10px 10px', fontSize: 10 }}
                  >
                    <span style={{ marginRight: 4 }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'feed' && <FeedPanel />}
                {activeTab === 'origin' && <OriginPanel />}
                {activeTab === 'forensic' && <ForensicPanel />}
                {activeTab === 'cases' && <CasesPanel />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Experience */}
      {navTab === 'system' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SystemPanel />
        </div>
      )}

      {/* Modals */}
      {showEvidenceModal && currentResult && (
        <EvidenceModal result={currentResult} />
      )}
      {showDMCAModal && <DMCAModal />}
    </div>
  )
}

