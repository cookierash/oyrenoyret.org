/**
 * Guided Group Sessions Library API
 *
 * GET: List completed sessions the current user participated in (facilitator or approved learner).
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
    const rateLimit = await checkRateLimit(`guided-group-sessions:library:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 50);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 50;

    let rows: any[] = [];
    try {
      rows = await prisma.guidedGroupSession.findMany({
        where: {
          deletedAt: null,
          status: 'COMPLETED',
          OR: [
            { facilitatorId: userId },
            { enrollments: { some: { userId, status: 'APPROVED' } } },
          ],
        },
        orderBy: { endedAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          subjectId: true,
          topicId: true,
          scheduledAt: true,
          endedAt: true,
          durationMinutes: true,
          learnerCapacity: true,
          status: true,
          facilitatorId: true,
          facilitator: { select: { firstName: true, lastName: true, email: true, avatarVariant: true } },
          facilitatorFeedback: {
            where: { learnerId: userId },
            select: { rating: true },
            take: 1,
          },
        },
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) return NextResponse.json([], { headers: getPrivateNoStoreHeaders() });
      throw error;
    }

    const payload = rows.map((s) => {
      const facilitatorName =
        [s.facilitator?.firstName, s.facilitator?.lastName].filter(Boolean).join(' ') ||
        (s.facilitator?.email ? s.facilitator.email.split('@')[0] : '');
      const feedbackRow = Array.isArray(s.facilitatorFeedback) ? s.facilitatorFeedback[0] : null;
      return {
        id: s.id,
        title: s.title,
        subjectId: s.subjectId,
        topicId: s.topicId,
        scheduledAt: s.scheduledAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        durationMinutes: s.durationMinutes,
        learnerCapacity: s.learnerCapacity,
        status: s.status,
        facilitator: {
          id: s.facilitatorId,
          name: facilitatorName,
          avatarVariant: s.facilitator?.avatarVariant ?? null,
        },
        myRole: s.facilitatorId === userId ? 'FACILITATOR' : 'LEARNER',
        myRating: feedbackRow?.rating ?? null,
      };
    });

    return NextResponse.json(payload, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error listing guided group session library:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
