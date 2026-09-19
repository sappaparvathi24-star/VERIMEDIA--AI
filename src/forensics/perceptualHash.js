import sharp from 'sharp';

/**
 * Computes a 64-bit Average Hash (aHash) from an image buffer:
 * 1. Convert to grayscale.
 * 2. Resize to 8x8 using 'fill' mode.
 * 3. Calculate mean brightness across all 64 pixels.
 * 4. Produce a 64-bit binary bitstring (1 if pixel >= mean, else 0).
 * 5. Return as a 16-character hexadecimal string.
 *
 * Algorithmic limitations:
 * - Robust against JPEG compression, minor noise, brightness shifts, and resizing.
 * - Sensitive to cropping, rotation, mirroring, and extreme perspective warping.
 */
export async function computeAverageHash(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return null;
  }

  try {
    const { data } = await sharp(imageBuffer)
      .grayscale()
      .resize(8, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!data || data.length < 64) {
      return null;
    }

    let sum = 0;
    for (let i = 0; i < 64; i++) {
      sum += data[i];
    }
    const mean = sum / 64;

    let hex = '';
    for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
      let byteVal = 0;
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        const pixelVal = data[byteIdx * 8 + bitIdx];
        if (pixelVal >= mean) {
          byteVal |= (1 << (7 - bitIdx));
        }
      }
      hex += byteVal.toString(16).padStart(2, '0');
    }

    return hex;
  } catch (err) {
    console.warn('[perceptualHash] aHash calculation skipped:', err.message);
    return null;
  }
}

/**
 * Computes Hamming bit distance between two 16-character hex hashes (0 to 64).
 */
export function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || typeof hashA !== 'string' || typeof hashB !== 'string') {
    return null;
  }
  if (hashA.length !== 16 || hashB.length !== 16) {
    return null;
  }

  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const a = parseInt(hashA[i], 16);
    const b = parseInt(hashB[i], 16);
    if (isNaN(a) || isNaN(b)) return null;

    let xor = a ^ b;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Computes normalized similarity score [0.0 - 1.0] from Hamming distance.
 */
export function hashSimilarity(hashA, hashB) {
  const dist = hammingDistance(hashA, hashB);
  if (dist === null) return 0.0;
  return Number((Math.max(0, 1 - (dist / 64))).toFixed(4));
}
