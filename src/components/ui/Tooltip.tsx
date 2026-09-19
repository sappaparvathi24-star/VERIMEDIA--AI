import React, { useState, useRef } from 'react'

export interface TooltipProps {
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function Tooltip({
  content,
  position = 'bottom',
  delay = 120,
  children,
  style,
  className = '',
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setVisible(false)
  }

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'top':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(-6px)',
        }
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%) translateX(-6px)',
        }
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%) translateX(6px)',
        }
      case 'bottom':
      default:
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(6px)',
        }
    }
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`vm-tooltip-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {children}
      {visible && content && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 9999,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            padding: '6px 10px',
            borderRadius: 6,
            background: '#0d131f',
            border: '1px solid #1e2e42',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            color: '#e2e8f0',
            fontSize: 11,
            lineHeight: 1.35,
            fontWeight: 500,
            animation: 'vm-tooltip-fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
