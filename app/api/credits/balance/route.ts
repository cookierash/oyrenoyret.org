/**
 * Credits Balance API
 *
 * GET: Current user's credit balance
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`credits:balance:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }
    const balance = await getBalance(userId);
    return NextResponse.json({ balance }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching balance:', error);
    // Credits badge is non-critical; return a safe fallback instead of a hard 500.
    return NextResponse.json(
      { balance: null, degraded: true },
      { headers: getPrivateNoStoreHeaders() },
    );
  }
}
