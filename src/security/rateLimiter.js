// VeriMedia AI — Tiered Sliding-Window Rate Limiter
// Implements 12_SECURITY_SPEC.md §9: Route-Specific Protection
import { logAuditEvent } from '../audit/auditService.js';

class RateLimitBucket {
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

export function createRateLimiter({ name, maxRequests, windowMs = 60 * 1000 }) {
  const bucket = new RateLimitBucket({ name, maxRequests, windowMs });

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

// Pre-configured rate limiters per 12_SECURITY_SPEC.md §9
export const authLimiter = createRateLimiter({ name: 'auth', maxRequests: 20, windowMs: 60 * 1000 });
export const uploadLimiter = createRateLimiter({ name: 'uploads', maxRequests: 30, windowMs: 60 * 1000 });
export const analysisLimiter = createRateLimiter({ name: 'analysis', maxRequests: 40, windowMs: 60 * 1000 });
export const chatLimiter = createRateLimiter({ name: 'chat', maxRequests: 60, windowMs: 60 * 1000 });
export const discoveryLimiter = createRateLimiter({ name: 'discovery', maxRequests: 60, windowMs: 60 * 1000 });
export const monitoringLimiter = createRateLimiter({ name: 'monitoring', maxRequests: 40, windowMs: 60 * 1000 });
export const reportLimiter = createRateLimiter({ name: 'reports', maxRequests: 30, windowMs: 60 * 1000 });
export const generalLimiter = createRateLimiter({ name: 'general', maxRequests: 150, windowMs: 60 * 1000 });
