// VeriMedia AI — Query Signals Builder (Phase 15)
// Extracts genuine search terms from artifact content, visual descriptions, OCR text, EXIF attributes, or user queries.

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
      confidence: 0.9
    });
  }

  // Parse artifact metadata if present
  let meta = null;
  if (artifact && artifact.metadata) {
    try {
      meta = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
    } catch (_) {}
  }

  // 3. Visual Content Description (from Gemini Multimodal Vision inspection)
  const subjectDesc = meta?.forensicAnalysis?.subjectDescription ||
    meta?.forensicAnalysis?.subject_description ||
    meta?.classification?.description;
  if (subjectDesc && typeof subjectDesc === 'string' && subjectDesc.trim().length > 5) {
    const cleanDesc = subjectDesc.trim().replace(/^["']|["']$/g, '');
    signals.push({
      term: cleanDesc,
      source: 'VISUAL_CONTENT_DESCRIPTION',
      confidence: 0.95
    });
  }

  // 4. Extracted OCR Text from the image/document
  const ocrText = meta?.forensicAnalysis?.ocr?.text || meta?.ocr?.text;
  if (ocrText && typeof ocrText === 'string' && ocrText.trim().length > 3) {
    const cleanOcr = ocrText.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (cleanOcr.length > 5) {
      signals.push({
        term: cleanOcr.slice(0, 150),
        source: 'OCR_EXTRACTED_TEXT',
        confidence: 0.85
      });
    }
  }

  // 5. EXIF Title / Headline / Description tags if present
  const exif = meta?.exif || meta?.forensicAnalysis?.exif;
  if (exif) {
    const exifText = exif.ImageDescription || exif.XPTitle || exif.Headline || exif.UserComment || exif.title;
    if (exifText && typeof exifText === 'string' && exifText.trim().length > 4) {
      signals.push({
        term: exifText.trim(),
        source: 'EXIF_DESCRIPTION',
        confidence: 0.8
      });
    }

    if (exif.DateTimeOriginal) {
      signals.push({
        term: exif.DateTimeOriginal.slice(0, 10),
        source: 'EXIF_DATE',
        confidence: 0.5
      });
    }
  }

  // 6. Artifact filename if descriptive (excluding hashes, auto-generated strings, and generic names)
  if (artifact && artifact.filename) {
    const cleanName = artifact.filename
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim();
    
    // Ignore random hex strings, numbers, or default camera/upload names (e.g. IMG_1234, upload, blob, screenshot)
    const isGeneric = /^[a-f0-9]{16,}$/i.test(cleanName) ||
      /^(image|video|file|upload|blob|screenshot|scan|photo|media|img_\d+|dsc_\d+)$/i.test(cleanName.replace(/\s+/g, ''));

    if (cleanName.length > 3 && !isGeneric) {
      signals.push({
        term: cleanName,
        source: 'ARTIFACT_FILENAME',
        confidence: 0.6
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
