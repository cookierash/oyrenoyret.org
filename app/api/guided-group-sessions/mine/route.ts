/**
 * Guided Group Sessions (My Sessions) API
 *
 * GET: List sessions facilitated by the current user, including enrollment requests.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`guided-group-sessions:mine:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const now = new Date();

    let sessions: any[] = [];
    try {
      sessions = await prisma.guidedGroupSession.findMany({
        where: {
          facilitatorId: userId,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'LIVE'] },
          scheduledAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) }, // show recent window
        },
        orderBy: { scheduledAt: 'asc' },
        take: 100,
        select: {
          id: true,
          title: true,
          subjectId: true,
          topicId: true,
          scheduledAt: true,
          durationMinutes: true,
          learnerCapacity: true,
          status: true,
          startedAt: true,
          cancelledAt: true,
          enrollments: {
            where: { status: { in: ['PENDING', 'APPROVED'] } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              status: true,
              createdAt: true,
              user: {
                select: { id: true, firstName: true, lastName: true, email: true, avatarVariant: true },
              },
            },
          },
        },
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) {
        return NextResponse.json([], { headers: getPrivateNoStoreHeaders() });
      }
      throw error;
    }

    const payload = sessions.map((s) => {
      const approvedCount = Array.isArray(s.enrollments)
        ? s.enrollments.filter((e: any) => e.status === 'APPROVED').length
        : 0;
      const pendingCount = Array.isArray(s.enrollments)
        ? s.enrollments.filter((e: any) => e.status === 'PENDING').length
        : 0;
      return {
        id: s.id,
        title: s.title,
        subjectId: s.subjectId,
        topicId: s.topicId,
        scheduledAt: s.scheduledAt.toISOString(),
        durationMinutes: s.durationMinutes,
        learnerCapacity: s.learnerCapacity,
        status: s.status,
        startedAt: s.startedAt ? s.startedAt.toISOString() : null,
        cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
        approvedCount,
        pendingCount,
        enrollments: (s.enrollments ?? []).map((e: any) => ({
          id: e.id,
          status: e.status,
          createdAt: e.createdAt.toISOString(),
          user: {
            id: e.user.id,
            firstName: e.user.firstName,
            lastName: e.user.lastName,
            email: e.user.email,
            avatarVariant: e.user.avatarVariant ?? null,
          },
        })),
      };
    });

    return NextResponse.json(payload, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching facilitator sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
