// VeriMedia AI — Tiered Sliding-Window Rate Limiter
// Implements 12_SECURITY_SPEC.md §9: Route-Specific Protection
import { logAuditEvent } from '../audit/auditService.js';

/**
 * Shared rate limit configuration by route classification per 12_SECURITY_SPEC.md §9.
 * Stricter thresholds for resource-heavy / high-risk operations (uploads, reports, auth)
 * and looser thresholds for high-volume reads and general queries.
 */
export const rateLimitConfig = {
  auth: { maxRequests: 20, windowMs: 60 * 1000 },          // Credential stuffing defense
  uploads: { maxRequests: 30, windowMs: 60 * 1000 },       // Stricter: heavy multipart file uploads & hashing
  reports: { maxRequests: 30, windowMs: 60 * 1000 },       // Stricter: PDF/HTML generation & crypto dossier signing
  analysis: { maxRequests: 40, windowMs: 60 * 1000 },      // Moderate: compute-heavy perceptual and ML runs
  monitoring: { maxRequests: 40, windowMs: 60 * 1000 },    // Moderate: recurring scheduled scan triggers
  chat: { maxRequests: 60, windowMs: 60 * 1000 },          // Standard: interactive conversational queries
  discovery: { maxRequests: 60, windowMs: 60 * 1000 },     // Standard: external search proxy federation
  reads: { maxRequests: 150, windowMs: 60 * 1000 },        // Looser: read-only timeline, genealogy & claims queries
  general: { maxRequests: 150, windowMs: 60 * 1000 }       // Looser: health, metadata & basic operational endpoints
};

export class RateLimitBucket {
  constructor({ name, maxRequests, windowMs }) {
    this.name = name;
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.store = new Map();

    // Periodic cleanup of stale IP buckets
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.();
  }

  check(key) {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 1,
        resetAt: now + this.windowMs
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: entry.resetAt,
        retryAfterSec: 0
      };
    }

    if (entry.count >= this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterSec
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
      retryAfterSec: 0
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global registry of bucket instances by route class name
const bucketRegistry = new Map();

export function getOrCreateBucket(routeClass = 'discovery') {
  if (bucketRegistry.has(routeClass)) {
    return bucketRegistry.get(routeClass);
  }
  const config = rateLimitConfig[routeClass] || rateLimitConfig.general;
  const bucket = new RateLimitBucket({ name: routeClass, ...config });
  bucketRegistry.set(routeClass, bucket);
  return bucket;
}

/**
 * Functional sliding-window rate checker for programmatic API checks
 * @param {string} clientIp - Client IP address
 * @param {string} routeClass - Classification from rateLimitConfig ('uploads', 'analysis', 'discovery', etc.)
 * @returns {boolean} true if allowed, false if rate limited
 */
export function checkRateLimit(clientIp, routeClass = 'discovery') {
  if (!clientIp) return false;
  const bucket = getOrCreateBucket(routeClass);
  const result = bucket.check(`${routeClass}:${clientIp}`);
  return result.allowed;
}

/**
 * Express middleware factory creating route-specific rate limiters
 */
export function createRateLimiter({ name, maxRequests, windowMs = 60 * 1000 }) {
  const bucket = new RateLimitBucket({ name, maxRequests, windowMs });
  bucketRegistry.set(name, bucket);

  return (req, res, next) => {
    // Determine client identifier
    const clientIp = req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const key = `${name}:${clientIp}`;
    const result = bucket.check(key);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSec);

      try {
        logAuditEvent({
          actor: clientIp,
          action: 'RATE_LIMIT_EXCEEDED',
          objectType: 'SECURITY',
          objectId: name,
          afterState: {
            bucket: name,
            clientIp,
            maxRequests,
            path: req.originalUrl
          }
        });
      } catch (_) {}

      return res.status(429).json({
        error: `Rate limit exceeded for ${name}. Try again in ${result.retryAfterSec} seconds.`,
        bucket: name,
        limit: maxRequests,
        retryAfter: result.retryAfterSec,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    next();
  };
}

// Pre-configured route-class rate limiters using shared rateLimitConfig (12_SECURITY_SPEC.md §9)
export const authLimiter = createRateLimiter({ name: 'auth', ...rateLimitConfig.auth });
export const uploadLimiter = createRateLimiter({ name: 'uploads', ...rateLimitConfig.uploads });
export const analysisLimiter = createRateLimiter({ name: 'analysis', ...rateLimitConfig.analysis });
export const chatLimiter = createRateLimiter({ name: 'chat', ...rateLimitConfig.chat });
export const discoveryLimiter = createRateLimiter({ name: 'discovery', ...rateLimitConfig.discovery });
export const searchLimiter = discoveryLimiter;
export const monitoringLimiter = createRateLimiter({ name: 'monitoring', ...rateLimitConfig.monitoring });
export const reportLimiter = createRateLimiter({ name: 'reports', ...rateLimitConfig.reports });
export const readsLimiter = createRateLimiter({ name: 'reads', ...rateLimitConfig.reads });
export const generalLimiter = createRateLimiter({ name: 'general', ...rateLimitConfig.general });
