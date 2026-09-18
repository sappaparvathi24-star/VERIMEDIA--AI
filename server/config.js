export const PORT = 3000;
export const HOST = '0.0.0.0';
export const ENV = process.env.NODE_ENV || 'development';
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_JSON_PAYLOAD_SIZE = '60mb';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac'
];

export const EPISTEMIC_STATUSES = {
  OBSERVED: 'OBSERVED',
  INFERRED: 'INFERRED',
  SUPPORTED: 'SUPPORTED',
  CONFLICTING: 'CONFLICTING',
  UNKNOWN: 'UNKNOWN',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

const config = {
  PORT,
  HOST,
  ENV,
  GEMINI_MODEL,
  MAX_FILE_SIZE_BYTES,
  MAX_JSON_PAYLOAD_SIZE,
  ALLOWED_MIME_TYPES,
  EPISTEMIC_STATUSES
};

export default config;
