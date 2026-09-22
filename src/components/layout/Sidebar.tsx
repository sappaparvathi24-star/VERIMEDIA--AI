import { useState } from 'react'
import { useStore } from '../../store'
import { Tooltip } from '../ui/Tooltip'
import type { TabId } from '../../types'

interface NavItem {
  id: TabId
  label: string
  icon: string
  engineNumber?: string
  description: string
  badge?: string
  isEngine?: boolean
}

const FIVE_ENGINES: NavItem[] = [
  {
    id: 'forensic',
    label: 'Media Forensics',
    icon: '🔬',
    engineNumber: 'E1',
    description: 'Engine 1: Multi-signal ensemble forensics, ELA, PRNU noise, and synthetic artifacts',
    isEngine: true,
  },
  {
    id: 'discovery',
    label: 'Discovery Intelligence',
    icon: '🌐',
    engineNumber: 'E2',
    description: 'Engine 2: Provider-agnostic discovery orchestrator, multi-source ingestion & normalization',
    isEngine: true,
  },
  {
    id: 'origin',
    label: 'Provenance & Origin',
    icon: '🌳',
    engineNumber: 'E3',
    description: 'Engine 3 (Hero): D3 provenance tree, transformation flow & earliest observed source',
    isEngine: true,
  },
  {
    id: 'propagation',
    label: 'Propagation Intelligence',
    icon: '📡',
    engineNumber: 'E4',
    description: 'Engine 4: Content genealogy graph, viral spread vectors and social distribution topology',
    isEngine: true,
  },
  {
    id: 'reasoning',
    label: 'Evidence Reasoning',
    icon: '⚖️',
    engineNumber: 'E5',
    description: 'Engine 5: Explainable AI, structured reasoning dossier & IBM governance audit matrix',
    isEngine: true,
  },
]

const WORKSPACE_TOOLS: NavItem[] = [
  {
    id: 'intelligence',
    label: 'VeriMedia Assistant',
    icon: '✨',
    description: 'Multimodal AI reasoning, executive dossiers, visual forensics & assistant',
    badge: 'AI',
  },
  {
    id: 'batch-compare',
    label: 'Bulk Reference Compare',
    icon: '🗂️',
    description: 'Bulk Reference Comparison: Ingest candidate zip and run multi-spectral pHash comparison',
    badge: 'LIVE',
  },
  {
    id: 'scanner',
    label: 'Media Scanner',
    icon: '⚡',
    description: 'Unified scan interface for images, videos, audio, URLs and live captions',
  },
  {
    id: 'cases',
    label: 'DMCA & Cases',
    icon: '📋',
    description: 'Copyright enforcement, automated DMCA notices and active case ledger',
  },
  {
    id: 'trends',
    label: 'Analytics & Trends',
    icon: '📈',
    description: 'Historical scan volumes, threat distribution and platform analytics',
  },
  {
    id: 'system',
    label: 'System & Jobs',
    icon: '⚙️',
    description: 'Unified engine health, DB sync, monitoring jobs and provider status',
  },
  {
    id: 'debug',
    label: 'API Network Logs',
    icon: '🪲',
    description: 'Real-time HTTP traffic debugger, forensic data fidelity auditor & cURL inspector',
    badge: 'LIVE',
  },
]

export function Sidebar() {
  const { activeTab, setActiveTab, cases, setShowHeroOverlay, setShowMonitoringModal, setShowCommandPalette } = useStore()

  // Thin rail state (starts collapsed for minimized clean workspace)
  const [isCollapsed, setIsCollapsed] = useState(true)

  const openCasesCount = cases.filter(c => c.status === 'open' || c.status === 'under_review').length
  const railWidth = isCollapsed ? 68 : 240

  return (
    <aside style={{
      width: railWidth,
      background: 'linear-gradient(180deg, #0b0f17 0%, #080c10 100%)',
      borderRight: '1px solid #1e2d3d',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
      zIndex: 40,
      transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden'
    }}>
      {/* Brand Header */}
      <div style={{
        height: 60,
        padding: isCollapsed ? '0 12px' : '0 16px',
        borderBottom: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        background: '#090d12'
      }}>
        <Tooltip content="VeriMedia AI Engine (Click to view architecture specs)" position="right">
          <div
            onClick={() => setShowHeroOverlay(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(14,165,233,0.1) 100%)',
              border: '1.5px solid #00d4ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 0 14px rgba(0, 212, 255, 0.3)',
              flexShrink: 0
            }}>
              🛡️
            </div>
            {!isCollapsed && (
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    Veri<span style={{ color: '#00d4ff' }}>Media</span>
                  </span>
                  <span style={{
                    fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                    background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    padding: '1px 4px', borderRadius: 4
                  }}>
                    5 ENGINES
                  </span>
                </div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                  Deepfake & Provenance Mesh
                </div>
              </div>
            )}
          </div>
        </Tooltip>

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 14,
              padding: 4
            }}
            className="hover:text-cyan-400"
            title="Collapse Sidebar"
          >
            «
          </button>
        )}
      </div>

      {/* Quick Search & Command Palette Trigger */}
      <div style={{ padding: isCollapsed ? '10px 10px 4px 10px' : '10px 12px 4px 12px' }}>
        <Tooltip content="Search or Run Commands (Ctrl+K)" position="right">
          <button
            onClick={() => setShowCommandPalette(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #1e2d3d',
              borderRadius: 8,
              padding: isCollapsed ? '8px 0' : '7px 12px',
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="hover:border-cyan-500/50 hover:text-white"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#00d4ff' }}>🔍</span>
              {!isCollapsed && <span style={{ fontWeight: 600 }}>Command Palette</span>}
            </div>
            {!isCollapsed && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: '#38bdf8',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                padding: '1px 5px',
                borderRadius: 4
              }}>
                Ctrl+K
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Main Navigation List */}
      <nav style={{ flex: 1, padding: isCollapsed ? '6px 8px' : '6px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {/* Section: The 5 Major Engines */}
        {!isCollapsed && (
          <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: '#00d4ff', padding: '6px 6px 2px 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Core 5 Engines
          </div>
        )}
        {FIVE_ENGINES.map(item => {
          const isActive = activeTab === item.id

          return (
            <Tooltip key={item.id} content={`${item.label} — ${item.description}`} position="right">
              <button
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '9px 0' : '8px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#00d4ff' : '#cbd5e1',
                  background: isActive ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.16) 0%, rgba(0, 212, 255, 0.04) 100%)' : 'transparent',
                  borderWidth: isCollapsed ? '1px' : '1px 1px 1px 3px',
                  borderStyle: 'solid',
                  borderColor: isActive ? 'rgba(0, 212, 255, 0.35)' : 'transparent',
                  borderLeftColor: isActive ? '#00d4ff' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                className="hover:bg-slate-800/60 hover:text-white"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, opacity: isActive ? 1 : 0.85 }}>{item.icon}</span>
                  {!isCollapsed && (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  )}
                </div>

                {!isCollapsed && item.engineNumber && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    background: isActive ? 'rgba(0, 212, 255, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                    color: isActive ? '#38bdf8' : '#64748b',
                    padding: '1px 5px',
                    borderRadius: 4
                  }}>
                    {item.engineNumber}
                  </span>
                )}
              </button>
            </Tooltip>
          )
        })}

        {/* Section: Workspace Utilities */}
        {!isCollapsed && (
          <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: '#64748b', padding: '10px 6px 2px 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Workspace & Ops
          </div>
        )}
        {WORKSPACE_TOOLS.map(item => {
          const isActive = activeTab === item.id
          const hasBadge = item.id === 'cases' && openCasesCount > 0

          return (
            <Tooltip key={item.id} content={`${item.label} — ${item.description}`} position="right">
              <button
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '9px 0' : '7px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#00d4ff' : '#94a3b8',
                  background: isActive ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 212, 255, 0.03) 100%)' : 'transparent',
                  borderWidth: isCollapsed ? '1px' : '1px 1px 1px 3px',
                  borderStyle: 'solid',
                  borderColor: isActive ? 'rgba(0, 212, 255, 0.3)' : 'transparent',
                  borderLeftColor: isActive ? '#00d4ff' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                className="hover:bg-slate-800/50 hover:text-white"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, opacity: isActive ? 1 : 0.85 }}>{item.icon}</span>
                  {!isCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.label}</span>}
                </div>

                {hasBadge && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    background: '#ef4444',
                    color: '#fff',
                    padding: isCollapsed ? '2px 5px' : '1px 6px',
                    borderRadius: 10,
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    position: isCollapsed ? 'absolute' : 'static',
                    top: isCollapsed ? 4 : 'auto',
                    right: isCollapsed ? 4 : 'auto'
                  }}>
                    {openCasesCount}
                  </span>
                )}
              </button>
            </Tooltip>
          )
        })}
      </nav>

      {/* Monitoring Quick Action */}
      <div style={{ padding: isCollapsed ? '6px 8px' : '6px 10px', borderTop: '1px solid #1e2d3d' }}>
        <Tooltip content="Automated Platform Monitoring Jobs" position="right">
          <button
            onClick={() => setShowMonitoringModal(true)}
            style={{
              width: '100%',
              padding: isCollapsed ? '8px 0' : '7px 10px',
              borderRadius: 6,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #334155',
              color: '#cbd5e1',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s'
            }}
            className="hover:border-slate-400 hover:text-white"
          >
            <span>📡</span> {!isCollapsed && 'Live Ingestion Jobs'}
          </button>
        </Tooltip>
      </div>

      {/* Expand / Collapse Rail Toggle */}
      <div style={{
        padding: isCollapsed ? '10px 10px' : '10px 12px',
        borderTop: '1px solid #1e2d3d',
        background: '#06090e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between'
      }}>
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: '#38bdf8',
              borderRadius: 6,
              width: 38,
              height: 30,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Expand Sidebar Rail"
          >
            »
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: '#1e293b', border: '1px solid #334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#38bdf8', fontWeight: 700
              }}>
                VM
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>VeriMedia Core</div>
                <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>5-Engine Active</div>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700
              }}
              className="hover:text-cyan-400"
              title="Collapse Rail"
            >
              «
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
