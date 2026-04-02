/**
 * Rate Limiting Utility
 *
 * Provides rate limiting functionality to prevent abuse and DoS attacks.
 *
 * Implementation Notes:
 * - Uses Upstash Redis (distributed) when configured
 * - Falls back to in-memory fixed-window limiter in dev/test
 * - Use unique keys per endpoint + identifier (user ID or IP)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60_000;

const hasUpstashConfig =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimiter(config: RateLimitConfig): Ratelimit | null {
  if (!hasUpstashConfig) return null;
  const key = `${config.maxRequests}:${config.windowMs}`;
  const existing = ratelimitCache.get(key);
  if (existing) return existing;

  const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000));
  try {
    const limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(config.maxRequests, `${windowSeconds} s`),
      prefix: 'oyrenoyret:ratelimit',
    });
    ratelimitCache.set(key, limiter);
    return limiter;
  } catch (error) {
    console.warn('Rate limiter disabled due to invalid Upstash config:', error);
    return null;
  }
}

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getRateLimitIdentifierFromHeaders(
  headers: Headers,
  userId?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }
  const forwarded =
    headers.get('x-forwarded-for') ||
    headers.get('x-vercel-forwarded-for') ||
    headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : null;
  return `ip:${ip || 'unknown'}`;
}

export function getRateLimitIdentifier(request: Request, userId?: string | null): string {
  return getRateLimitIdentifierFromHeaders(request.headers, userId);
}

export function buildRateLimitResponse(result: RateLimitResult) {
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
  );
  return {
    status: 429,
    body: {
      error: 'Too many requests. Please try again later.',
      retryAfterSeconds,
    },
    headers: {
      'Retry-After': String(retryAfterSeconds),
    },
  };
}

export function resetRateLimitStoreForTests() {
  rateLimitStore.clear();
  lastCleanupAt = 0;
}

/**
 * Checks if a request should be rate limited
 * @param identifier Unique identifier (IP, user ID, etc.)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ratelimiter = getRatelimiter(config);
  if (ratelimiter) {
    try {
      const result = await ratelimiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: Math.max(result.remaining ?? 0, 0),
        resetAt: new Date(result.reset),
      };
    } catch (error) {
      console.warn('Rate limiter fallback to in-memory:', error);
    }
  }

  const now = Date.now();
  cleanupExpiredEntries(now);

  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(config.maxRequests - 1, 0),
      resetAt: new Date(resetAt),
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  entry.count += 1;

  return {
    allowed: true,
    remaining: Math.max(config.maxRequests - entry.count, 0),
    resetAt: new Date(entry.resetAt),
  };
}
