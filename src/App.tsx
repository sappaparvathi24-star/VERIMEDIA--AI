import { useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'
import { HeroOverlay } from './components/modals/HeroOverlay'
import { MonitoringJobModal } from './components/modals/MonitoringJobModal'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthGate } from './components/auth/AuthGate'
import { useStore } from './store'
import { getHealth } from './services/api'

export default function App() {
  const { showHeroOverlay, showMonitoringModal, setHealth } = useStore()

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {})
  }, [setHealth])

  return (
    <ErrorBoundary fallbackTitle="VeriMedia Application Error">
      <AuthGate>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          {showHeroOverlay && <HeroOverlay />}
          {showMonitoringModal && <MonitoringJobModal />}
          <Dashboard />
        </div>
      </AuthGate>
    </ErrorBoundary>
  )
}
