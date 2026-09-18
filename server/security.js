import path from 'path';

export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'uploaded_media';
  const basename = path.basename(filename.trim());
  return basename.replace(/[^a-zA-Z0-9_.\-]/g, '_') || 'uploaded_media';
}

export function validatePublicUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}
