/**
 * Logout API
 *
 * Clears the session and redirects to home.
 */

import { NextResponse } from 'next/server';
import { deleteSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function POST(request: Request) {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(`auth:logout:${identifier}`, RATE_LIMITS.GENERAL);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  await deleteSession();
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete('session_token');
  return response;
}
