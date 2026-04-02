/**
 * Rate Limiting for Auth Actions
 *
 * Uses the shared rate limiter (Upstash-backed in production when configured).
 */

'use server';

import { headers } from 'next/headers';
import { RATE_LIMITS } from '@/src/config/constants';
import { checkRateLimit, getRateLimitIdentifierFromHeaders } from '@/src/security/rateLimiter';

async function checkAuthRateLimit(key: string, config: { maxRequests: number; windowMs: number }) {
  const headersList = await headers();
  const identifier = getRateLimitIdentifierFromHeaders(headersList);
  return checkRateLimit(`${key}:${identifier}`, config);
}

// Specialized helpers to satisfy "use server" export rules

export async function checkLoginRateLimit() {
  return checkAuthRateLimit('auth:login', RATE_LIMITS.AUTH);
}

export async function checkRegistrationRateLimit() {
  return checkAuthRateLimit('auth:registration', RATE_LIMITS.AUTH_REGISTRATION);
}

export async function checkVerificationResendRateLimit() {
  return checkAuthRateLimit('auth:verification', RATE_LIMITS.AUTH_VERIFICATION);
}
