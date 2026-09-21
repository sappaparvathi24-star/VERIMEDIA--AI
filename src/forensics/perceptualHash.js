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
 * Computes a 64-bit Difference Hash (dHash) from an image buffer:
 * 1. Convert to grayscale.
 * 2. Resize to 9x8 (9 columns, 8 rows) using 'fill' mode.
 * 3. Compare each pixel to its right-hand neighbor (P[col] > P[col+1]).
 * 4. Yields 8 rows * 8 differences = 64 bits.
 * 5. Return as a 16-character hexadecimal string.
 */
export async function computeDifferenceHash(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return null;
  }

  try {
    const { data } = await sharp(imageBuffer)
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!data || data.length < 72) {
      return null;
    }

    let hex = '';
    for (let row = 0; row < 8; row++) {
      let byteVal = 0;
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        if (left > right) {
          byteVal |= (1 << (7 - col));
        }
      }
      hex += byteVal.toString(16).padStart(2, '0');
    }

    return hex;
  } catch (err) {
    console.warn('[perceptualHash] dHash calculation skipped:', err.message);
    return null;
  }
}

/**
 * Computes a 64-bit Perceptual Hash (pHash) based on Discrete Cosine Transform (DCT):
 * 1. Convert to grayscale.
 * 2. Resize to 32x32.
 * 3. Compute 2D Discrete Cosine Transform on 32x32 matrix.
 * 4. Extract top-left 8x8 low frequencies (excluding DC coefficient at 0,0).
 * 5. Compute median of the 64 coefficients.
 * 6. 1 if coefficient > median, else 0 -> 64 bits.
 * 7. Return as 16-character hexadecimal string.
 */
export async function computePhash(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return null;
  }

  try {
    const N = 32;
    const { data } = await sharp(imageBuffer)
      .grayscale()
      .resize(N, N, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!data || data.length < N * N) {
      return null;
    }

    // 2D DCT for 8x8 output from 32x32 input
    const dct = new Float64Array(64);
    const PI = Math.PI;

    for (let u = 0; u < 8; u++) {
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      for (let v = 0; v < 8; v++) {
        const cv = v === 0 ? 1 / Math.SQRT2 : 1;
        let sum = 0;
        for (let i = 0; i < N; i++) {
          const cosI = Math.cos(((2 * i + 1) * u * PI) / (2 * N));
          for (let j = 0; j < N; j++) {
            const cosJ = Math.cos(((2 * j + 1) * v * PI) / (2 * N));
            sum += data[i * N + j] * cosI * cosJ;
          }
        }
        dct[u * 8 + v] = (2 / N) * cu * cv * sum;
      }
    }

    // Exclude DC term (0,0) from median calculation
    const values = [];
    for (let k = 1; k < 64; k++) {
      values.push(dct[k]);
    }
    values.sort((a, b) => a - b);
    const median = (values[31] + values[32]) / 2;

    let hex = '';
    for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
      let byteVal = 0;
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        const idx = byteIdx * 8 + bitIdx;
        if (dct[idx] > median) {
          byteVal |= (1 << (7 - bitIdx));
        }
      }
      hex += byteVal.toString(16).padStart(2, '0');
    }

    return hex;
  } catch (err) {
    console.warn('[perceptualHash] pHash calculation skipped:', err.message);
    return null;
  }
}

/**
 * Computes all three perceptual fingerprints (aHash, dHash, pHash).
 */
export async function computePerceptualFingerprints(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return { aHash: null, dHash: null, pHash: null };
  }
  const [aHash, dHash, pHash] = await Promise.all([
    computeAverageHash(imageBuffer),
    computeDifferenceHash(imageBuffer),
    computePhash(imageBuffer)
  ]);
  return { aHash, dHash, pHash };
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
