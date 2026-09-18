import { useState } from 'react'
import { useDetection } from '../../hooks/useDetection'
import { useStore } from '../../store'
import type { Platform, ContentType, Scenario } from '../../types'

const SCENARIOS: { key: Scenario; label: string; color: string }[] = [
  { key: 'normal',       label: 'Normal',       color: '#22c55e' },
  { key: 'education',    label: 'Fair Use',      color: '#22c55e' },
  { key: 'news',         label: 'News Attr.',    color: '#f59e0b' },
  { key: 'crop',         label: 'Crop',          color: '#f97316' },
  { key: 'blur',         label: 'Blur',          color: '#6366f1' },
  { key: 'entertainment',label: 'Entertain.',    color: '#f97316' },
  { key: 'manipulated',  label: 'Manipulated',   color: '#ef4444' },
  { key: 'scam',         label: 'Scam',          color: '#ef4444' },
  { key: 'insufficient', label: 'Low Evidence',  color: '#6366f1' },
  { key: 'deepfake',     label: 'Deepfake',      color: '#dc2626' },
  { key: 'adversarial',  label: 'Adversarial',   color: '#a855f7' },
]

const PLATFORMS: Platform[] = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Reddit']
const CONTENT_TYPES: ContentType[] = ['sports', 'news', 'entertainment', 'education', 'unknown']

const USERNAMES: Record<Scenario, string> = {
  normal:        'official_sports_clips',
  education:     'edu_highlights',
  news:          'news_reposter',
  crop:          'sports_clips_4u',
  blur:          'blurred_sports',
  entertainment: 'viral_clips_now',
  manipulated:   'reuploader_hd',
  scam:          'legit_clips_real',
  insufficient:  'random_user_xyz',
  deepfake:      'ai_generated_news',
  adversarial:   'adversarial_actor',
}

const CAPTIONS: Record<Scenario, string> = {
  normal:        'Amazing goal! Full match highlights 🔥 #sports',
  education:     'Educational breakdown of this iconic play [commentary]',
  news:          'Breaking: watch this incredible moment! No credit listed',
  crop:          'Check out this clip! (watermark removed) 🏆',
  blur:          'Super viral clip!!! watch till end 😱',
  entertainment: 'OMG look at this!! 😂 viral moment #trending',
  manipulated:   'Crazy moment from last night\'s game! #football',
  scam:          'FREE TICKETS if you share this! Not affiliated',
  insufficient:  'just some random content lol',
  deepfake:      'BREAKING: exclusive leaked interview with the player!',
  adversarial:   'Totally original content I filmed myself',
}

export function ControlBar() {
  const { isScanning } = useStore()
  const { runDetection } = useDetection()

  const [scenario, setScenario] = useState<Scenario>('normal')
  const [platform, setPlatform] = useState<Platform>('YouTube')
  const [contentType, setContentType] = useState<ContentType>('sports')
  const [username, setUsername] = useState(USERNAMES.normal)
  const [caption, setCaption] = useState(CAPTIONS.normal)

  function onScenarioChange(sc: Scenario) {
    setScenario(sc)
    setUsername(USERNAMES[sc])
    setCaption(CAPTIONS[sc])
  }

  async function handleScan() {
    await runDetection({ platform, username, caption, content_type: contentType, scenario })
  }

  const selectedSc = SCENARIOS.find(s => s.key === scenario)

  return (
    <div style={{
      background: '#0d1117',
      borderBottom: '1px solid #1e2d3d',
      padding: '12px 20px',
      flexShrink: 0,
    }}>
      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {SCENARIOS.map(sc => (
          <button
            key={sc.key}
            onClick={() => onScenarioChange(sc.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${scenario === sc.key ? sc.color : '#1e2d3d'}`,
              background: scenario === sc.key ? `${sc.color}18` : 'transparent',
              color: scenario === sc.key ? sc.color : '#8899aa',
              transition: 'all 0.15s',
            }}
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Inputs row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="vm-select"
          style={{ width: 140 }}
          value={platform}
          onChange={e => setPlatform(e.target.value as Platform)}
        >
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          className="vm-select"
          style={{ width: 130 }}
          value={contentType}
          onChange={e => setContentType(e.target.value as ContentType)}
        >
          {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          className="vm-input"
          style={{ flex: '0 0 160px' }}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="@username"
        />

        <input
          className="vm-input"
          style={{ flex: 1, minWidth: 200 }}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Post caption..."
        />

        <button
          className="vm-btn vm-btn-primary"
          style={{ flexShrink: 0, minWidth: 130, justifyContent: 'center' }}
          onClick={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin-slow 1s linear infinite' }}>◌</span>
              Scanning...
            </>
          ) : (
            <>🔍 Run Detection</>
          )}
        </button>
      </div>

      {/* Active scenario badge */}
      {selectedSc && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedSc.color }} />
          <span style={{ fontSize: 10, color: '#8899aa', fontFamily: 'monospace' }}>
            SCENARIO: <span style={{ color: selectedSc.color }}>{selectedSc.key.toUpperCase()}</span>
          </span>
        </div>
      )}
    </div>
  )
}
