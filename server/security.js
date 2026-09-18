'use strict';

const path = require('path');
const { URL } = require('url');

/**
 * Sanitize filename to prevent directory traversal and malicious characters.
 * @param {string} filename 
 * @returns {string} Clean base filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_artifact_' + Date.now();
  }
  // Strip null bytes and control chars
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, '');
  // Extract basename only
  clean = path.basename(clean);
  // Replace path separators and hazardous characters
  clean = clean.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  // Avoid hidden files or empty names
  if (clean.startsWith('.')) clean = 'file' + clean;
  if (!clean || clean === '.' || clean === '..') clean = 'artifact_' + Date.now();
  // Limit max length
  if (clean.length > 128) {
    const ext = path.extname(clean);
    clean = clean.slice(0, 120) + ext;
  }
  return clean;
}

/**
 * Check if an IP address string is a private, loopback, or metadata address.
 * @param {string} ip 
 * @returns {boolean}
 */
function isPrivateOrReservedIP(ip) {
  if (!ip) return false;

  // IPv4 checks
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10)
    ];
    if (octets.some(o => o < 0 || o > 255)) return true;

    // 0.0.0.0/8 (current network)
    if (octets[0] === 0) return true;
    // 10.0.0.0/8 (private)
    if (octets[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (octets[0] === 127) return true;
    // 169.254.0.0/16 (link-local & cloud metadata)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 172.16.0.0/12 (private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
    if (octets[0] >= 224) return true;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return true;
  }
  if (lower.startsWith('::ffff:')) {
    const mappedIpv4 = lower.replace('::ffff:', '');
    return isPrivateOrReservedIP(mappedIpv4);
  }

  return false;
}

/**
 * Validate public URL against SSRF, internal services, and protocol spoofing.
 * @param {string} urlString 
 * @returns {{ valid: boolean, reason?: string, parsedUrl?: URL }}
 */
function validatePublicUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'URL string is required' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, reason: 'Malformed URL format' };
  }

  // Enforce HTTP / HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Unsupported protocol '${parsed.protocol}'. Only HTTP/HTTPS allowed.` };
  }

  // Disallow user credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with embedded user credentials are not permitted' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, reason: 'Empty hostname' };
  }

  // Disallow localhost and common local/internal hostnames
  const forbiddenHosts = [
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    '169.254.169.254',
    'instance-data',
    'local',
    'internal'
  ];
  if (forbiddenHosts.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, reason: `Access to internal host '${hostname}' is strictly prohibited.` };
  }

  // Check IP addresses directly
  if (isPrivateOrReservedIP(hostname)) {
    return { valid: false, reason: `Access to private/loopback IP '${hostname}' is prohibited.` };
  }

  return { valid: true, parsedUrl: parsed };
}

module.exports = {
  sanitizeFilename,
  isPrivateOrReservedIP,
  validatePublicUrl
};
