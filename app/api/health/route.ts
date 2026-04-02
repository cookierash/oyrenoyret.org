/**
 * Health Check API Route
 * 
 * Simple health check endpoint for monitoring and load balancers.
 * This route does not require authentication.
 */

import { NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPublicCacheHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(`health:read:${identifier}`, RATE_LIMITS.GENERAL);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: getPublicCacheHeaders() }
  );
}
