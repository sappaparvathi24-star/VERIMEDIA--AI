/**
 * VeriMedia AI — OCR Module
 * Uses tesseract.js to extract text from image buffers.
 * Always returns a result object — never throws to caller.
 */
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

/**
 * Validates that a buffer is a readable image before invoking Leptonica / Tesseract.
 */
async function isReadableImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  try {
    const meta = await sharp(buffer).metadata();
    return Boolean(meta && meta.format && meta.width > 0 && meta.height > 0);
  } catch (_) {
    return false;
  }
}

/**
 * Perform OCR on an image buffer.
 * @param {Buffer} imageBuffer
 * @param {object} [options]
 * @param {string} [options.language] - Tesseract language code (default: 'eng')
 * @returns {Promise<{text: string, confidence: number, wordCount: number, language: string, supported: boolean, error?: string}>}
 */
export async function performOCR(imageBuffer, options = {}) {
  const language = options.language || 'eng';

  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return {
      supported: false,
      text: '',
      confidence: 0,
      wordCount: 0,
      language,
      error: 'No image buffer provided'
    };
  }

  const isValidImage = await isReadableImageBuffer(imageBuffer);
  if (!isValidImage) {
    return {
      supported: false,
      text: '',
      confidence: 0,
      wordCount: 0,
      language,
      error: 'Unsupported or non-image media format'
    };
  }

  let worker = null;
  try {
    worker = await createWorker(language, 1, {
      logger: () => {}, // suppress progress logs
      errorHandler: () => {}
    });

    const { data } = await worker.recognize(imageBuffer);

    const text = (data.text || '').trim();
    const confidence = typeof data.confidence === 'number' ? data.confidence / 100 : 0;
    const words = text.split(/\s+/).filter(w => w.length > 0);

    return {
      supported: true,
      text,
      confidence: Number(confidence.toFixed(3)),
      wordCount: words.length,
      language,
      hasText: words.length > 0
    };
  } catch (err) {
    return {
      supported: false,
      text: '',
      confidence: 0,
      wordCount: 0,
      language,
      error: err.message || 'OCR failed'
    };
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
  }
}
