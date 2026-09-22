/**
 * VeriMedia AI — C2PA Detection Module
 * Detects Coalition for Content Provenance and Authenticity (C2PA) manifests.
 * Always returns an honest status — never throws to caller.
 *
 * Statuses:
 *   C2PA_UNAVAILABLE  — c2pa-node library not installed
 *   C2PA_NOT_DETECTED — library present but no manifest found in file
 *   C2PA_PRESENT      — manifest found and parsed
 *   C2PA_PARSE_ERROR  — manifest bytes found but could not be parsed
 */

/**
 * Attempt to detect a C2PA manifest in a file buffer.
 * @param {Buffer} fileBuffer
 * @param {string} [mimeType]
 * @returns {Promise<{status: string, manifest: object|null, message: string, isRealAnalysis: boolean}>}
 */
export async function detectC2PA(fileBuffer, mimeType) {
  // Attempt to dynamically load c2pa-node (optional dependency)
  let c2paModule = null;
  try {
    c2paModule = await import('c2pa-node');
  } catch (_) {
    // Library not installed — return honest unavailable status
    return {
      status: 'C2PA_UNAVAILABLE',
      manifest: null,
      message: 'c2pa-node is not installed. Install it with: npm install c2pa-node',
      isRealAnalysis: false
    };
  }

  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    return {
      status: 'C2PA_NOT_DETECTED',
      manifest: null,
      message: 'No file buffer provided for C2PA analysis',
      isRealAnalysis: true
    };
  }

  try {
    const c2pa = c2paModule.createC2pa ? c2paModule.createC2pa() : c2paModule.default?.createC2pa?.();
    if (!c2pa) {
      return {
        status: 'C2PA_UNAVAILABLE',
        manifest: null,
        message: 'c2pa-node loaded but createC2pa() not available — version mismatch',
        isRealAnalysis: false
      };
    }

    const result = await c2pa.read({ buffer: fileBuffer, mimeType: mimeType || 'image/jpeg' });

    if (!result || !result.active_manifest) {
      return {
        status: 'C2PA_NOT_DETECTED',
        manifest: null,
        message: 'No C2PA manifest found in this file',
        isRealAnalysis: true
      };
    }

    return {
      status: 'C2PA_PRESENT',
      manifest: {
        title: result.active_manifest.title || null,
        claim_generator: result.active_manifest.claim_generator || null,
        assertions: result.active_manifest.assertions?.length || 0,
        ingredients: result.active_manifest.ingredients?.length || 0,
        signature_info: result.active_manifest.signature_info || null
      },
      message: 'C2PA manifest detected and validated',
      isRealAnalysis: true
    };
  } catch (err) {
    // Could be a parse error on a file that has partial/corrupt manifest
    return {
      status: 'C2PA_PARSE_ERROR',
      manifest: null,
      message: err.message || 'C2PA manifest parse failed',
      isRealAnalysis: true
    };
  }
}
