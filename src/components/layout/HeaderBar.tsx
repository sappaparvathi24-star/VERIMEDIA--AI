import { useState } from 'react'
import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'
import { runBackendConnectivityDiagnostic, getApiBaseUrl, setApiBaseUrl, RENDER_BACKEND, type DiagnosticResult } from '../../services/api'
import { useAuth } from '../auth/AuthGate'
import { ClaimSearchBar } from '../scanner/ClaimSearchBar'
import type { TabId } from '../../types'

const PAGE_TITLES: Record<TabId, { title: string; subtitle: string; icon: string }> = {
  scanner: {
    title: 'Media Scanner',
    subtitle: 'Upload media, audio, or test scenarios for instant analysis',
    icon: '⚡'
  },
  forensic: {
    title: 'Engine 1 — Media Forensics',
    subtitle: 'Multi-signal deepfake detection, ELA & sensor analysis',
    icon: '🔬'
  },
  discovery: {
    title: 'Engine 2 — Discovery Intelligence',
    subtitle: 'Multi-platform search & normalized candidate ingestion',
    icon: '🌐'
  },
  origin: {
    title: 'Engine 3 — Provenance & Origin',
    subtitle: 'Earliest source attribution & transformation lineage',
    icon: '🌳'
  },
  propagation: {
    title: 'Engine 4 — Propagation Intelligence',
    subtitle: 'Viral spread velocity & multi-platform cascade graph',
    icon: '📡'
  },
  reasoning: {
    title: 'Engine 5 — Evidence Reasoning',
    subtitle: 'Calibrated confidence scores & explainable signal weights',
    icon: '⚖️'
  },
  cases: {
    title: 'DMCA & Enforcement Cases',
    subtitle: 'Enforcement tracking & automated infringement notices',
    icon: '📋'
  },
  trends: {
    title: 'Threat Trends & Analytics',
    subtitle: 'Platform threat rates, volume distribution & metrics',
    icon: '📈'
  },
  system: {
    title: 'System & Ingestion Jobs',
    subtitle: 'Backend health, DB sync & provider status',
    icon: '⚙️'
  },
  feed: {
    title: 'Live Media Stream',
    subtitle: 'Real-time platform detection logs & alerts',
    icon: '📡'
  },
  intelligence: {
    title: 'VeriMedia AI Assistant',
    subtitle: 'Multimodal reasoning, automated forensic dossiers & technical explainer',
    icon: '✨'
  },
  debug: {
    title: 'API Network Traffic & Backend Fidelity Inspector',
    subtitle: 'Real-time HTTP traffic debugger, binary forensic verification & cURL inspector',
    icon: '🪲'
  }
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  Scans: 'Total media scans executed across all monitored platforms',
  Threats: 'Manipulated or deepfake media flagged for takedown',
  DMCA: 'Formal legal copyright notices dispatched to platform legal desks',
  Clean: 'Authentic content verified with intact perceptual signatures',
}

export function HeaderBar() {
  const {
    activeTab,
    stats,
    health,
    currentResult,
    setCurrentResult,
    setActiveTab,
    setShowHeroOverlay,
    setShowMonitoringModal,
    setShowCommandPalette,
    setShowEvidenceModal,
    setHealth,
    verificationHistory,
    showVerificationHistoryDrawer,
    toggleVerificationHistoryDrawer
  } = useStore()
  const { session, signOut } = useAuth()
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null)
  const [showDiagModal, setShowDiagModal] = useState(false)

  const handlePingDiagnostic = async () => {
    setIsDiagnosing(true)
    try {
      const res = await runBackendConnectivityDiagnostic()
      setDiagResult(res)
      setShowDiagModal(true)
      if (res.status === 200 && res.data) {
        setHealth(res.data)
      }
    } catch (e) {
      console.error('Diagnostic run failed:', e)
    } finally {
      setIsDiagnosing(false)
    }
  }

  const current = PAGE_TITLES[activeTab] || PAGE_TITLES.scanner

  return (
    <header style={{
      height: 60,
      background: 'linear-gradient(180deg, #0d1117 0%, #090d12 100%)',
      borderBottom: '1px solid #1e2d3d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
      zIndex: 30
    }}>
      {/* Left: Active Workspace Title & Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 280 }}>
        <div style={{
          fontSize: 20,
          width: 38,
          height: 38,
          borderRadius: 8,
          background: 'rgba(0, 212, 255, 0.08)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {current.icon}
        </div>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {current.title}
          </h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontWeight: 500, lineHeight: 1.2 }}>
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Center: Live Media Claim Verification & Command Palette */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', maxWidth: 520, justifyContent: 'center' }}>
        <ClaimSearchBar
          variant="header"
          placeholder="Verify media claim or headline (Google, YouTube)..."
          className="flex-1"
        />

        <Tooltip content="Global Command Palette (Ctrl+K)" position="bottom">
          <button
            onClick={() => setShowCommandPalette(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #1e2d3d',
              borderRadius: 10,
              padding: '6px 10px',
              color: '#94a3b8',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-500/40 hover:text-slate-200"
            title="Global Command Palette (Ctrl+K)"
          >
            <span style={{ fontSize: 12 }}>⚡</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#38bdf8',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              padding: '1px 5px',
              borderRadius: 4
            }}>
              ⌘K
            </span>
          </button>
        </Tooltip>
      </div>

      {/* Right: Quick Operational Counters & Live Health */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Metric Tickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(13, 17, 23, 0.6)', padding: '4px 12px', borderRadius: 8, border: '1px solid #1e2d3d' }}>
          {[
            { label: 'Scans', val: stats?.total || 0, color: '#00d4ff' },
            { label: 'Threats', val: stats?.threats || 0, color: '#ef4444' },
            { label: 'DMCA', val: stats?.dmca || 0, color: '#f59e0b' },
          ].map(s => (
            <Tooltip key={s.label} content={STAT_DESCRIPTIONS[s.label]} position="bottom">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace' }}>{s.label}:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.val}</span>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Check Another Image Button */}
        <Tooltip content="Upload and analyze another image or media asset" position="bottom">
          <button
            onClick={() => {
              setCurrentResult(null)
              setActiveTab('scanner')
              setShowEvidenceModal(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #00d4ff 0%, #0077ff 100%)',
              border: 'none',
              padding: '6px 13px',
              borderRadius: 6,
              color: '#040d1a',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(0, 212, 255, 0.4)',
              transition: 'all 0.15s'
            }}
            className="hover:scale-105"
          >
            <span>📷</span>
            <span>Check Another Image</span>
          </button>
        </Tooltip>

        {/* VeriMedia AI Assistant Button */}
        <Tooltip content="VeriMedia Assistant: Multimodal Analysis, Executive Dossiers & Technical Explainer" position="bottom">
          <button
            onClick={() => useStore.getState().setActiveTab('intelligence')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              padding: '6px 12px',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)'
            }}
            className="hover:scale-105"
          >
            <span>✨</span>
            <span>VeriMedia Assistant</span>
          </button>
        </Tooltip>

        {/* Search Grounded Verification History Side-Panel Toggle */}
        <Tooltip content="Toggle Search-Grounded Verification History Side-Panel & Recharts Analytics" position="bottom">
          <button
            onClick={() => toggleVerificationHistoryDrawer()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: showVerificationHistoryDrawer ? 'rgba(0, 212, 255, 0.25)' : 'rgba(15, 23, 42, 0.8)',
              border: showVerificationHistoryDrawer ? '1px solid #00d4ff' : '1px solid rgba(56, 189, 248, 0.35)',
              padding: '6px 12px',
              borderRadius: 6,
              color: showVerificationHistoryDrawer ? '#ffffff' : '#38bdf8',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: showVerificationHistoryDrawer ? '0 0 12px rgba(0, 212, 255, 0.4)' : 'none'
            }}
            className="hover:scale-105 hover:border-cyan-400"
          >
            <span>🔍</span>
            <span>Search History</span>
            <span style={{
              background: 'rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              borderRadius: 10,
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 800,
              fontFamily: 'monospace'
            }}>
              {verificationHistory.length}
            </span>
          </button>
        </Tooltip>

        {/* Live Monitoring Modal Trigger */}
        <Tooltip content="Live Platform Ingestion Jobs & Discovery Scheduler" position="bottom">
          <button
            onClick={() => setShowMonitoringModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: 6,
              color: '#cbd5e1',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            className="hover:border-slate-400 hover:text-white"
          >
            <span>📡</span>
            <span>Jobs</span>
          </button>
        </Tooltip>

        {/* Manual Backend Connectivity & CORS Diagnostic Button */}
        <Tooltip content="Check System Status: Ping /health endpoint & log detailed network, header & CORS diagnostics to browser console" position="bottom">
          <button
            onClick={handlePingDiagnostic}
            disabled={isDiagnosing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isDiagnosing ? 'rgba(0, 212, 255, 0.2)' : 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(3, 105, 161, 0.35) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              padding: '6px 12px',
              borderRadius: 6,
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 800,
              cursor: isDiagnosing ? 'wait' : 'pointer',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
              transition: 'all 0.15s'
            }}
            className="hover:border-cyan-400 hover:text-white"
          >
            <span>{isDiagnosing ? '⏳' : '🩺'}</span>
            <span>{isDiagnosing ? 'Checking...' : 'Status'}</span>
          </button>
        </Tooltip>

        {/* Ephemeral Session Notice if Supabase not configured */}
        {health && health.integrations?.supabase !== 'configured' && (
          <Tooltip content="Ephemeral session — Supabase not configured. Investigations, findings & evidence are kept in local storage/memory and will reset upon restart." position="bottom">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              color: '#fbbf24',
              fontFamily: 'monospace'
            }}>
              <span>⚡</span>
              <span>EPHEMERAL SESSION (NO SUPABASE)</span>
            </div>
          </Tooltip>
        )}

        {/* Backend Status Indicator */}
        <Tooltip content="5-Engine VeriMedia Engine API: Nominal Operational Status" position="bottom">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            padding: '5px 10px',
            borderRadius: 6,
            cursor: 'default'
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: health?.status === 'ok' ? '#22c55e' : '#eab308',
              boxShadow: health?.status === 'ok' ? '0 0 8px #22c55e' : '0 0 8px #eab308',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>
              ONLINE
            </span>
          </div>
        </Tooltip>

        {/* Authenticated User Profile & Sign Out Bar (Integrated in Header) */}
        {session?.profile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            padding: '4px 8px 4px 10px',
            borderRadius: 20,
            fontSize: 11,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ color: '#cbd5e1', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {session.profile.email}
            </span>
            <span style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {session.profile.role}
            </span>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                borderRadius: 12,
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
              className="hover:text-red-400 hover:border-red-500/50"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* System Architecture Overview trigger */}
        <Tooltip content="VeriMedia 5-Engine Architecture & Specs" position="bottom">
          <button
            onClick={() => setShowHeroOverlay(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700
            }}
            className="hover:bg-cyan-500/20"
          >
            ⓘ
          </button>
        </Tooltip>
      </div>

      {/* Connectivity & CORS Diagnostic Modal Overlay */}
      {showDiagModal && diagResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            width: '100%',
            maxWidth: 640,
            background: '#0d1117',
            border: '1px solid #1e2d3d',
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(90deg, rgba(0,212,255,0.1) 0%, rgba(13,17,23,1) 100%)',
              borderBottom: '1px solid #1e2d3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🛠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    Backend Connectivity & Network Diagnostic
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                    Target: {diagResult.url}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Backend Target Switcher */}
              <div style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Active Backend Target:
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                    {getApiBaseUrl() || 'Same-Origin Local Container (/api)'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setApiBaseUrl(RENDER_BACKEND)}
                    style={{
                      flex: '1 1 auto',
                      background: getApiBaseUrl() === RENDER_BACKEND ? 'rgba(0, 212, 255, 0.2)' : '#0d1117',
                      border: getApiBaseUrl() === RENDER_BACKEND ? '1.5px solid #00d4ff' : '1px solid #30363d',
                      color: getApiBaseUrl() === RENDER_BACKEND ? '#38bdf8' : '#e2e8f0',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    ⚡ Connect to Render Live Backend (verimedia-ai-2)
                  </button>
                  <button
                    onClick={() => setApiBaseUrl('')}
                    style={{
                      flex: '1 1 auto',
                      background: getApiBaseUrl() === '' ? 'rgba(0, 212, 255, 0.2)' : '#0d1117',
                      border: getApiBaseUrl() === '' ? '1.5px solid #00d4ff' : '1px solid #30363d',
                      color: getApiBaseUrl() === '' ? '#38bdf8' : '#e2e8f0',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    🖥️ Use Local/Container Backend
                  </button>
                </div>
              </div>

              {/* Status Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                background: '#161b22',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #21262d'
              }}>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>HTTP Status</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: diagResult.status === 200 ? '#4ade80' : '#ef4444', fontFamily: 'monospace' }}>
                    {diagResult.status ? `${diagResult.status} ${diagResult.statusText}` : 'FAIL / NETWORK ERR'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Latency</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#facc15', fontFamily: 'monospace' }}>
                    {diagResult.latencyMs} ms
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>CORS Audit</div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: diagResult.corsStatus === 'OK' ? '#4ade80' : '#f87171',
                    fontFamily: 'monospace',
                    marginTop: 4
                  }}>
                    {diagResult.corsStatus === 'OK' ? '✓ PASS' : diagResult.corsStatus === 'MISSING_ALLOW_ORIGIN' ? '⚠️ MISSING HEADER' : '❌ PREFLIGHT / BLOCKED'}
                  </div>
                </div>
              </div>

              {/* Console Info Callout */}
              <div style={{
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 16 }}>💻</span>
                <span>Detailed headers, network status object & CORS validation log group were dispatched to the browser Developer Console. Press <strong style={{ color: '#ffffff' }}>F12 / Cmd+Option+I</strong> to view.</span>
              </div>

              {/* Response Headers JSON */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Response Headers ({Object.keys(diagResult.headers).length}):
                </div>
                <pre style={{
                  background: '#040d1a',
                  border: '1px solid #1e2d3d',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#a7f3d0',
                  maxHeight: 140,
                  overflowY: 'auto',
                  margin: 0
                }}>
                  {JSON.stringify(diagResult.headers, null, 2)}
                </pre>
              </div>

              {/* Response Body Payload JSON */}
              {diagResult.data && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    /api/health Payload:
                  </div>
                  <pre style={{
                    background: '#040d1a',
                    border: '1px solid #1e2d3d',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#38bdf8',
                    maxHeight: 140,
                    overflowY: 'auto',
                    margin: 0
                  }}>
                    {JSON.stringify(diagResult.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Details if any */}
              {diagResult.error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: 12,
                  borderRadius: 6,
                  color: '#f87171',
                  fontSize: 12,
                  fontFamily: 'monospace'
                }}>
                  <strong>Error:</strong> {diagResult.error}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              background: '#161b22',
              borderTop: '1px solid #1e2d3d',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                onClick={handlePingDiagnostic}
                style={{
                  background: 'rgba(0,212,255,0.15)',
                  border: '1px solid #00d4ff',
                  color: '#00d4ff',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ↻ Re-run Diagnostic
              </button>
              <button
                onClick={() => setShowDiagModal(false)}
                style={{
                  background: '#21262d',
                  border: '1px solid #30363d',
                  color: '#f8fafc',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  )
}
