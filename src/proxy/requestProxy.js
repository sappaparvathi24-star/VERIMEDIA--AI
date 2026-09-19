/**
 * VeriMedia AI — SSRF-Safe Request Proxy & Validator
 */

import { validatePropagationUrl as valSafeUrl } from '../provenance/propagation.js';

export function isPrivateOrBlockedIP(hostOrIp = '') {
  if (!hostOrIp || typeof hostOrIp !== 'string') return true;
  const raw = hostOrIp.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (raw === 'localhost' || raw === '127.0.0.1' || raw === '0.0.0.0' || raw === '::1' || raw === '::' || raw === '169.254.169.254') {
    return true;
  }

  // Check 127.0.0.0/8 loopback
  if (raw.startsWith('127.')) return true;

  // Check IPv4 private ranges
  const ipv4Match = raw.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets[0] === 10) return true; // 10.0.0.0/8
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true; // 172.16.0.0/12
    if (octets[0] === 192 && octets[1] === 168) return true; // 192.168.0.0/16
    if (octets[0] === 169 && octets[1] === 254) return true; // 169.254.0.0/16 link-local
    if (octets[0] === 0) return true;
  }

  if (raw.endsWith('.internal') || raw.endsWith('.local')) return true;

  return false;
}

export function validateSafeUrl(urlStr) {
  return valSafeUrl(urlStr);
}

export async function safeFetch(urlStr, options = {}) {
  const check = validateSafeUrl(urlStr);
  if (!check.valid) {
    throw new Error(`SSRF Prevention: Blocked outbound request to ${urlStr} — ${check.error}`);
  }
  return fetch(check.sanitizedUrl, options);
}
