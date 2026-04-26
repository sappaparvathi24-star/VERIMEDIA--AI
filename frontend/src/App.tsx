import { useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'
import { HeroOverlay } from './components/modals/HeroOverlay'
import { useStore } from './store'
import { getHealth } from './services/api'

export default function App() {
  const { showHeroOverlay, setHealth } = useStore()

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {})
  }, [setHealth])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {showHeroOverlay && <HeroOverlay />}
      <Dashboard />
    </div>
  )
}
