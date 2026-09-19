import { useStore } from '../store'
import { Nav } from '../components/layout/Nav'
import { ControlBar } from '../components/layout/ControlBar'
import { FeedPanel } from '../components/panels/FeedPanel'
import { DetectionTrendChart } from '../components/charts/DetectionTrendChart'
import { PropagationGraph } from '../components/panels/PropagationGraph'
import { ForensicPanel } from '../components/panels/ForensicPanel'
import { OriginPanel } from '../components/panels/OriginPanel'
import { CasesPanel } from '../components/panels/CasesPanel'
import { SystemPanel } from '../components/panels/SystemPanel'
import { EvidenceModal } from '../components/modals/EvidenceModal'
import { DMCAModal } from '../components/modals/DMCAModal'
import { Tooltip } from '../components/ui/Tooltip'
import type { TabId } from '../types'

const TABS: { id: TabId; label: string; icon: string; description: string }[] = [
  { id: 'feed',     label: 'Live Feed',   icon: '📡', description: 'Monitored media ingest & real-time detection events' },
  { id: 'trends',   label: 'Trends',      icon: '📈', description: 'Historical volume analysis & detection trend metrics' },
  { id: 'origin',   label: 'Origin',      icon: '🔗', description: 'Provenance tree, digital signatures & perceptual hashing' },
  { id: 'forensic', label: 'Forensic',    icon: '🔬', description: '9-signal deepfake analysis & ML classification matrix' },
  { id: 'cases',    label: 'Cases',       icon: '📋', description: 'Active DMCA cases, copyright strikes & enforcement actions' },
  { id: 'system',   label: 'System',      icon: '⚙️',  description: 'Unified backend engine status, API keys & discovery providers' },
]

export function Dashboard() {
  const {
    activeTab, setActiveTab,
    showEvidenceModal, showDMCAModal,
    currentResult,
  } = useStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Nav />
      <ControlBar />

      {/* Main 3-panel layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>
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
            {TABS.map(tab => (
              <Tooltip key={tab.id} content={tab.description} position="bottom">
                <button
                  className={`vm-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '10px 8px', fontSize: 10 }}
                >
                  <span style={{ marginRight: 3 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'feed'     && <FeedPanel />}
            {activeTab === 'trends'   && <DetectionTrendChart />}
            {activeTab === 'origin'   && <OriginPanel />}
            {activeTab === 'forensic' && <ForensicPanel />}
            {activeTab === 'cases'    && <CasesPanel />}
            {activeTab === 'system'   && <SystemPanel />}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEvidenceModal && currentResult && (
        <EvidenceModal result={currentResult} />
      )}
      {showDMCAModal && <DMCAModal />}
    </div>
  )
}
