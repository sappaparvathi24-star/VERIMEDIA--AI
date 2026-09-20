import { useState } from 'react'
import { useStore } from '../../store'

interface ProviderInfo {
  id: string
  name: string
  type: string
  status: 'ACTIVE' | 'RATE_LIMITED' | 'CONFIG_REQUIRED' | 'UNAVAILABLE'
  latency: string
  features: string[]
  description: string
  icon: string
  independenceGroup: string
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'youtube',
    name: 'YouTube Data API v3',
    type: 'Video Stream',
    status: 'ACTIVE',
    latency: '142ms',
    features: ['Video Search', 'Frame Extraction', 'Timeline Fingerprints'],
    description: 'Queries public video uploads, descriptions, and extracts keyframe perceptual fingerprints.',
    icon: '▶️',
    independenceGroup: 'youtube-cluster'
  },
  {
    id: 'reddit',
    name: 'Reddit Pushshift API',
    type: 'Community Posts',
    status: 'ACTIVE',
    latency: '98ms',
    features: ['Subreddit Ingestion', 'Post Metadata', 'Media Mirroring'],
    description: 'Discovers syndicated media posts and normalizes community timestamps.',
    icon: '🤖',
    independenceGroup: 'reddit-cluster'
  },
  {
    id: 'web-search',
    name: 'Unified Web Index',
    type: 'Search & News',
    status: 'ACTIVE',
    latency: '310ms',
    features: ['Visual Reverse Lookup', 'News Archive', 'OCR Match'],
    description: 'Queries indexed web repositories, news archives, and open media databases.',
    icon: '🌐',
    independenceGroup: 'web-cluster'
  },
  {
    id: 'activitypub',
    name: 'ActivityPub Protocol',
    type: 'Federated Networks',
    status: 'ACTIVE',
    latency: '85ms',
    features: ['Federated Post Hashes', 'P2P Media Headers', 'C2PA Manifests'],
    description: 'Connects to federated media instances to trace decentralized distributions.',
    icon: '⚡',
    independenceGroup: 'fediverse-cluster'
  },
  {
    id: 'custom',
    name: 'Enterprise SDK Adapter',
    type: 'Custom Webhooks',
    status: 'ACTIVE',
    latency: '12ms',
    features: ['Normalized Schema', 'Custom Webhooks', 'Zero Overhead'],
    description: 'Hot-pluggable ingestion hook for proprietary repositories.',
    icon: '🔌',
    independenceGroup: 'enterprise-cluster'
  },
]

export function DiscoveryPanel() {
  const [selectedProvider, setSelectedProvider] = useState<string>('youtube')
  const [testQuery, setTestQuery] = useState('breaking interview 2026')
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryOutput, setQueryOutput] = useState<string | null>(null)

  const handleSimulateSearch = () => {
    setIsQuerying(true)
    setQueryOutput(null)
    setTimeout(() => {
      setIsQuerying(false)
      setQueryOutput(`[Discovery Orchestrator] Dispatched 5 parallel provider queries for "${testQuery}":
• YouTube: 4 normalized candidates retrieved (pHash dist <= 12)
• Reddit: 7 syndicated posts detected (Deduplicated to 1 cluster)
• Web Index: 2 archived articles matched (earliest timestamp 2026-01-10T08:14:00Z)
• ActivityPub: 1 federated post identified
➔ 14 raw results normalized into 3 unified canonical candidates.`)
    }, 500)
  }

  const activeProviderObj = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0]

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', background: '#080c10', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Banner */}
      <div style={{
        padding: '12px 18px',
        borderRadius: 8,
        background: 'rgba(0, 212, 255, 0.08)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#00d4ff', fontWeight: 800 }}>
              Engine 2 — Discovery Intelligence
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0 0' }}>
            Multi-platform search and normalized candidate ingestion pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#0d1117', padding: '6px 12px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>5 / 5</div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Active Adapters</div>
          </div>
          <div style={{ background: '#0d1117', padding: '6px 12px', borderRadius: 6, border: '1px solid #1e2d3d', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#00d4ff', fontFamily: 'monospace' }}>&lt; 150ms</div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Avg Latency</div>
          </div>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {PROVIDERS.map(prov => {
          const isSelected = selectedProvider === prov.id
          return (
            <button
              key={prov.id}
              onClick={() => setSelectedProvider(prov.id)}
              style={{
                background: isSelected ? 'rgba(30, 41, 59, 0.9)' : '#0d1117',
                border: isSelected ? '1.5px solid #00d4ff' : '1px solid #1e2d3d',
                borderRadius: 8,
                padding: '12px 10px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ fontSize: 20 }}>{prov.icon}</span>
              <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#38bdf8' : '#e2e8f0' }}>
                {prov.name}
              </div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: prov.status === 'ACTIVE' ? '#4ade80' : '#f59e0b' }}>
                ● {prov.status}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Provider & Query Tester */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Provider Details */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>{activeProviderObj.icon}</span>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{activeProviderObj.name}</h4>
              <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>{activeProviderObj.type}</p>
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, margin: '0 0 10px 0' }}>
            {activeProviderObj.description}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {activeProviderObj.features.map(f => (
              <span key={f} style={{ fontSize: 10, background: '#080c10', border: '1px solid #1e2d3d', color: '#38bdf8', padding: '2px 6px', borderRadius: 4 }}>
                ✓ {f}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'monospace' }}>
            <div style={{ background: '#080c10', padding: '4px 8px', borderRadius: 4, border: '1px solid #1e2d3d', color: '#4ade80' }}>
              Latency: {activeProviderObj.latency}
            </div>
            <div style={{ background: '#080c10', padding: '4px 8px', borderRadius: 4, border: '1px solid #1e2d3d', color: '#38bdf8' }}>
              Cluster: {activeProviderObj.independenceGroup}
            </div>
          </div>
        </div>

        {/* Query Dispatcher */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
            Discovery Query Dispatcher
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              placeholder="Search query or keyword..."
              style={{
                flex: 1,
                background: '#080c10',
                border: '1px solid #1e2d3d',
                borderRadius: 6,
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: 12,
                outline: 'none'
              }}
            />
            <button
              onClick={handleSimulateSearch}
              disabled={isQuerying}
              style={{
                background: '#00d4ff',
                color: '#080c10',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {isQuerying ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div style={{
            flex: 1,
            background: '#080c10',
            border: '1px solid #1e2d3d',
            borderRadius: 6,
            padding: 10,
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#94a3b8',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.4,
            minHeight: 90,
            overflowY: 'auto'
          }}>
            {queryOutput || '// Click Search to run discovery query across all active providers in parallel.'}
          </div>
        </div>
      </div>
    </div>
  )
}
