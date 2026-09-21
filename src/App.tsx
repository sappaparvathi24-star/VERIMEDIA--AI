import { useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'
import { HeroOverlay } from './components/modals/HeroOverlay'
import { MonitoringJobModal } from './components/modals/MonitoringJobModal'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthGate } from './components/auth/AuthGate'
import { useStore } from './store'
import { getHealth, getApiBaseUrl } from './services/api'

export default function App() {
  const { setHealth } = useStore()

  useEffect(() => {
    const base = getApiBaseUrl()
    const targetUrl = base || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

    console.log(
      `%c🛡️ VeriMedia AI %cBackend Online%c Connected to ${targetUrl}`,
      'background: #0284c7; color: #ffffff; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 4px;',
      'background: #059669; color: #ffffff; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin-left: 4px;',
      'color: #38bdf8; font-family: monospace; font-size: 11px; margin-left: 6px;'
    )

    getHealth()
      .then((health) => {
        setHealth(health)
        console.log(
          '%c[Backend Health Telemetry]',
          'color: #34d399; font-weight: bold; font-family: monospace;',
          health
        )
      })
      .catch((err) => {
        console.warn(
          '%c[Backend Health Warning]',
          'color: #fbbf24; font-weight: bold; font-family: monospace;',
          err.message
        )
      })
  }, [setHealth])

  return (
    <ErrorBoundary fallbackTitle="VeriMedia Application Error">
      <AuthGate>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <Dashboard />
        </div>
      </AuthGate>
    </ErrorBoundary>
  )
}
