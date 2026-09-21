// VeriMedia AI — Result Mode Helper
// Robust distinction between live real media investigations and simulated benchmark demo scenarios.

/**
 * Checks if a detection/investigation result represents a simulated demo benchmark scenario
 * (such as Deepfake Synthetic Dub, Scam Phishing, or Authentic Master Wire benchmark presets).
 * 
 * Returns FALSE for real user uploads and live pipeline executions (where scenario === 'real_pipeline'
 * or mode === 'LIVE', or standard unsimulated scans).
 */
export function isSimulatedResult(result: any): boolean {
  if (!result) return false

  // Explicit demo / simulation flags
  if (result.is_demo === true || result.isDemo === true) return true
  if (result.mode === 'SIMULATED_SCENARIO' || result.mode === 'DEMO') return true

  // Real pipeline tags explicitly take precedence
  if (result.scenario === 'real_pipeline' || result.scenario === 'live_scan' || result.scenario === 'real') {
    return false
  }
  if (result.mode === 'LIVE' || result.mode === 'REAL') {
    return false
  }

  // Known demo scenario preset identifiers
  const simulatedScenarios = new Set([
    'deepfake',
    'scam',
    'authentic',
    'crop',
    'adversarial',
    'synthetic'
  ])

  if (typeof result.scenario === 'string' && simulatedScenarios.has(result.scenario.toLowerCase())) {
    return true
  }

  return false
}

/**
 * Convenience helper: returns true if the result represents a genuine, live media scan.
 */
export function isRealScan(result: any): boolean {
  if (!result) return false
  return !isSimulatedResult(result)
}
