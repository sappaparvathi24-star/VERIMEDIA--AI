import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '../../store'
import { useDetection } from '../../hooks/useDetection'
import type { TabId, Scenario, Platform, ContentType, DetectionResult, CaseRecord } from '../../types'

interface CommandItem {
  id: string
  category: 'NAVIGATION' | 'WORKFLOWS' | 'CASES' | 'RECENT SCANS'
  title: string
  subtitle?: string
  icon: string
  badge?: string
  badgeColor?: string
  shortcut?: string
  action: () => void
}

export function CommandPalette() {
  const {
    showCommandPalette, setShowCommandPalette,
    setActiveTab, setShowDMCAModal, setShowMonitoringModal,
    setShowHeroOverlay, setShowEvidenceModal,
    results, currentResult, setCurrentResult,
    cases,
  } = useStore()

  const { runDetection, refreshCases } = useDetection()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Listen for global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette(!showCommandPalette)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCommandPalette, setShowCommandPalette])

  // Auto-focus input when palette opens & reset selection
  useEffect(() => {
    if (showCommandPalette) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showCommandPalette])

  // Handle keyboard navigation inside palette
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowCommandPalette(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action()
        setShowCommandPalette(false)
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Helper trigger for scenario analysis
  const triggerAnalysis = async (sc: Scenario, plat: Platform = 'YouTube', ct: ContentType = 'news', captionText?: string) => {
    setShowCommandPalette(false)
    setActiveTab('scanner')
    await runDetection({
      platform: plat,
      username: 'command_palette_trigger',
      caption: captionText || `Command Palette analysis run: ${sc}`,
      content_type: ct,
      scenario: sc
    })
  }

  // Base navigation items
  const navItems: CommandItem[] = [
    {
      id: 'nav-intelligence',
      category: 'NAVIGATION',
      title: 'Gemini AI Intelligence & Multimodal Copilot',
      subtitle: 'Multimodal visual analysis, executive dossiers & AI reasoning',
      icon: '✨',
      badge: 'AI',
      badgeColor: '#c084fc',
      action: () => { setActiveTab('intelligence'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-scanner',
      category: 'NAVIGATION',
      title: 'Media Scanner & Detection Hub',
      subtitle: 'Upload local media or select synthetic test scenarios',
      icon: '⚡',
      shortcut: 'Tab 1',
      action: () => { setActiveTab('scanner'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-propagation',
      category: 'NAVIGATION',
      title: 'Viral Propagation Topology Mesh',
      subtitle: 'Cross-platform velocity vectors and replication graph',
      icon: '📡',
      shortcut: 'Tab 2',
      action: () => { setActiveTab('propagation'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-forensic',
      category: 'NAVIGATION',
      title: '9-Signal Forensic Matrix & Hashes',
      subtitle: 'Perceptual hashing, noise residuals & ML confidence breakdown',
      icon: '🔬',
      shortcut: 'Tab 3',
      action: () => { setActiveTab('forensic'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-origin',
      category: 'NAVIGATION',
      title: 'Provenance Lineage & Signature Tree',
      subtitle: 'C2PA cryptographic claims and origin attribution',
      icon: '🔗',
      shortcut: 'Tab 4',
      action: () => { setActiveTab('origin'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-cases',
      category: 'NAVIGATION',
      title: 'DMCA Takedown & Copyright Ledger',
      subtitle: 'Manage legal claims, notice generator, and active cases',
      icon: '📋',
      badge: `${cases.length} cases`,
      badgeColor: '#fb923c',
      shortcut: 'Tab 5',
      action: () => { setActiveTab('cases'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-trends',
      category: 'NAVIGATION',
      title: 'Detection Analytics & Threat Volume',
      subtitle: 'Scan volume distribution and platform breakdown',
      icon: '📈',
      shortcut: 'Tab 6',
      action: () => { setActiveTab('trends'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-system',
      category: 'NAVIGATION',
      title: 'System Health & Diagnostics',
      subtitle: 'Engine status, Supabase DB sync, discovery adapters & jobs',
      icon: '⚙️',
      shortcut: 'Tab 7',
      action: () => { setActiveTab('system'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-debug',
      category: 'NAVIGATION',
      title: 'API Network Logs & Backend Fidelity Debugger',
      subtitle: 'Inspect real-time HTTP requests, ELA binary fidelity, and cURL replay commands',
      icon: '🪲',
      badge: 'LIVE',
      badgeColor: '#06b6d4',
      action: () => { setActiveTab('debug'); setShowCommandPalette(false) }
    },
    {
      id: 'nav-feed',
      category: 'NAVIGATION',
      title: 'Real-Time Ingestion Event Feed',
      subtitle: 'Monitored social media event stream and raw detection log',
      icon: '📡',
      action: () => { setActiveTab('feed'); setShowCommandPalette(false) }
    }
  ]

  // Workflow items
  const workflowItems: CommandItem[] = [
    {
      id: 'wf-deepfake',
      category: 'WORKFLOWS',
      title: 'Trigger Deepfake AI Synthetic Video Scan',
      subtitle: 'Run 9-signal detection pipeline on synthetic deepfake video',
      icon: '🤖',
      badge: 'PRESET',
      badgeColor: '#ef4444',
      action: () => triggerAnalysis('deepfake', 'YouTube', 'news', 'Leaked deepfake video interview clip')
    },
    {
      id: 'wf-crop',
      category: 'WORKFLOWS',
      title: 'Trigger Crop & Watermark Removal Analysis',
      subtitle: 'Analyze spatially cropped video for removed logos or watermarks',
      icon: '✂️',
      badge: 'PRESET',
      badgeColor: '#f97316',
      action: () => triggerAnalysis('crop', 'TikTok', 'sports', 'Cropped viral sports clip without watermark')
    },
    {
      id: 'wf-authentic',
      category: 'WORKFLOWS',
      title: 'Trigger Authentic Source Verification Scan',
      subtitle: 'Verify original un-tampered broadcast feed with C2PA metadata',
      icon: '✅',
      badge: 'PRESET',
      badgeColor: '#22c55e',
      action: () => triggerAnalysis('normal', 'X / Twitter', 'sports', 'Verified authentic broadcast feed clip')
    },
    {
      id: 'wf-adversarial',
      category: 'WORKFLOWS',
      title: 'Trigger Adversarial Noise Evasion Analysis',
      subtitle: 'Detect invisible spatial noise patterns crafted to evade ML classifiers',
      icon: '⚡',
      badge: 'PRESET',
      badgeColor: '#c084fc',
      action: () => triggerAnalysis('adversarial', 'YouTube', 'entertainment', 'Perturbed media with stealth noise pattern')
    },
    {
      id: 'wf-monitoring',
      category: 'WORKFLOWS',
      title: 'Configure Automated Monitoring Jobs',
      subtitle: 'Manage background cron jobs for Instagram, YouTube, TikTok, and X',
      icon: '📡',
      action: () => { setShowMonitoringModal(true); setShowCommandPalette(false) }
    },
    {
      id: 'wf-specs',
      category: 'WORKFLOWS',
      title: 'View Engine Specs & Architecture Overview',
      subtitle: 'Inspect C2PA specs, 9 ML signals, and database integration',
      icon: 'ℹ️',
      action: () => { setShowHeroOverlay(true); setShowCommandPalette(false) }
    }
  ]

  // Cases items
  const caseItems: CommandItem[] = [
    {
      id: 'case-create-new',
      category: 'CASES',
      title: 'Create New Case / DMCA Takedown Notice',
      subtitle: 'File a formal copyright notice or open a new investigation case',
      icon: '➕',
      badge: 'NEW CASE',
      badgeColor: '#38bdf8',
      action: () => {
        setShowCommandPalette(false)
        setShowDMCAModal(true)
      }
    },
    {
      id: 'case-view-report',
      category: 'CASES',
      title: 'Inspect Current Forensic Evidence Report',
      subtitle: currentResult ? `View report for Job #${currentResult.job_id}` : 'Open current forensic evidence breakdown modal',
      icon: '🔎',
      action: () => {
        if (currentResult) {
          setShowEvidenceModal(true)
        } else {
          setActiveTab('scanner')
        }
        setShowCommandPalette(false)
      }
    },
    {
      id: 'case-refresh-ledger',
      category: 'CASES',
      title: 'Refresh Cases & DMCA Ledger',
      subtitle: 'Fetch latest case records from database backend',
      icon: '🔄',
      action: () => {
        refreshCases()
        setActiveTab('cases')
        setShowCommandPalette(false)
      }
    }
  ]

  // Dynamic Recent Scan / Investigation search items
  const scanSearchItems: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = []

    // Add scans from Zustand store results
    results.forEach((r, idx) => {
      const decision = r.ai_analysis.decision
      const color = decision === 'ALLOW' ? '#22c55e' : (decision === 'REVIEW REQUIRED' || decision === 'SUSPECT' ? '#f59e0b' : '#ef4444')
      list.push({
        id: `scan-res-${r.job_id}-${idx}`,
        category: 'RECENT SCANS',
        title: `${r.platform}: ${r.caption || r.job_id}`,
        subtitle: `Job #${r.job_id} · @${r.username} · ML Conf: ${r.ml.confidence != null ? `${Math.round(r.ml.confidence * 100)}%` : 'N/A'}`,
        icon: decision === 'ALLOW' ? '✅' : '🚨',
        badge: decision,
        badgeColor: color,
        action: () => {
          setCurrentResult(r)
          setShowEvidenceModal(true)
          setShowCommandPalette(false)
        }
      })
    })

    // Add open cases
    cases.forEach((c) => {
      list.push({
        id: `case-rec-${c.case_id}`,
        category: 'CASES',
        title: `Case #${c.case_id}: @${c.username} (${c.platform})`,
        subtitle: `Status: ${c.status.toUpperCase()} · Severity: ${c.severity} · Decision: ${c.decision}`,
        icon: '📋',
        badge: c.status.toUpperCase(),
        badgeColor: c.status === 'resolved' ? '#22c55e' : '#fb923c',
        action: () => {
          setActiveTab('cases')
          setShowCommandPalette(false)
        }
      })
    })

    return list
  }, [results, cases, setCurrentResult, setShowEvidenceModal, setActiveTab, setShowCommandPalette])

  // Filter items based on user query
  const allItems = useMemo(() => {
    const base = [...workflowItems, ...caseItems, ...navItems, ...scanSearchItems]
    if (!query.trim()) return base

    const q = query.toLowerCase()
    return base.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q))
    )
  }, [query, workflowItems, caseItems, navItems, scanSearchItems])

  // Dynamic grouping
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    allItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    })
    return groups
  }, [allItems])

  if (!showCommandPalette) return null

  let globalIndexCounter = 0

  return (
    <div
      onClick={() => setShowCommandPalette(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(8, 12, 16, 0.82)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#0d1117',
          border: '1px solid #1e2d3d',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 212, 255, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '78vh'
        }}
      >
        {/* Command Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid #1e2d3d',
          background: '#090d12'
        }}>
          <span style={{ fontSize: 20, color: '#00d4ff' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search investigations, trigger analysis, create cases, navigate... (Ctrl+K)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontWeight: 600,
              color: '#f8fafc',
              fontFamily: 'inherit'
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          )}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#64748b',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #334155',
            padding: '2px 8px',
            borderRadius: 5
          }}>
            ESC
          </span>
        </div>

        {/* Action Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          {allItems.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>No matching investigations or commands found</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Try searching for "deepfake", "crop", "cases", "YouTube", or "scan"</div>

              <button
                onClick={() => {
                  setShowCommandPalette(false)
                  setShowDMCAModal(true)
                }}
                style={{
                  marginTop: 16,
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#38bdf8',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ➕ Create New Case for "{query}"
              </button>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                {/* Category Header */}
                <div style={{
                  padding: '6px 12px 4px 12px',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#475569',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{category}</span>
                  <span>{items.length}</span>
                </div>

                {/* Group Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map(item => {
                    const currentIndex = globalIndexCounter++
                    const isSelected = currentIndex === selectedIndex

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          item.action()
                          setShowCommandPalette(false)
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 212, 255, 0.04) 100%)' : 'transparent',
                          border: isSelected ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid transparent',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <span style={{
                            fontSize: 16,
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            background: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {item.icon}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? '#38bdf8' : '#f8fafc',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div style={{
                                fontSize: 11,
                                color: '#64748b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                          {item.badge && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: `${item.badgeColor || '#38bdf8'}20`,
                              color: item.badgeColor || '#38bdf8',
                              border: `1px solid ${item.badgeColor || '#38bdf8'}40`
                            }}>
                              {item.badge}
                            </span>
                          )}

                          {item.shortcut && (
                            <span style={{
                              fontSize: 10,
                              fontFamily: 'monospace',
                              color: '#64748b',
                              background: '#1e293b',
                              padding: '2px 6px',
                              borderRadius: 4
                            }}>
                              {item.shortcut}
                            </span>
                          )}

                          {isSelected && (
                            <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700 }}>
                              ↵ Run
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div style={{
          padding: '10px 16px',
          background: '#090d12',
          borderTop: '1px solid #1e2d3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span><kbd style={{ background: '#1e293b', padding: '2px 5px', borderRadius: 3, color: '#94a3b8' }}>↑↓</kbd> Navigate</span>
            <span><kbd style={{ background: '#1e293b', padding: '2px 5px', borderRadius: 3, color: '#94a3b8' }}>↵</kbd> Select / Execute</span>
            <span><kbd style={{ background: '#1e293b', padding: '2px 5px', borderRadius: 3, color: '#94a3b8' }}>ESC</kbd> Close</span>
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#00d4ff', fontWeight: 600 }}>
            VeriMedia Palette v23
          </div>
        </div>
      </div>
    </div>
  )
}
