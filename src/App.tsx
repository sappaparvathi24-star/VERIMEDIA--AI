import { useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'
import { SimpleView } from './pages/SimpleView'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthGate } from './components/auth/AuthGate'
import { useStore } from './store'
import { getHealth } from './services/api'

export default function App() {
  const { setHealth, viewMode } = useStore()

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {})
  }, [setHealth])

  return (
    <ErrorBoundary fallbackTitle="VeriMedia Application Error">
      <AuthGate>
        {viewMode === 'simple' ? (
          <SimpleView />
        ) : (
          <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <Dashboard />
          </div>
        )}
      </AuthGate>
    </ErrorBoundary>
  )
}
