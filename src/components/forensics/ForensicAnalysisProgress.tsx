import { useStore } from '../../store'

export function ForensicAnalysisProgress() {
  const { 
    isScanning, 
    scanProgress, 
    scanStageTitle, 
    scanStageDetail, 
    scanStages 
  } = useStore()

  if (!isScanning) return null

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2d3d',
      borderRadius: 8,
      padding: '16px 20px',
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          {scanStageTitle}
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
          {Math.round(scanProgress)}%
        </span>
      </div>
      
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px 0' }}>
        {scanStageDetail}
      </p>
      
      <div style={{ height: 4, background: '#1e2d3d', borderRadius: 2, overflow: 'hidden' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${scanProgress}%`, 
            background: 'linear-gradient(90deg, #00d4ff 0%, #0ea5e9 100%)', 
            borderRadius: 2,
            transition: 'width 0.3s ease' 
          }} 
        />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {scanStages.map((stage, idx) => (
          <div 
            key={stage.key}
            style={{ 
              flex: 1, 
              height: 2, 
              background: stage.status === 'COMPLETED' ? '#22c55e' : (stage.status === 'RUNNING' ? '#00d4ff' : '#1e2d3d'),
              borderRadius: 1 
            }}
            title={stage.label}
          />
        ))}
      </div>
    </div>
  )
}
