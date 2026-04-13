/**
 * Notifications mark-as-read API
 *
 * POST: marks all notifications as read for the current user.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { NOTIFICATIONS_READ_AT_COOKIE } from '@/src/modules/notifications/read-at-cookie';

export async function POST(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`notifications:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const notificationsReadAt = new Date();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { notificationsReadAt },
        select: { id: true },
      });
    } catch (error) {
      // Read-state is browser-scoped; DB update is best-effort for cross-device consistency.
      if (!isDbSchemaMismatch(error)) throw error;
    }

    const headers = getPrivateNoStoreHeaders();
    const response = NextResponse.json(
      { notificationsReadAt: notificationsReadAt.toISOString() },
      { headers },
    );
    response.cookies.set(NOTIFICATIONS_READ_AT_COOKIE, notificationsReadAt.toISOString(), {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      const response = NextResponse.json({ ok: true }, { headers: getPrivateNoStoreHeaders() });
      const notificationsReadAt = new Date();
      response.cookies.set(NOTIFICATIONS_READ_AT_COOKIE, notificationsReadAt.toISOString(), {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
