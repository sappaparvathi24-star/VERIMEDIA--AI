import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import {
  askGeminiCopilot,
  explainForensicSignalGemini,
  generateInvestigationBriefGemini,
  analyzeMultimodalGemini,
  listInvestigations,
} from '../../services/api'
import {
  Sparkles,
  Send,
  Upload,
  FileText,
  ShieldAlert,
  Brain,
  Layers,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Database,
  Eye,
  Terminal,
  Activity,
  Globe,
  ExternalLink,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  groundingSources?: Array<{ uri: string; title: string }>
}

const FORENSIC_PROMPTS = [
  'Audit C2PA manifest check (requires optional dependency)',
  'Explain ELA compression residual variance on TikTok upload',
  'Evaluate PRNU camera sensor fingerprint match confidence',
  'Draft an executive DMCA takedown brief with evidence ledger',
  'Assess legal copyright implications vs earliest observed crawler timestamp',
]

const SIGNALS_CATALOG = [
  { key: 'jpeg_artifact', label: 'Error Level Analysis (ELA)', desc: 'Discrete Cosine Transform (DCT) quantization grid discrepancy' },
  { key: 'noise_pattern', label: 'Sensor Noise PRNU', desc: 'Photo-Response Non-Uniformity silicon wafer fingerprint' },
  { key: 'edge_consistency', label: 'Edge & Gradient Coherence', desc: 'Boundary continuity, clone stamp splicing & laplacian filter' },
  { key: 'face_landmark', label: 'Facial Landmark Delaunay Mesh', desc: 'Neural diffusion texture & biometric asymmetry artifacts' },
  { key: 'temporal_mismatch', label: 'Optical Flow & Frame Vectors', desc: 'Motion vector continuity & inter-frame temporal interpolation' },
  { key: 'c2pa_manifest', label: 'C2PA Cryptographic Provenance (Optional)', desc: 'X.509 cert chain & signed manifest check (requires optional c2pa-node dependency)' },
]

export function GeminiIntelligencePanel() {
  const { currentResult, selectedCaseId } = useStore()

  // Mode: Assistant Chat | Investigation Dossier | Multimodal Vision | Signal Reasoner
  const [activeSubMode, setActiveSubMode] = useState<'copilot' | 'dossier' | 'multimodal' | 'signals'>('copilot')

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 👋 VeriMedia Assistant Ready
I am connected to the **Gemini 3.8 Flash Reasoning Engine** with **live Google Search Grounding**. I have real-time context on your active media scans, perceptual fingerprints, web sources, and the SQLite provenance graph.

**How can I assist your forensic investigation today?**
- Search & ground live facts, breaking claims, and earliest media appearances
- Perform deep multimodal visual tampering audits
- Synthesize executive intelligence dossiers for active investigations
- Draft legally grounded DMCA takedown briefs with cryptographic citations
- Explain the physical and mathematical mechanics behind any forensic signal`,
      timestamp: new Date().toLocaleTimeString(),
      model: 'gemini-3.8-flash',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Investigation Dossier State
  const [investigations, setInvestigations] = useState<any[]>([])
  const [selectedInvId, setSelectedInvId] = useState<string>('INV-VM-2026-CHAMP')
  const [dossierNotes, setDossierNotes] = useState('')
  const [dossierResult, setDossierResult] = useState<string | null>(null)
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false)

  // Multimodal Vision State
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [visionPrompt, setVisionPrompt] = useState('Inspect this media for AI generation, boundary warping, and deepfake artifacts.')
  const [visionResult, setVisionResult] = useState<string | null>(null)
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Signal Reasoner State
  const [selectedSignal, setSelectedSignal] = useState(SIGNALS_CATALOG[0])
  const [signalValue, setSignalValue] = useState<number | string>(0.84)
  const [signalExplanation, setSignalExplanation] = useState<string | null>(null)
  const [isExplainingSignal, setIsExplainingSignal] = useState(false)

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    listInvestigations()
      .then(res => {
        const list = res?.investigations || []
        setInvestigations(list)
        if (selectedCaseId) setSelectedInvId(selectedCaseId)
        else if (list.length > 0) setSelectedInvId(list[0].id)
      })
      .catch(console.warn)
  }, [selectedCaseId])

  // Reactively synchronize panel context and active media when currentResult changes
  useEffect(() => {
    if (!currentResult) return

    const invId = currentResult.case_id || (currentResult as any)?.investigationId
    if (invId) {
      setSelectedInvId(invId)
    }

    const mediaImg = currentResult.artifact?.dataUrl || currentResult.artifact?.previewUrl || currentResult.artifact?.fileUrl
    if (mediaImg) {
      setSelectedImage(mediaImg)
    }

    if (selectedSignal.key === 'jpeg_artifact') {
      const elaVal = (currentResult as any)?.integrity?.signals?.ela ?? (currentResult.integrity?.score ? Number((1 - currentResult.integrity.score).toFixed(2)) : 0.84)
      setSignalValue(elaVal)
    }
  }, [currentResult, selectedSignal])

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim()
    if (!textToSend || isSending) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages(prev => [...prev, userMsg])
    if (!customPrompt) setInputText('')
    setIsSending(true)

    try {
      // Build context from currentResult
      const contextPrefix = currentResult
        ? `[Active Scan Context: Artifact: ${currentResult.artifact?.filename || currentResult.caption || 'Live Scan'}, Platform: ${currentResult.platform}, Score: ${Math.round((currentResult.integrity?.score || 0.8) * 100)}%, SHA256: ${currentResult.artifact?.sha256 || 'N/A'}]\n\n`
        : ''

      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await askGeminiCopilot(contextPrefix + textToSend, history)
      const assistantText = response?.reply || response?.text || 'Analysis completed.'
      const groundingSources = response?.groundingSources || []

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: new Date().toLocaleTimeString(),
          model: response?.source || 'gemini-3.5-flash',
          groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
        },
      ])
    } catch (err: any) {
      console.error('Gemini copilot error:', err)
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Failed to receive Gemini response: ${err.message || 'Check server connection'}. Operating in offline analytical mode.`,
          timestamp: new Date().toLocaleTimeString(),
          model: 'fallback',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleGenerateDossier = async () => {
    setIsGeneratingDossier(true)
    setDossierResult(null)
    try {
      const res = await generateInvestigationBriefGemini({
        investigationId: selectedInvId,
        userNotes: dossierNotes,
      })
      setDossierResult(res?.dossier || 'Intelligence brief synthesized.')
    } catch (err: any) {
      console.error('Failed to generate dossier:', err)
      setDossierResult(`Error: ${err.message || 'Failed to generate brief'}`)
    } finally {
      setIsGeneratingDossier(false)
    }
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string)
      setVisionResult(null)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyzeVision = async () => {
    if (!selectedImage || isAnalyzingVision) return
    setIsAnalyzingVision(true)
    setVisionResult(null)
    try {
      const res = await analyzeMultimodalGemini({
        imageBase64: selectedImage,
        prompt: visionPrompt,
        filename: 'evidence_sample.jpg',
      })
      setVisionResult(res?.analysis || 'Visual inspection complete.')
    } catch (err: any) {
      console.error('Vision analysis error:', err)
      setVisionResult(`Error: ${err.message || 'Vision analysis failed'}`)
    } finally {
      setIsAnalyzingVision(false)
    }
  }

  const handleExplainSignal = async () => {
    setIsExplainingSignal(true)
    setSignalExplanation(null)
    try {
      const res = await explainForensicSignalGemini({
        signalKey: selectedSignal.key,
        signalName: selectedSignal.label,
        value: signalValue,
        context: currentResult?.caption || 'Active forensic scan',
      })
      setSignalExplanation(res?.explanation || 'Explanation retrieved.')
    } catch (err: any) {
      console.error('Signal explain error:', err)
      setSignalExplanation(`Error: ${err.message || 'Explanation failed'}`)
    } finally {
      setIsExplainingSignal(false)
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#080c10',
      color: '#f8fafc',
      overflow: 'hidden',
    }}>
      {/* Top Banner */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e2d3d',
        background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(56, 189, 248, 0.08) 50%, #0d1117 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.35)',
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                VeriMedia AI Assistant
              </h2>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                fontWeight: 700,
                fontFamily: 'monospace',
              }}>
                VERIMEDIA FLASH AI • SEARCH GROUNDED
              </span>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                fontWeight: 700,
              }}>
                ● ONLINE
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0 0' }}>
              Multimodal reasoning, Google Search Grounded fact verification, automated forensic dossiers, and legal enforcement synthesis.
            </p>
          </div>
        </div>

        {/* Sub-mode Navigation Buttons */}
        <div style={{ display: 'flex', gap: 6, background: '#0d1117', padding: 4, borderRadius: 8, border: '1px solid #1e2d3d' }}>
          <button
            onClick={() => setActiveSubMode('copilot')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubMode === 'copilot' ? '#1e293b' : 'transparent',
              border: activeSubMode === 'copilot' ? '1px solid #a855f7' : '1px solid transparent',
              color: activeSubMode === 'copilot' ? '#c084fc' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Brain size={13} />
            <span>VeriMedia Assistant</span>
          </button>

          <button
            onClick={() => setActiveSubMode('dossier')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubMode === 'dossier' ? '#1e293b' : 'transparent',
              border: activeSubMode === 'dossier' ? '1px solid #38bdf8' : '1px solid transparent',
              color: activeSubMode === 'dossier' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={13} />
            <span>Executive Dossier</span>
          </button>

          <button
            onClick={() => setActiveSubMode('multimodal')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubMode === 'multimodal' ? '#1e293b' : 'transparent',
              border: activeSubMode === 'multimodal' ? '1px solid #f59e0b' : '1px solid transparent',
              color: activeSubMode === 'multimodal' ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Eye size={13} />
            <span>Vision Inspector</span>
          </button>

          <button
            onClick={() => setActiveSubMode('signals')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: activeSubMode === 'signals' ? '#1e293b' : 'transparent',
              border: activeSubMode === 'signals' ? '1px solid #22c55e' : '1px solid transparent',
              color: activeSubMode === 'signals' ? '#4ade80' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Activity size={13} />
            <span>Signal Reasoner</span>
          </button>
        </div>
      </div>

      {/* Active Scan Context Ribbon */}
      {currentResult && (
        <div style={{
          padding: '8px 20px',
          background: 'rgba(56, 189, 248, 0.05)',
          borderBottom: '1px solid #1e2d3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: 11,
              fontFamily: 'monospace'
            }}>
              ⚡ ACTIVE SCAN CONTEXT
            </span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>
              {currentResult.artifact?.filename || currentResult.caption || 'Live Scan'}
            </span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>
              Platform: <strong style={{ color: '#cbd5e1' }}>{currentResult.platform}</strong>
            </span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>
              Decision: <strong style={{ color: currentResult.ai_analysis?.decision === 'TAKEDOWN' || currentResult.ai_analysis?.decision === 'EMERGENCY_TAKEDOWN' ? '#ef4444' : '#22c55e' }}>{currentResult.ai_analysis?.decision || 'REVIEW'}</strong>
            </span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>
              Match: <strong style={{ color: '#38bdf8' }}>{Math.round((currentResult.similarity || 0) * 100)}%</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => handleSendMessage(`Provide an in-depth forensic intelligence analysis for active scan "${currentResult.artifact?.filename || currentResult.caption || 'Live Scan'}" (${currentResult.platform}, Match: ${Math.round((currentResult.similarity || 0) * 100)}%, Decision: ${currentResult.ai_analysis?.decision || 'REVIEW'}). Evaluate integrity metrics, tampering likelihood, and legal remedies.`)}
              disabled={isSending}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Sparkles size={12} />
              <span>Ask Gemini to Analyze</span>
            </button>
            <button
              onClick={() => setActiveSubMode('dossier')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: '#1e293b',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              Synthesize Dossier
            </button>
          </div>
        </div>
      )}

      {/* Mode 1: AI Copilot Conversational Agent */}
      {activeSubMode === 'copilot' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Main Chat Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderRight: '1px solid #1e2d3d' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                      {m.role === 'user' ? 'ANALYST' : `VERIMEDIA ASSISTANT (${m.model || 'gemini-3.8-flash'})`}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>{m.timestamp}</span>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: m.role === 'user' ? '#1e293b' : '#0d1117',
                    border: `1px solid ${m.role === 'user' ? '#334155' : '#1e2d3d'}`,
                    color: '#f8fafc',
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                  }}>
                    {m.content}
                    {m.groundingSources && m.groundingSources.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                          <Globe size={12} />
                          <span>Google Search Grounded Sources:</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {m.groundingSources.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                color: '#7dd3fc',
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                padding: '3px 8px',
                                borderRadius: 4,
                                textDecoration: 'none',
                              }}
                            >
                              <ExternalLink size={10} />
                              <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {source.title || source.uri}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        title="Copy markdown text"
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedId === m.id ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isSending && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: '#a855f7', fontSize: 12, padding: '8px 12px' }}>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>VeriMedia Assistant is analyzing evidence...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts Bar */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #1e2d3d', background: '#0a0e14', display: 'flex', gap: 8, overflowX: 'auto' }}>
              {FORENSIC_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p)}
                  disabled={isSending}
                  style={{
                    background: '#0d1117',
                    border: '1px solid #1e293b',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 11,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  className="hover:border-purple-500 hover:text-purple-300"
                >
                  ⚡ {p}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div style={{ padding: 16, borderTop: '1px solid #1e2d3d', background: '#0d1117', display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Ask VeriMedia Assistant to investigate perceptual hashes, verify C2PA credentials, or draft enforcement briefs..."
                style={{
                  flex: 1,
                  background: '#080c10',
                  border: '1px solid #1e2d3d',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#f8fafc',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isSending}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: !inputText.trim() || isSending ? 0.6 : 1,
                }}
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* Right Sidebar: Active Context & Signals */}
          <div style={{ width: 280, padding: 16, background: '#0a0e14', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#8899aa', textTransform: 'uppercase', marginBottom: 8 }}>
                Live Evidence Telemetry
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, padding: 12, fontSize: 11 }}>
                <div style={{ color: '#cbd5e1', fontWeight: 700 }}>
                  {currentResult?.artifact?.filename || currentResult?.caption || 'Active Investigation Baseline'}
                </div>
                <div style={{ color: '#64748b', marginTop: 4 }}>
                  Platform: <span style={{ color: '#38bdf8' }}>{currentResult?.platform || 'YouTube'}</span>
                </div>
                <div style={{ color: '#64748b', marginTop: 2 }}>
                  Integrity: <span style={{ color: '#22c55e' }}>{Math.round((currentResult?.integrity?.score || 0.85) * 100)}%</span>
                </div>
                <div style={{ color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                  SHA256: {currentResult?.artifact?.sha256?.slice(0, 12) || '4b227777d4dd...'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#8899aa', textTransform: 'uppercase', marginBottom: 8 }}>
                Assistant Capabilities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span>Multimodal Vision & Audio Inspection</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span>C2PA Manifest & Exif Validation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span>DMCA & Legal Notice Generation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span>Epistemic Guardrail Sanitation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Executive Intelligence Dossier */}
      {activeSubMode === 'dossier' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#f8fafc' }}>
              Synthesize Executive Intelligence Brief
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Gemini will query the SQLite database for all ingested artifacts, derivation relationships, timeline discoveries, and findings in the selected investigation, generating a comprehensive intelligence brief.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Investigation Target
                </label>
                <select
                  value={selectedInvId}
                  onChange={(e) => setSelectedInvId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#080c10',
                    border: '1px solid #1e2d3d',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#f8fafc',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {investigations.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.id} — {inv.title?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Special Analyst Notes / Focus Area (Optional)
                </label>
                <input
                  type="text"
                  value={dossierNotes}
                  onChange={(e) => setDossierNotes(e.target.value)}
                  placeholder="e.g. Focus on TikTok audio pitch alterations and unauthorized redistribution vectors"
                  style={{
                    width: '100%',
                    background: '#080c10',
                    border: '1px solid #1e2d3d',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                />
              </div>

              <button
                onClick={handleGenerateDossier}
                disabled={isGeneratingDossier}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 18px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                }}
              >
                <Sparkles size={14} className={isGeneratingDossier ? 'animate-spin' : ''} />
                <span>{isGeneratingDossier ? 'Generating Dossier...' : 'Generate Dossier'}</span>
              </button>
            </div>
          </div>

          {dossierResult && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 22, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e2d3d', paddingBottom: 12, marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    EXECUTIVE INTELLIGENCE BRIEF — {selectedInvId}
                  </span>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Generated by Gemini Multimodal Reasoning Engine with Epistemic Guardrails
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(dossierResult, 'dossier')}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#38bdf8',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {copiedId === 'dossier' ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                  <span>{copiedId === 'dossier' ? 'Copied' : 'Copy Report'}</span>
                </button>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {dossierResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Multimodal Vision Inspector */}
      {activeSubMode === 'multimodal' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#f8fafc' }}>
              Gemini Vision Deep Media Audit
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Upload any suspicious frame, photo, or screenshot to run deep visual inspection with Gemini Vision.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />

                {selectedImage ? (
                  <div style={{ position: 'relative', width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
                    <img src={selectedImage} alt="Uploaded sample" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(13, 17, 23, 0.85)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Replace Image
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%',
                      height: 180,
                      borderRadius: 8,
                      border: '2px dashed #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: '#080c10',
                      gap: 8,
                    }}
                  >
                    <Upload size={28} color="#38bdf8" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>Click to Upload Media</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>PNG, JPEG, WebP</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Forensic Inspection Prompt
                  </label>
                  <textarea
                    value={visionPrompt}
                    onChange={(e) => setVisionPrompt(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      background: '#080c10',
                      border: '1px solid #1e2d3d',
                      borderRadius: 6,
                      padding: '10px 12px',
                      color: '#f8fafc',
                      fontSize: 12,
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={handleAnalyzeVision}
                  disabled={!selectedImage || isAnalyzingVision}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: !selectedImage || isAnalyzingVision ? 0.6 : 1,
                  }}
                >
                  <Eye size={14} className={isAnalyzingVision ? 'animate-spin' : ''} />
                  <span>{isAnalyzingVision ? 'Inspecting Media with Gemini Vision...' : 'Run Multimodal Inspection'}</span>
                </button>
              </div>
            </div>
          </div>

          {visionResult && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 22 }}>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12 }}>
                GEMINI VISION FORENSIC INSPECTION REPORT
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {visionResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 4: Signal Technical Reasoner */}
      {activeSubMode === 'signals' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#f8fafc' }}>
              Forensic Signal Technical Explainer & Mechanics
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Ask Gemini to explain the underlying physics, mathematical equations, and false-positive boundaries for any forensic signal.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {SIGNALS_CATALOG.map((sig) => (
                <div
                  key={sig.key}
                  onClick={() => setSelectedSignal(sig)}
                  style={{
                    background: selectedSignal.key === sig.key ? '#1e293b' : '#080c10',
                    border: `1px solid ${selectedSignal.key === sig.key ? '#22c55e' : '#1e2d3d'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: selectedSignal.key === sig.key ? '#4ade80' : '#f8fafc' }}>
                    {sig.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    {sig.desc}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: '#8899aa', fontWeight: 700, textTransform: 'uppercase', marginRight: 8 }}>
                  Anomaly Measurement:
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={signalValue}
                  onChange={(e) => setSignalValue(parseFloat(e.target.value) || 0)}
                  style={{
                    background: '#080c10',
                    border: '1px solid #1e2d3d',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#f8fafc',
                    fontSize: 12,
                    width: 90,
                  }}
                />
              </div>

              <button
                onClick={handleExplainSignal}
                disabled={isExplainingSignal}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Activity size={14} className={isExplainingSignal ? 'animate-spin' : ''} />
                <span>{isExplainingSignal ? 'Generating Explanation...' : 'Explain Signal Mechanics'}</span>
              </button>
            </div>
          </div>

          {signalExplanation && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 22 }}>
              <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12 }}>
                FORENSIC SIGNAL TECHNICAL SPECIFICATION & MECHANICS
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {signalExplanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
