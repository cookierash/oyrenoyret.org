/**
 * Live Event Participants API (Admin only)
 *
 * GET: List participants (enrolled and/or submitted) for a live event.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:participants:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id } = await params;
    const liveEvent = await prisma.liveEvent.findUnique({ where: { id }, select: { id: true } });
    if (!liveEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const [enrollments, submissions] = await Promise.all([
      prisma.liveEventEnrollment.findMany({
        where: { liveEventId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
        select: {
          user: { select: { id: true, publicId: true, firstName: true, lastName: true } },
        },
      }),
      prisma.liveEventSubmission.findMany({
        where: { liveEventId: id, deletedAt: null },
        select: {
          user: { select: { id: true, publicId: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const byUserId = new Map<
      string,
      { id: string; publicId: string | null; firstName: string | null; lastName: string | null }
    >();

    for (const row of submissions) if (row.user) byUserId.set(row.user.id, row.user);
    for (const row of enrollments) if (row.user && !byUserId.has(row.user.id)) byUserId.set(row.user.id, row.user);

    const participants = Array.from(byUserId.values()).sort((a, b) => {
      const last = (a.lastName ?? '').localeCompare(b.lastName ?? '');
      if (last !== 0) return last;
      const first = (a.firstName ?? '').localeCompare(b.firstName ?? '');
      if (first !== 0) return first;
      return (a.publicId ?? a.id).localeCompare(b.publicId ?? b.id);
    });

    return NextResponse.json(participants, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json([], { headers: getPrivateNoStoreHeaders() });
    }
    console.error('Error fetching live event participants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

