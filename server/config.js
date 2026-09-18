'use strict';

// ── VeriMedia AI — Centralized Configuration Layer ──────────────────
module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: '0.0.0.0',
  ENV: process.env.NODE_ENV || 'development',
  GEMINI_MODEL: 'gemini-3.6-flash',
  
  // Media ingestion limits
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  MAX_JSON_PAYLOAD_SIZE: '60mb',
  
  // Allowed MIME types for ingestion
  ALLOWED_MIME_TYPES: [
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
  ],

  // Epistemic status types
  EPISTEMIC_STATUSES: {
    OBSERVED: 'OBSERVED',
    INFERRED: 'INFERRED',
    SUPPORTED: 'SUPPORTED',
    CONFLICTING: 'CONFLICTING',
    UNKNOWN: 'UNKNOWN',
    INCONCLUSIVE: 'INCONCLUSIVE'
  }
};
