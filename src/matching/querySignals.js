// VeriMedia AI — Query Signals Builder (Phase 15)
// Extracts genuine search terms from artifact attributes, metadata, or explicit user query.

export function buildQuerySignals(artifact, context = {}) {
  const signals = [];

  // 1. Explicit user-supplied search term
  if (context.query && typeof context.query === 'string' && context.query.trim()) {
    signals.push({
      term: context.query.trim(),
      source: 'USER_SUPPLIED_QUERY',
      confidence: 1.0
    });
  }

  // 2. Claim statement / description if present
  if (context.claimStatement && typeof context.claimStatement === 'string' && context.claimStatement.trim()) {
    signals.push({
      term: context.claimStatement.trim(),
      source: 'CLAIM_STATEMENT',
      confidence: 0.8
    });
  }

  // 3. Artifact filename if descriptive (excluding hashes and generic names)
  if (artifact && artifact.filename) {
    const cleanName = artifact.filename
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim();
    
    // Ignore random 32+ hex strings or default names
    if (cleanName.length > 3 && !/^[a-f0-9]{20,}$/i.test(cleanName) && !/^image|video|file|upload$/i.test(cleanName)) {
      signals.push({
        term: cleanName,
        source: 'ARTIFACT_FILENAME',
        confidence: 0.6
      });
    }
  }

  // 4. EXIF location / date metadata if present
  if (artifact && artifact.metadata) {
    const meta = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
    if (meta.exif?.DateTimeOriginal) {
      signals.push({
        term: meta.exif.DateTimeOriginal.slice(0, 10),
        source: 'EXIF_DATE',
        confidence: 0.5
      });
    }
  }

  return signals;
}

export function getPrimarySearchQuery(signals) {
  if (!signals || signals.length === 0) return null;
  // Sort by confidence descending
  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);
  return sorted[0].term;
}
