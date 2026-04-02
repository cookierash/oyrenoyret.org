/**
 * Rate Limiting Utility
 *
 * Provides rate limiting functionality to prevent abuse and DoS attacks.
 *
 * Implementation Notes:
 * - In-memory fixed-window limiter (sufficient for single-instance deployments)
 * - For distributed deployments, replace with Redis or a dedicated rate-limit service
 * - Use unique keys per endpoint + identifier (user ID or IP)
 */

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

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getRateLimitIdentifier(request: Request, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : request.headers.get('x-real-ip');
  return `ip:${ip || 'unknown'}`;
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
