/**
 * VeriMedia AI — CLIP Visual Embedding Module
 * Uses @xenova/transformers image-feature-extraction with Xenova/clip-vit-base-patch32.
 * Generates 512-dimensional semantic vision vectors.
 *
 * Plugs in ALONGSIDE perceptual hashing (aHash / dHash) to detect
 * semantic similarities across major visual transformations.
 */

import sharp from 'sharp';
import { cosineSimilarity } from '../embeddings/similarity.js';

let clipPipeline = null;
let isInitializing = false;

/**
 * Lazy loads and caches the CLIP vision feature extraction pipeline singleton.
 */
async function getClipPipeline() {
  if (clipPipeline) return clipPipeline;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (clipPipeline) return clipPipeline;
  }

  isInitializing = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowRemoteModels = true;
    clipPipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
    return clipPipeline;
  } catch (err) {
    console.warn('[CLIP] Transformer vision pipeline initialization notice, will use fallback:', err.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Fallback pseudo-embedding generator from image raw statistics (512 dimensions, normalized).
 */
async function fallbackEmbedImage(buffer) {
  const vec = new Float32Array(512);
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return Array.from(vec);
  }

  try {
    const { data } = await sharp(buffer)
      .resize(16, 16, { fit: 'fill' })
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length && i < 512; i++) {
      vec[i] = data[i] / 255.0;
    }

    let norm = 0;
    for (let i = 0; i < 512; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < 512; i++) {
        vec[i] /= norm;
      }
    }
  } catch (_) {}

  return Array.from(vec);
}

/**
 * Generates a 512-dimensional normalized semantic visual embedding for an image buffer.
 *
 * @param {Buffer} buffer - Raw image file buffer.
 * @param {object} [options]
 * @returns {Promise<number[]>} 512-dim normalized feature array.
 */
export async function embedImage(buffer, options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return fallbackEmbedImage(null);
  }

  try {
    const extractor = await getClipPipeline();
    if (!extractor) {
      return fallbackEmbedImage(buffer);
    }

    const { RawImage } = await import('@xenova/transformers');
    const { data, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rawImage = new RawImage(data, info.width, info.height, info.channels);
    const output = await extractor(rawImage);

    if (output && output.data) {
      const arr = Array.from(output.data);
      // Ensure L2 normalization
      let norm = 0;
      for (let i = 0; i < arr.length; i++) {
        norm += arr[i] * arr[i];
      }
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = arr[i] / norm;
        }
      }
      return arr;
    }

    return fallbackEmbedImage(buffer);
  } catch (err) {
    console.warn('[CLIP] Image feature extraction error, using fallback:', err.message);
    return fallbackEmbedImage(buffer);
  }
}

/**
 * Computes cosine similarity between two 512-dim CLIP visual embedding vectors.
 * Clamped strictly to [0.0, 1.0].
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
export function clipVisualSimilarity(vecA = [], vecB = []) {
  if (!vecA || !vecB || !vecA.length || !vecB.length) return 0.0;
  const rawSim = cosineSimilarity(vecA, vecB);
  return Number(Math.max(0.0, Math.min(1.0, rawSim)).toFixed(4));
}
