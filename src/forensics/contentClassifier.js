// VeriMedia AI — Content Classification Layer
// Classifies media using actual file bytes/MIME detection (not filename alone)
// Produces canonical classification object and dynamic type-specific analysis plan.

import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

export const ContentType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  TEXT: 'TEXT',
  PDF: 'PDF',
  DOCUMENT: 'DOCUMENT',
  UNSUPPORTED: 'UNSUPPORTED'
};

const DOCUMENT_MIMES = new Set([
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'application/rtf'
]);

const DOCUMENT_EXTENSIONS = new Set([
  'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'rtf'
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg']);

/**
 * Checks if a buffer is valid UTF-8 text without control/binary characters
 */
function isUtf8Text(buffer) {
  if (!buffer || buffer.length === 0) return false;
  // Sample up to first 4KB
  const sampleSize = Math.min(buffer.length, 4096);
  let zeroCount = 0;
  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    if (byte === 0) zeroCount++;
    // Binary bytes that never appear in plain text
    if (byte < 7 || (byte > 13 && byte < 27)) {
      return false;
    }
  }
  return zeroCount === 0;
}

/**
 * Classifies an uploaded file based on its binary bytes and filename.
 * @param {Buffer} buffer - File byte buffer
 * @param {string} [originalFilename=''] - Original filename for fallback extension hints
 * @returns {Promise<{
 *   contentType: string,
 *   mimeType: string,
 *   extension: string,
 *   byteSize: number,
 *   sha256: string,
 *   capabilities: string[],
 *   analysisPlan: object
 * }>}
 */
export async function classifyContent(buffer, originalFilename = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('classifyContent requires a valid Buffer');
  }

  const byteSize = buffer.length;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // 1. Detect binary MIME via magic bytes
  let detectedType = null;
  try {
    detectedType = await fileTypeFromBuffer(buffer);
  } catch (_) {}

  // Resolve extension from original filename
  let ext = '';
  if (originalFilename && originalFilename.includes('.')) {
    ext = originalFilename.split('.').pop().toLowerCase().trim();
  }

  let mimeType = detectedType ? detectedType.mime : null;
  let extension = detectedType ? detectedType.ext : ext;

  let contentType = ContentType.UNSUPPORTED;

  // 2. Classify based on verified magic bytes or structure
  if (mimeType) {
    if (mimeType === 'application/pdf') {
      contentType = ContentType.PDF;
    } else if (mimeType.startsWith('image/')) {
      contentType = ContentType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      contentType = ContentType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      contentType = ContentType.AUDIO;
    }
  } else {
    // Check for PDF magic header '%PDF-'
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      contentType = ContentType.PDF;
      mimeType = 'application/pdf';
      extension = 'pdf';
    }
  }

  // 3. If still undetermined, check extension hints and text / document
  if (contentType === ContentType.UNSUPPORTED) {
    if (VIDEO_EXTENSIONS.has(ext)) {
      contentType = ContentType.VIDEO;
      mimeType = mimeType || `video/${ext === 'mov' ? 'quicktime' : ext}`;
    } else if (AUDIO_EXTENSIONS.has(ext)) {
      contentType = ContentType.AUDIO;
      mimeType = mimeType || `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
    } else if (IMAGE_EXTENSIONS.has(ext)) {
      contentType = ContentType.IMAGE;
      mimeType = mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    } else if (isUtf8Text(buffer)) {
      if (DOCUMENT_EXTENSIONS.has(ext)) {
        contentType = ContentType.DOCUMENT;
        mimeType = ext === 'json' ? 'application/json' :
                   ext === 'xml' ? 'application/xml' :
                   ext === 'csv' ? 'text/csv' :
                   ext === 'html' || ext === 'htm' ? 'text/html' :
                   ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain';
      } else {
        contentType = ContentType.TEXT;
        mimeType = 'text/plain';
        if (!extension) extension = 'txt';
      }
    } else {
      contentType = ContentType.UNSUPPORTED;
      mimeType = mimeType || 'application/octet-stream';
    }
  }

  // 4. Build dynamic analysis plan and capabilities
  const capabilities = [];
  const plan = {
    contentType,
    stages: [],
    applicableEngines: []
  };

  switch (contentType) {
    case ContentType.IMAGE:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'PERCEPTUAL_HASH_AHASH',
        'PERCEPTUAL_HASH_DHASH',
        'PERCEPTUAL_HASH_PHASH',
        'EXIF_METADATA',
        'C2PA_VERIFICATION',
        'PIXEL_STATISTICS',
        'OCR',
        'REVERSE_VISUAL_DISCOVERY',
        'LOCAL_BYTE_COMPARISON',
        'PROVENANCE_GRAPH',
        'PROPAGATION_TIMELINE',
        'EVIDENCE_FUSION'
      );
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        capabilities.push('JPEG_ERROR_LEVEL_ANALYSIS');
      }
      if (process.env.GEMINI_API_KEY) {
        capabilities.push('MULTIMODAL_AI_VISION');
      }
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'PHYSICAL_INTEGRITY_AND_ELA',
        'METADATA_AND_C2PA',
        'PIXEL_STATS_AND_OCR',
        'MULTIMODAL_AI_EVALUATION',
        'DISCOVERY_AND_CANDIDATE_RETRIEVAL',
        'LOCAL_CANDIDATE_BYTE_COMPARISON',
        'PROVENANCE_AND_PROPAGATION_RECONSTRUCTION',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    case ContentType.VIDEO:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'FFPROBE_CONTAINER_STREAM_METADATA',
        'KEYFRAME_EXTRACTION',
        'REPRESENTATIVE_FRAME_SAMPLING',
        'FRAME_PERCEPTUAL_FINGERPRINTING',
        'FRAME_SIMILARITY_DUPLICATION_ANALYSIS',
        'TEMPORAL_DISCONTINUITY_ANALYSIS',
        'AUDIO_STREAM_METADATA',
        'FRAME_OCR',
        'REPRESENTATIVE_FRAME_DISCOVERY',
        'PROVENANCE_GRAPH',
        'PROPAGATION_TIMELINE',
        'EVIDENCE_FUSION'
      );
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'CONTAINER_AND_STREAM_INSPECTION',
        'KEYFRAME_AND_FRAME_SAMPLING',
        'TEMPORAL_AND_FRAME_CONSISTENCY',
        'AUDIO_TRACK_ANALYSIS',
        'DISCOVERY_VIA_REPRESENTATIVE_FRAMES',
        'PROVENANCE_AND_PROPAGATION_RECONSTRUCTION',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    case ContentType.AUDIO:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'CONTAINER_CODEC_METADATA',
        'WAVEFORM_STATISTICS',
        'SILENCE_ANALYSIS',
        'CLIPPING_DISTORTION_ANALYSIS',
        'SPECTRAL_FREQUENCY_ANALYSIS',
        'PROVENANCE_GRAPH',
        'EVIDENCE_FUSION'
      );
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'AUDIO_METADATA_AND_STREAMS',
        'WAVEFORM_AND_CLIPPING_ANALYSIS',
        'SPECTRAL_AND_SILENCE_ANALYSIS',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    case ContentType.TEXT:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'ENCODING_DETECTION',
        'LANGUAGE_DETECTION',
        'TEXT_NORMALIZATION',
        'NAMED_ENTITY_RECOGNITION',
        'CLAIM_EXTRACTION',
        'SEMANTIC_EMBEDDINGS',
        'ENTAILMENT_CONTRADICTION_ANALYSIS',
        'SOURCE_DISCOVERY',
        'PROVENANCE_GRAPH',
        'EVIDENCE_FUSION'
      );
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'ENCODING_AND_LANGUAGE_IDENTIFICATION',
        'ENTITY_AND_CLAIM_EXTRACTION',
        'SEMANTIC_EMBEDDINGS_AND_ENTAILMENT',
        'TEXT_SOURCE_DISCOVERY',
        'PROVENANCE_AND_PROPAGATION_RECONSTRUCTION',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    case ContentType.PDF:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'PDF_STRUCTURE_INSPECTION',
        'PDF_METADATA',
        'PAGE_AND_OBJECT_ANALYSIS',
        'TEXT_EXTRACTION',
        'OCR_FALLBACK',
        'NAMED_ENTITY_RECOGNITION',
        'CLAIM_EXTRACTION',
        'SEMANTIC_EMBEDDINGS',
        'SOURCE_DISCOVERY',
        'PROVENANCE_GRAPH',
        'EVIDENCE_FUSION'
      );
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'PDF_STRUCTURE_AND_METADATA',
        'TEXT_AND_PAGE_EXTRACTION',
        'ENTITY_AND_CLAIM_EXTRACTION',
        'SEMANTIC_EMBEDDINGS_AND_ENTAILMENT',
        'SOURCE_DISCOVERY',
        'PROVENANCE_AND_PROPAGATION_RECONSTRUCTION',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    case ContentType.DOCUMENT:
      capabilities.push(
        'CRYPTOGRAPHIC_HASH',
        'STRUCTURE_INSPECTION',
        'TEXT_EXTRACTION',
        'LANGUAGE_DETECTION',
        'NAMED_ENTITY_RECOGNITION',
        'SEMANTIC_EMBEDDINGS',
        'SOURCE_DISCOVERY',
        'EVIDENCE_FUSION'
      );
      plan.stages = [
        'INGEST_AND_FINGERPRINT',
        'STRUCTURE_AND_SYNTAX_VALIDATION',
        'CONTENT_EXTRACTION_AND_NORMALIZATION',
        'ENTITY_AND_NLP_ANALYSIS',
        'EVIDENCE_FUSION_AND_REASONING'
      ];
      break;

    default:
      plan.stages = ['INGEST_AND_FINGERPRINT', 'UNSUPPORTED_FORMAT_REJECTION'];
      break;
  }

  return {
    contentType,
    mimeType: mimeType || 'application/octet-stream',
    extension: extension || 'bin',
    byteSize,
    sha256,
    capabilities,
    analysisPlan: plan
  };
}
