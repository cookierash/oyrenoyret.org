/**
 * Current User API
 *
 * Returns the authenticated user's info or null if not logged in.
 */

import { NextResponse } from 'next/server';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { RATE_LIMITS } from '@/src/config/constants';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`auth:me:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }
    if (!userId) {
      return NextResponse.json({ user: null }, { headers: getPrivateNoStoreHeaders() });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { headers: getPrivateNoStoreHeaders() });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarVariant: user.avatarVariant,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      },
    }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ user: null }, { headers: getPrivateNoStoreHeaders() });
  }
}
