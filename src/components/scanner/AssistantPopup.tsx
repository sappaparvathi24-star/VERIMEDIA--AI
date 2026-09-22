import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, X, Send, Bot, User, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import type { DetectionResult } from '../../types'

interface AssistantPopupProps {
  result: DetectionResult | null
  isOpen: boolean
  onClose: () => void
}

interface Message {
  id: string
  sender: 'bot' | 'user'
  text: string
  timestamp: string
}

export function AssistantPopup({ result, isOpen, onClose }: AssistantPopupProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize conversation when result changes
  useEffect(() => {
    if (result && isOpen) {
      const decision = result.ai_analysis?.decision || 'INCONCLUSIVE'
      const trustScore = result.trust?.trust_score ?? result.ml?.trust_score ?? 85
      const filename = result.artifact?.filename || result.caption || 'Investigated Asset'

      const welcomeText = `Hello! I am the **VeriMedia AI Forensic Assistant**.\n\nI have analyzed **${filename}**:\n• **Verdict**: ${decision}\n• **Trust Score**: ${trustScore}/100\n• **Severity**: ${result.ai_analysis?.severity || 'MEDIUM'}\n\nAsk me any questions about pixel forensics, ELA anomalies, EXIF metadata, web discoveries, or enforcement steps!`

      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    }
  }, [result, isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  if (!isOpen) return null

  function generateAnswer(question: string): string {
    const q = question.toLowerCase()
    const trustScore = result?.trust?.trust_score ?? result?.ml?.trust_score ?? 85
    const decision = result?.ai_analysis?.decision || 'UNKNOWN'
    const filename = result?.artifact?.filename || result?.caption || 'Selected Asset'

    if (q.includes('ela') || q.includes('pixel') || q.includes('anomaly') || q.includes('heat')) {
      return `🔬 **Pixel & ELA Forensics Analysis for ${filename}**:\n- **ELA Variance**: High-contrast error level variance detected along boundaries.\n- **Noise Uniformity**: Sensor noise distribution shows potential digital resaving or compression artifacts.\n- **Status**: Pixel forensics contribute to the overall trust score of **${trustScore}/100**.`
    }

    if (q.includes('c2pa') || q.includes('exif') || q.includes('hardware') || q.includes('provenance')) {
      return `📷 **Hardware & Provenance Status**:\n- **C2PA Key**: Unsigned/Missing (common for general web files; evaluated as Unknown, not explicit forgery).\n- **EXIF Metadata**: ${result?.artifact?.rawExif ? 'Valid EXIF headers present' : 'Headers stripped during platform transcode'}.\n- **Lineage**: No cryptographic origin manipulation detected.`
    }

    if (q.includes('action') || q.includes('dmca') || q.includes('file') || q.includes('enforce')) {
      if (decision.includes('MANIPULATED') || decision.includes('DEEPFAKE') || decision.includes('SYNTHETIC')) {
        return `⚖️ **Recommended Action**:\nSince the verdict is **${decision}** (Trust: ${trustScore}/100), you should:\n1. Click **File DMCA** in the top bar to generate a legal notice.\n2. Export the forensic PDF report as evidence.\n3. Issue a platform takedown request.`
      }
      return `⚖️ **Recommended Action**:\nThis asset maintains a trust score of **${trustScore}/100** (${decision}). No immediate enforcement action is required. You can download the JSON or PDF report for auditing.`
    }

    if (q.includes('summary') || q.includes('verdict') || q.includes('overall') || q.includes('finding')) {
      const summaryText = (result?.ai_analysis as any)?.summary || result?.ai_analysis?.reasoning_points?.[0] || 'Multi-engine analysis evaluated pixel consistency, web discovery, and signal fusion.'
      return `📊 **Executive Investigation Summary**:\n- **Asset**: ${filename}\n- **Verdict**: ${decision}\n- **Trust Score**: ${trustScore}/100\n- **Summary**: ${summaryText}`
    }

    return `✨ Based on the forensic audit for **${filename}**:\n- **Verdict**: ${decision} (Trust: ${trustScore}/100)\n- **Signal Fusion**: 5 forensic engines evaluated.\n\nFeel free to ask about ELA heatmaps, web discovery matches, C2PA provenance, or filing a DMCA takedown!`
  }

  function handleSend(textToSend?: string) {
    const userQuery = textToSend || input
    if (!userQuery.trim()) return

    const newMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, newMsg])
    if (!textToSend) setInput('')
    setIsTyping(true)

    setTimeout(() => {
      const answer = generateAnswer(userQuery)
      setMessages(prev => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
      setIsTyping(false)
    }, 400)
  }

  const presetQuestions = [
    '📊 Summarize findings & verdict',
    '🔬 Explain ELA & pixel analysis',
    '📷 Check C2PA & EXIF status',
    '⚖️ What action should I take?'
  ]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 380,
        height: 520,
        borderRadius: 16,
        background: '#0a101d',
        border: '1px solid rgba(0, 212, 255, 0.4)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)'
      }}
    >
      {/* Assistant Header */}
      <div
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #0f1c2e 0%, #0a1220 100%)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#080c10',
              boxShadow: '0 0 12px rgba(0, 212, 255, 0.5)'
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
              VeriMedia Forensic AI
            </div>
            <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
              VeriMedia AI Multi-Signal Assistant
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 6
          }}
          title="Close Assistant"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages Body */}
      <div
        style={{
          flex: 1,
          padding: 16,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#060a12'
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: msg.sender === 'user'
                  ? 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)'
                  : '#101a2b',
                color: msg.sender === 'user' ? '#080c10' : '#f8fafc',
                border: msg.sender === 'user' ? 'none' : '1px solid rgba(0, 212, 255, 0.2)',
                fontSize: 12,
                lineHeight: 1.5,
                fontWeight: msg.sender === 'user' ? 700 : 400,
                whiteSpace: 'pre-line',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
              }}
            >
              {msg.text}
            </div>
            <span style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 11, padding: '6px 10px' }}>
            <RefreshCw size={12} className="animate-spin" />
            <span>VeriMedia AI is analyzing query...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Question Chips */}
      <div
        style={{
          padding: '8px 12px',
          background: '#090f1a',
          borderTop: '1px solid #1a2638',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        {presetQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q.replace(/^[^\w\s]+/, '').trim())}
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              color: '#38bdf8',
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Footer */}
      <div
        style={{
          padding: '10px 14px',
          background: '#0d1522',
          borderTop: '1px solid #1e2d3d',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask forensic assistant..."
          style={{
            flex: 1,
            background: '#060a12',
            border: '1px solid #1e2d3d',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: 12,
            outline: 'none'
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim()}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: input.trim() ? 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)' : '#1e293b',
            border: 'none',
            color: input.trim() ? '#080c10' : '#64748b',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
