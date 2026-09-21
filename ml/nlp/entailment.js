/**
 * VeriMedia AI — Natural Language Inference & Evidence Polarity Classifier
 * Uses @xenova/transformers zero-shot-classification with Xenova/nli-deberta-v3-xsmall.
 * Determines evidentiary polarity: SUPPORTING, CONTRADICTING, or NEUTRAL.
 *
 * Epistemic & Confidence Guarantees:
 * - Hard-clamped confidence output within [0.15, 0.92] band.
 * - Strict prohibition of certainty vocabulary ("proof", "100% authentic", "proves origin", etc.).
 * - Graceful fallback to heuristic semantic analysis on model download/execution failure.
 */

let classifierPipeline = null;
let isInitializing = false;

/**
 * Lazy loads and caches the DeBERTa-v3 NLI pipeline singleton.
 */
async function getClassifierPipeline() {
  if (classifierPipeline) return classifierPipeline;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (classifierPipeline) return classifierPipeline;
  }

  isInitializing = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowRemoteModels = true;
    classifierPipeline = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
    return classifierPipeline;
  } catch (err) {
    console.warn('[Entailment] Transformer pipeline initialization notice, will use fallback:', err.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Heuristic fallback for textual polarity classification when model inference is unavailable.
 * Clamped strictly to [0.15, 0.92].
 */
function fallbackClassifyEntailment(claimText = '', evidenceText = '') {
  const claim = String(claimText || '').toLowerCase();
  const ev = String(evidenceText || '').toLowerCase();

  if (!claim.trim() || !ev.trim()) {
    return {
      polarity: 'NEUTRAL',
      confidence: 0.50,
      label: 'is unrelated to',
      rawScores: { supports: 0.25, contradicts: 0.25, 'is unrelated to': 0.50 },
      isFallback: true
    };
  }

  const contradictionTerms = [
    'not', 'never', 'false', 'fake', 'fabricated', 'debunked', 'refutes',
    'contradicts', 'denies', 'disproven', 'untrue', 'hoax', 'misleading', 'altered'
  ];

  const supportTerms = [
    'confirms', 'verified', 'authentic', 'corroborates', 'matches', 'supports',
    'consistent with', 'accurate', 'original', 'recorded at', 'captured by'
  ];

  let contradictionScore = 0;
  let supportScore = 0;

  for (const term of contradictionTerms) {
    if (ev.includes(term)) contradictionScore += 1;
  }

  for (const term of supportTerms) {
    if (ev.includes(term)) supportScore += 1;
  }

  // Check token overlap
  const claimWords = new Set(claim.split(/\W+/).filter(w => w.length > 3));
  let overlapCount = 0;
  for (const w of claimWords) {
    if (ev.includes(w)) overlapCount += 1;
  }
  const overlapRatio = claimWords.size > 0 ? overlapCount / claimWords.size : 0;

  let polarity = 'NEUTRAL';
  let confidence = 0.50;
  let label = 'is unrelated to';

  if (contradictionScore > supportScore && contradictionScore > 0) {
    polarity = 'CONTRADICTING';
    label = 'contradicts';
    confidence = Math.min(0.88, 0.60 + (contradictionScore * 0.08));
  } else if (supportScore > 0 || overlapRatio >= 0.5) {
    polarity = 'SUPPORTING';
    label = 'supports';
    confidence = Math.min(0.88, 0.60 + (supportScore * 0.06) + (overlapRatio * 0.15));
  } else {
    polarity = 'NEUTRAL';
    label = 'is unrelated to';
    confidence = 0.50;
  }

  // Hard clamp within calibrated forensic band [0.15, 0.92]
  const clampedConfidence = Number(Math.max(0.15, Math.min(0.92, confidence)).toFixed(2));

  return {
    polarity,
    confidence: clampedConfidence,
    label,
    rawScores: {
      supports: polarity === 'SUPPORTING' ? clampedConfidence : 0.20,
      contradicts: polarity === 'CONTRADICTING' ? clampedConfidence : 0.20,
      'is unrelated to': polarity === 'NEUTRAL' ? clampedConfidence : 0.20
    },
    isFallback: true
  };
}

/**
 * Classifies the semantic entailment relationship between a claim and evidence text.
 *
 * @param {string} claimText - The asserted claim under verification.
 * @param {string} evidenceText - The textual observation, caption, or source excerpt.
 * @param {object} [options]
 * @returns {Promise<{
 *   polarity: 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL',
 *   confidence: number,
 *   label: string,
 *   rawScores: Record<string, number>,
 *   isFallback: boolean
 * }>}
 */
export async function classifyEntailment(claimText, evidenceText, options = {}) {
  const cleanClaim = typeof claimText === 'string' ? claimText.trim() : '';
  const cleanEvidence = typeof evidenceText === 'string' ? evidenceText.trim() : '';

  if (!cleanClaim || !cleanEvidence) {
    return fallbackClassifyEntailment(cleanClaim, cleanEvidence);
  }

  try {
    const classifier = await getClassifierPipeline();
    if (!classifier) {
      return fallbackClassifyEntailment(cleanClaim, cleanEvidence);
    }

    const candidateLabels = ['supports', 'contradicts', 'is unrelated to'];
    const hypothesisTemplate = 'This evidence {} the assertion that ' + cleanClaim;

    const result = await classifier(cleanEvidence, candidateLabels, {
      hypothesis_template: hypothesisTemplate
    });

    const labels = result.labels || [];
    const scores = result.scores || [];

    const topLabel = labels[0] || 'is unrelated to';
    const topRawScore = scores[0] || 0.5;

    let polarity = 'NEUTRAL';
    if (topLabel === 'supports') {
      polarity = 'SUPPORTING';
    } else if (topLabel === 'contradicts') {
      polarity = 'CONTRADICTING';
    } else {
      polarity = 'NEUTRAL';
    }

    // Build raw scores map
    const rawScores = {};
    for (let i = 0; i < labels.length; i++) {
      rawScores[labels[i]] = Number((scores[i] || 0).toFixed(4));
    }

    // Hard clamp confidence to [0.15, 0.92]
    const clampedConfidence = Number(Math.max(0.15, Math.min(0.92, topRawScore)).toFixed(2));

    return {
      polarity,
      confidence: clampedConfidence,
      label: topLabel,
      rawScores,
      isFallback: false
    };
  } catch (err) {
    console.warn('[Entailment] Classification inference error, using fallback:', err.message);
    return fallbackClassifyEntailment(cleanClaim, cleanEvidence);
  }
}
