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

let cachedWorkerPromise = null;

async function getSharedOcrWorker(language = 'eng') {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = createWorker(language, 1, {
      logger: () => {},
      errorHandler: () => {}
    }).catch(err => {
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

/**
 * Perform OCR on an image buffer with high-performance worker reuse and timeout.
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

  try {
    // Resize & convert to grayscale JPEG for 5x faster OCR recognition
    let preparedBuffer = imageBuffer;
    try {
      preparedBuffer = await sharp(imageBuffer)
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (_) {
      preparedBuffer = imageBuffer;
    }

    const worker = await getSharedOcrWorker(language);

    // Bound OCR execution to 1500ms max to prevent CPU thread blocking
    const ocrTask = worker.recognize(preparedBuffer);
    const timeoutTask = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR recognition timeout')), 1500)
    );

    const { data } = await Promise.race([ocrTask, timeoutTask]);

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
    // If worker died or threw fatal error, reset singleton
    if (err && (err.message?.includes('dead') || err.message?.includes('crash'))) {
      cachedWorkerPromise = null;
    }
    return {
      supported: false,
      text: '',
      confidence: 0,
      wordCount: 0,
      language,
      error: err.message || 'OCR failed'
    };
  }
}
