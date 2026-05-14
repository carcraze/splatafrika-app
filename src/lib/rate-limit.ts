/**
 * Simple in-memory rate limiter.
 * For production at scale, replace with Redis (Upstash) or Vercel KV.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.maxRequests - 1 };
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count };
}

// Pre-configured limiters
export const RATE_LIMITS = {
  upload: { maxRequests: 30, windowMs: 60_000 },     // 30/min — generous for retries
  payment: { maxRequests: 10, windowMs: 60_000 },    // 10/min
  api: { maxRequests: 200, windowMs: 60_000 },       // 200/min
} as const;
