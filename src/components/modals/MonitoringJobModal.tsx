import { useState } from 'react'
import { useStore } from '../../store'
import { listInvestigations, getApiBaseUrl } from '../../services/api'
import { getToken } from '../../lib/supabaseClient'

export interface PlatformOption {
  id: string
  name: string
  category: 'open' | 'closed'
  description: string
  status: 'ACTIVE' | 'URL_ONLY' | 'UNAVAILABLE'
  badgeText: string
}

export const AVAILABLE_PLATFORMS: PlatformOption[] = [
  {
    id: 'REDDIT',
    name: 'Reddit',
    category: 'open',
    description: 'Subreddit search across public media threads & news feeds',
    status: 'ACTIVE',
    badgeText: 'Open API'
  },
  {
    id: 'YOUTUBE',
    name: 'YouTube',
    category: 'open',
    description: 'Video metadata, channel uploads & public broadcast clips',
    status: 'ACTIVE',
    badgeText: 'Data API v3'
  },
  {
    id: 'MASTODON',
    name: 'Mastodon / Fediverse',
    category: 'open',
    description: 'Decentralized public fediverse posts & media attachments',
    status: 'ACTIVE',
    badgeText: 'Public Fediverse'
  },
  {
    id: 'ARCHIVE_ORG',
    name: 'Internet Archive',
    category: 'open',
    description: 'Wayback Machine snapshots & archived web recordings',
    status: 'ACTIVE',
    badgeText: 'Wayback API'
  },
  {
    id: 'GOOGLE_IMAGES',
    name: 'Google Images / Lens',
    category: 'open',
    description: 'Reverse perceptual similarity search & indexed web mirrors',
    status: 'ACTIVE',
    badgeText: 'Custom Search'
  },
  {
    id: 'TIKTOK',
    name: 'TikTok',
    category: 'closed',
    description: 'Short-form viral video indexing (Direct URL import only)',
    status: 'URL_ONLY',
    badgeText: 'URL Proxy Only'
  },
  {
    id: 'INSTAGRAM',
    name: 'Instagram',
    category: 'closed',
    description: 'Meta Graph API closed to generic search; direct URL or screenshot',
    status: 'UNAVAILABLE',
    badgeText: 'API Restricted'
  },
  {
    id: 'TWITTER',
    name: 'X (Twitter)',
    category: 'closed',
    description: 'Commercial API paywall; candidate URL inspection supported',
    status: 'URL_ONLY',
    badgeText: 'Candidate URL'
  },
  {
    id: 'FACEBOOK',
    name: 'Facebook',
    category: 'closed',
    description: 'Closed platform; public URL & manual evidence candidate intake',
    status: 'UNAVAILABLE',
    badgeText: 'API Restricted'
  }
]

export const INTERVAL_SCHEDULES = [
  { id: 'EVERY_15_MIN', label: 'Every 15 Minutes', description: 'Rapid active-threat tracking for breaking virality' },
  { id: 'HOURLY', label: 'Hourly (Recommended)', description: 'Standard hourly surveillance across registered feeds' },
  { id: 'EVERY_6_HOURS', label: 'Every 6 Hours', description: 'Periodic sweep for moderate urgency investigations' },
  { id: 'DAILY', label: 'Daily (24h)', description: 'Automated 24-hour audit and provenance archive check' },
  { id: 'WEEKLY', label: 'Weekly', description: 'Long-term copyright and archive reappearance tracking' }
]

export interface MonitoringJobConfig {
  jobName: string
  selectedPlatforms: string[]
  intervalSchedule: string
  sensitivityThreshold: 'EXACT' | 'HIGH' | 'BROAD'
  notifyOnNewAppearance: boolean
  notifyOnContradiction: boolean
  targetQueryText: string
  notes: string
}

interface Props {
  isOpen?: boolean
  onClose?: () => void
  onSave?: (config: MonitoringJobConfig) => void
}

export function MonitoringJobModal({ isOpen = true, onClose, onSave }: Props) {
  const { setShowMonitoringModal, currentResult } = useStore()

  const [jobName, setJobName] = useState('Automated Reappearance Scan — Media Artifact')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'REDDIT',
    'YOUTUBE',
    'MASTODON',
    'ARCHIVE_ORG',
    'GOOGLE_IMAGES'
  ])
  const [intervalSchedule, setIntervalSchedule] = useState('HOURLY')
  const [sensitivityThreshold, setSensitivityThreshold] = useState<'EXACT' | 'HIGH' | 'BROAD'>('HIGH')
  const [notifyOnNewAppearance, setNotifyOnNewAppearance] = useState(true)
  const [notifyOnContradiction, setNotifyOnContradiction] = useState(true)
  const [targetQueryText, setTargetQueryText] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      setShowMonitoringModal(false)
    }
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const selectAllOpen = () => {
    const openIds = AVAILABLE_PLATFORMS.filter(p => p.category === 'open').map(p => p.id)
    setSelectedPlatforms(openIds)
  }

  const selectAll = () => {
    setSelectedPlatforms(AVAILABLE_PLATFORMS.map(p => p.id))
  }

  const deselectAll = () => {
    setSelectedPlatforms([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const config: MonitoringJobConfig = {
      jobName,
      selectedPlatforms,
      intervalSchedule,
      sensitivityThreshold,
      notifyOnNewAppearance,
      notifyOnContradiction,
      targetQueryText,
      notes
    }

    try {
      // Find the investigation to attach this job to
      const token = await getToken()

      let investigationId: string | null = currentResult?.case_id || null
      if (!investigationId || investigationId === 'CASE-2026-089') {
        try {
          const invs = await listInvestigations()
          const realInvs = (invs || []).filter((i: any) => !i.isDemo)
          if (realInvs.length > 0) investigationId = realInvs[0].id
        } catch (_) {}
      }

      if (!investigationId) {
        // Create a new investigation for this monitoring job if none exist
        const base = getApiBaseUrl()
        const res = await fetch(`${base}/api/investigations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ title: jobName || 'Monitoring Investigation', description: notes || '' })
        })
        const inv = await res.json()
        investigationId = inv?.id || null
      }

      if (investigationId) {
        const base = getApiBaseUrl()
        const res = await fetch(`${base}/api/investigations/${investigationId}/monitoring/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            ...config,
            investigationId
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Server error ${res.status}`)
        }
      }

      setSuccessMessage(`Monitoring job "${jobName}" created and scheduled. First run in ${intervalSchedule.toLowerCase().replace('_', ' ')}.`)
      if (onSave) onSave(config)
      setTimeout(() => handleClose(), 1400)
    } catch (err: any) {
      setSuccessMessage(`⚠ ${err?.message || 'Failed to create monitoring job. Check server connection.'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      id="monitoringJobModalBackdrop"
      className="modal-backdrop"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        id="monitoringJobModalCard"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          backgroundColor: '#0D1322',
          border: '1px solid #1E293B',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(59, 130, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeUp 0.25s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1E293B',
            background: 'linear-gradient(180deg, #131C30 0%, #0D1322 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: '#06B6D4'
              }}
            >
              📡
            </div>
            <div>
              <h2
                id="monitoringModalTitle"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#F1F5F9',
                  fontFamily: 'Inter, sans-serif',
                  margin: 0
                }}
              >
                Schedule Automated Monitoring Job
              </h2>
              <div
                style={{
                  fontSize: 11,
                  color: '#94A3B8',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 2
                }}
              >
                Continuous surveillance & reappearance tracking across social feeds
              </div>
            </div>
          </div>
          <button
            id="btnCloseMonitoringModal"
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: '1px solid #2E3D56',
              borderRadius: 6,
              color: '#94A3B8',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              transition: 'all 0.15s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          {successMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34D399',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>✔</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Job Name */}
          <div>
            <label
              htmlFor="inputJobName"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#F1F5F9',
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Job Name / Identifier *
            </label>
            <input
              id="inputJobName"
              type="text"
              required
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#070A12',
                border: '1px solid #1E293B',
                borderRadius: 6,
                color: '#F1F5F9',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="e.g. 2026 Championship Viral Clip Surveillance"
            />
          </div>

          {/* Platform Selection */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#F1F5F9',
                  fontFamily: 'JetBrains Mono, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Target Monitoring Platforms ({selectedPlatforms.length} Selected) *
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={selectAllOpen}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #1E293B',
                    background: '#131C30',
                    color: '#60A5FA',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  Open APIs Only
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #1E293B',
                    background: '#131C30',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #1E293B',
                    background: '#131C30',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 8,
                maxHeight: 220,
                overflowY: 'auto',
                paddingRight: 4
              }}
            >
              {AVAILABLE_PLATFORMS.map(platform => {
                const isSelected = selectedPlatforms.includes(platform.id)
                const isUnavailable = platform.status === 'UNAVAILABLE'

                return (
                  <div
                    key={platform.id}
                    id={`platformCard_${platform.id}`}
                    onClick={() => togglePlatform(platform.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected
                        ? '1px solid #3B82F6'
                        : '1px solid #1E293B',
                      background: isSelected
                        ? 'rgba(59, 130, 246, 0.08)'
                        : '#10141E',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`chkPlatform_${platform.id}`}
                      checked={isSelected}
                      onChange={() => {}}
                      style={{
                        marginTop: 2,
                        accentColor: '#3B82F6',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isSelected ? '#F1F5F9' : '#94A3B8',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          {platform.name}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontFamily: 'JetBrains Mono, monospace',
                            background:
                              platform.status === 'ACTIVE'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : platform.status === 'URL_ONLY'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color:
                              platform.status === 'ACTIVE'
                                ? '#34D399'
                                : platform.status === 'URL_ONLY'
                                ? '#FBBF24'
                                : '#F87171',
                            border: `1px solid ${
                              platform.status === 'ACTIVE'
                                ? 'rgba(16, 185, 129, 0.25)'
                                : platform.status === 'URL_ONLY'
                                ? 'rgba(245, 158, 11, 0.25)'
                                : 'rgba(239, 68, 68, 0.25)'
                            }`
                          }}
                        >
                          {platform.badgeText}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: '#64748B',
                          marginTop: 3,
                          lineHeight: 1.4
                        }}
                      >
                        {platform.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {selectedPlatforms.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: '#F87171',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 6
                }}
              >
                ⚠️ Please select at least one platform to activate this monitoring job.
              </div>
            )}
          </div>

          {/* Interval Schedule */}
          <div>
            <label
              htmlFor="selectIntervalSchedule"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#F1F5F9',
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Scan Interval Schedule *
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 8
              }}
            >
              {INTERVAL_SCHEDULES.map(sched => {
                const isSelected = intervalSchedule === sched.id
                return (
                  <button
                    key={sched.id}
                    type="button"
                    id={`btnSchedule_${sched.id}`}
                    onClick={() => setIntervalSchedule(sched.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 6,
                      border: isSelected ? '1px solid #06B6D4' : '1px solid #1E293B',
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : '#10141E',
                      color: isSelected ? '#06B6D4' : '#94A3B8',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>{sched.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Query Signals & Sensitivity */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12
            }}
          >
            <div>
              <label
                htmlFor="inputTargetQuery"
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#94A3B8',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 4,
                  textTransform: 'uppercase'
                }}
              >
                Optional Search Query / Keywords
              </label>
              <input
                id="inputTargetQuery"
                type="text"
                value={targetQueryText}
                onChange={e => setTargetQueryText(e.target.value)}
                placeholder="e.g. breaking news broadcast clip"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#070A12',
                  border: '1px solid #1E293B',
                  borderRadius: 6,
                  color: '#F1F5F9',
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label
                htmlFor="selectSensitivity"
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#94A3B8',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 4,
                  textTransform: 'uppercase'
                }}
              >
                Match Sensitivity
              </label>
              <select
                id="selectSensitivity"
                value={sensitivityThreshold}
                onChange={e => setSensitivityThreshold(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#070A12',
                  border: '1px solid #1E293B',
                  borderRadius: 6,
                  color: '#F1F5F9',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="HIGH">High Similarity (pHash ≤ 12 + EXIF)</option>
                <option value="EXACT">Exact Hash Match Only (SHA-256)</option>
                <option value="BROAD">Broad Perceptual (pHash ≤ 18)</option>
              </select>
            </div>
          </div>

          {/* Notification Toggles */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#070A12',
              border: '1px solid #1E293B',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="chkNotifyAppearance"
                checked={notifyOnNewAppearance}
                onChange={e => setNotifyOnNewAppearance(e.target.checked)}
                style={{ accentColor: '#06B6D4' }}
              />
              <label
                htmlFor="chkNotifyAppearance"
                style={{
                  fontSize: 11,
                  color: '#F1F5F9',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer'
                }}
              >
                Trigger high-priority alert when a new candidate sighting is detected
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="chkNotifyContradiction"
                checked={notifyOnContradiction}
                onChange={e => setNotifyOnContradiction(e.target.checked)}
                style={{ accentColor: '#06B6D4' }}
              />
              <label
                htmlFor="chkNotifyContradiction"
                style={{
                  fontSize: 11,
                  color: '#F1F5F9',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer'
                }}
              >
                Flag new appearances whose claimed timestamps contradict verified earliest sighting
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 8,
              borderTop: '1px solid #1E293B'
            }}
          >
            <button
              type="button"
              id="btnCancelMonitoringModal"
              onClick={handleClose}
              style={{
                padding: '9px 16px',
                borderRadius: 6,
                border: '1px solid #2E3D56',
                background: '#131C30',
                color: '#94A3B8',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btnSubmitMonitoringJob"
              disabled={isSubmitting || selectedPlatforms.length === 0}
              style={{
                padding: '9px 20px',
                borderRadius: 6,
                border: '1px solid #06B6D4',
                background: 'linear-gradient(135deg, #0891B2 0%, #2563EB 100%)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: isSubmitting || selectedPlatforms.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || selectedPlatforms.length === 0 ? 0.6 : 1,
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                transition: 'all 0.15s'
              }}
            >
              {isSubmitting ? 'Scheduling Job…' : '⚡ Schedule Monitoring Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
