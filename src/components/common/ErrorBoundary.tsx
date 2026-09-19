import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VeriMedia Uncaught UI Error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '240px',
          padding: '32px 24px',
          background: '#0d1117',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          margin: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 16, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>
            {this.props.fallbackTitle || 'Component Error Encountered'}
          </h3>
          <p style={{ fontSize: 12, color: '#8899aa', maxWidth: 480, marginBottom: 16, lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <button
            onClick={this.handleReset}
            className="vm-btn vm-btn-primary"
            style={{ padding: '8px 20px', fontSize: 12 }}
          >
            ↻ Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
