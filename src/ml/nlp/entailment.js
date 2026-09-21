/**
 * VeriMedia AI — Natural Language Inference & Evidence Polarity Classifier
 * Path: src/ml/nlp/entailment.js
 *
 * Uses @xenova/transformers zero-shot-classification with Xenova/nli-deberta-v3-xsmall.
 * Evaluates the evidentiary relationship between an asserted claim and observed textual evidence.
 * Maps NLI predictions to evidence polarity:
 *  - 'supports' -> 'SUPPORTING'
 *  - 'contradicts' -> 'CONTRADICTING'
 *  - 'is unrelated to' -> 'NEUTRAL'
 *
 * Epistemic & Operational Guarantees:
 * - Lazy-loaded and cached singleton pipeline.
 * - Calibrated forensic confidence output hard-clamped to [0.15, 0.92].
 * - Safe heuristic fallback on model download / execution exceptions.
 * - Prohibition of absolute certainty terminology.
 */

let classifierPipeline = null;
let isInitializing = false;

/**
 * Lazy loads and caches the DeBERTa-v3 zero-shot NLI pipeline singleton.
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
    console.warn('[Entailment Engine] Transformer pipeline initialization notice, using fallback:', err.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Heuristic semantic fallback when transformer inference is unavailable.
 * Clamps confidence strictly to the calibrated [0.15, 0.92] band.
 */
function fallbackClassifyEntailment(claimText = '', evidenceText = '') {
  const claim = String(claimText || '').toLowerCase().trim();
  const ev = String(evidenceText || '').toLowerCase().trim();

  if (!claim || !ev) {
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
 * Evaluates semantic entailment between a claim statement and observed evidence text.
 *
 * @param {string} claimText - Asserted claim statement.
 * @param {string} evidenceText - Contextual observation or reported source text.
 * @param {object} [options] - Optional execution parameters.
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

    const rawScores = {};
    for (let i = 0; i < labels.length; i++) {
      rawScores[labels[i]] = Number((scores[i] || 0).toFixed(4));
    }

    // Hard clamp confidence within calibrated forensic interval [0.15, 0.92]
    const clampedConfidence = Number(Math.max(0.15, Math.min(0.92, topRawScore)).toFixed(2));

    return {
      polarity,
      confidence: clampedConfidence,
      label: topLabel,
      rawScores,
      isFallback: false
    };
  } catch (err) {
    console.warn('[Entailment Engine] Inference exception, using fallback:', err.message);
    return fallbackClassifyEntailment(cleanClaim, cleanEvidence);
  }
}
