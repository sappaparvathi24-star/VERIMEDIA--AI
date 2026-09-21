// VeriMedia AI — File Upload State Observer
// Logs every step of the file upload and forensic analysis lifecycle to console & listeners.

export interface UploadStepEvent {
  step:
    | 'File received'
    | 'Uploading to Supabase'
    | 'Artifact registered'
    | 'Triggering forensic analysis'
    | 'Streaming job events'
    | 'Analysis complete'
    | 'Upload error'
    | string
  timestamp: string
  details?: Record<string, any>
}

export type UploadStateListener = (event: UploadStepEvent) => void

class UploadStateObserver {
  private listeners: Set<UploadStateListener> = new Set()
  private history: UploadStepEvent[] = []

  public subscribe(listener: UploadStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public notify(step: string, details?: Record<string, any>): UploadStepEvent {
    const event: UploadStepEvent = {
      step,
      timestamp: new Date().toISOString(),
      details: details || {}
    }

    this.history.push(event)

    // Formatted, high-visibility console log for step observation
    console.log(
      `%c[UploadStateObserver] %c[${event.timestamp.slice(11, 19)}] %cState: %c"${step}"`,
      'color: #00d4ff; font-weight: bold;',
      'color: #94a3b8; font-weight: normal;',
      'color: #38bdf8; font-weight: bold;',
      'color: #f59e0b; font-weight: bold;',
      details ? details : ''
    )

    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (err) {
        console.error('[UploadStateObserver] Error in state listener:', err)
      }
    })

    return event
  }

  public getHistory(): UploadStepEvent[] {
    return [...this.history]
  }

  public clearHistory(): void {
    this.history = []
  }
}

export const uploadStateObserver = new UploadStateObserver()
