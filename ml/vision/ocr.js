/**
 * VeriMedia AI — Persistent Worker Optical Character Recognition (OCR)
 * Wraps tesseract.js with a reusable singleton worker.
 * Leverages the local eng.traineddata language model located in the repository root.
 *
 * Epistemic & Operational Guarantees:
 * - Persistent worker cached at module level across all requests.
 * - Confidence hard-clamped to [0.15, 0.92] calibrated range.
 * - Prohibits uncalibrated certainty claims.
 */

import { createWorker } from 'tesseract.js';

let persistentWorkerPromise = null;
let isInitializingWorker = false;

/**
 * Retrieves or initializes the persistent Tesseract worker.
 */
async function getPersistentWorker() {
  if (persistentWorkerPromise) return persistentWorkerPromise;
  if (isInitializingWorker) {
    while (isInitializingWorker) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (persistentWorkerPromise) return persistentWorkerPromise;
  }

  isInitializingWorker = true;
  persistentWorkerPromise = (async () => {
    try {
      const worker = await createWorker('eng', 1, {
        langPath: process.cwd(),
        cachePath: process.cwd(),
        logger: () => {}, // Suppress verbose stdout logging
        errorHandler: () => {}
      });
      return worker;
    } catch (err) {
      console.warn('[OCR Engine] Persistent worker initialization error:', err.message);
      persistentWorkerPromise = null;
      return null;
    } finally {
      isInitializingWorker = false;
    }
  })();

  return persistentWorkerPromise;
}

/**
 * Extracts visible textual statements from an image buffer using persistent Tesseract OCR.
 *
 * @param {Buffer} buffer - Image binary buffer.
 * @param {object} [options]
 * @returns {Promise<{
 *   text: string,
 *   confidence: number,
 *   wordCount: number,
 *   hasText: boolean,
 *   status: 'EXTRACTED' | 'NO_TEXT_DETECTED' | 'FAILED' | 'EMPTY_INPUT',
 *   error?: string
 * }>}
 */
export async function extractTextFromImage(buffer, options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      text: '',
      confidence: 0.15,
      wordCount: 0,
      hasText: false,
      status: 'EMPTY_INPUT'
    };
  }

  try {
    const worker = await getPersistentWorker();
    if (!worker) {
      return {
        text: '',
        confidence: 0.15,
        wordCount: 0,
        hasText: false,
        status: 'FAILED',
        error: 'OCR worker unavailable'
      };
    }

    const { data } = await worker.recognize(buffer);
    const rawText = (data?.text || '').trim();
    const words = rawText.split(/\s+/).filter(w => w.length > 0);

    const rawConfidence = typeof data?.confidence === 'number'
      ? data.confidence / 100
      : (words.length > 0 ? 0.70 : 0.15);

    // Hard clamp confidence within calibrated band [0.15, 0.92]
    const clampedConfidence = Number(Math.max(0.15, Math.min(0.92, rawConfidence)).toFixed(2));

    return {
      text: rawText,
      confidence: clampedConfidence,
      wordCount: words.length,
      hasText: words.length > 0 && rawText.length >= 3,
      status: words.length > 0 ? 'EXTRACTED' : 'NO_TEXT_DETECTED'
    };
  } catch (err) {
    console.warn('[OCR Engine] Text extraction failure, falling back safely:', err.message);
    return {
      text: '',
      confidence: 0.15,
      wordCount: 0,
      hasText: false,
      status: 'FAILED',
      error: err.message
    };
  }
}
