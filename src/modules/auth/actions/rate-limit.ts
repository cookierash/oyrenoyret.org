/**
 * Rate Limiting for Auth Actions
 * 
 * Simple in-memory rate limiting for authentication endpoints.
 * In production, consider using Redis for distributed rate limiting.
 */

'use server';

import { headers } from 'next/headers';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// In-memory store (use Redis in production)
const rateLimitStore: RateLimitStore = {};

/**
 * Gets identifier for rate limiting (IP address)
 */
async function getRateLimitIdentifier(): Promise<string> {
  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    'unknown';
  return ipAddress.split(',')[0].trim();
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const identifier = await getRateLimitIdentifier();
  const storeKey = `${key}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore[storeKey];

  // Clean up expired entries
  if (entry && entry.resetAt < now) {
    delete rateLimitStore[storeKey];
  }

  const currentEntry = rateLimitStore[storeKey];

  if (!currentEntry) {
    // First request in window
    rateLimitStore[storeKey] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  if (currentEntry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(currentEntry.resetAt),
    };
  }

  // Increment count
  currentEntry.count += 1;

  return {
    allowed: true,
    remaining: maxRequests - currentEntry.count,
    resetAt: new Date(currentEntry.resetAt),
  };
}

// Specialized helpers to satisfy "use server" export rules

export async function checkLoginRateLimit() {
  return checkRateLimit('login', 5, 15 * 60 * 1000);
}

export async function checkVerificationResendRateLimit() {
  return checkRateLimit('verification-resend', 3, 15 * 60 * 1000);
}

