/**
 * Guided Group Sessions (Registered) API
 *
 * GET: List sessions the current user is registered for (facilitator or approved learner),
 *      including upcoming + ongoing sessions.
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
    const rateLimit = await checkRateLimit(`guided-group-sessions:registered:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 20);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 50) : 20;

    const now = new Date();
    const nowMs = now.getTime();
    const recentWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    let rows: any[] = [];
    try {
      rows = await prisma.guidedGroupSession.findMany({
        where: {
          deletedAt: null,
          status: { in: ['SCHEDULED', 'LIVE'] },
          scheduledAt: { gte: recentWindowStart },
          OR: [
            { facilitatorId: userId },
            { enrollments: { some: { userId, status: 'APPROVED' } } },
          ],
        },
        orderBy: { scheduledAt: 'asc' },
        take,
        select: {
          id: true,
          title: true,
          subjectId: true,
          topicId: true,
          scheduledAt: true,
          durationMinutes: true,
          learnerCapacity: true,
          status: true,
          facilitatorId: true,
          facilitator: { select: { firstName: true, lastName: true, email: true, avatarVariant: true } },
          enrollments: {
            where: { userId },
            select: { status: true },
            take: 1,
          },
        },
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) return NextResponse.json([], { headers: getPrivateNoStoreHeaders() });
      throw error;
    }

    const payload = rows
      .map((s) => {
        const startMs = s?.scheduledAt instanceof Date ? s.scheduledAt.getTime() : NaN;
        const durationMinutes = typeof s?.durationMinutes === 'number' ? s.durationMinutes : 0;
        const endMs = startMs + durationMinutes * 60_000;
        const isOngoing = Number.isFinite(startMs) && nowMs >= startMs && nowMs < endMs;
        const isUpcoming = Number.isFinite(startMs) && startMs > nowMs;
        if (!isUpcoming && !isOngoing) return null;

        const facilitatorName =
          [s.facilitator?.firstName, s.facilitator?.lastName].filter(Boolean).join(' ') ||
          (s.facilitator?.email ? s.facilitator.email.split('@')[0] : '');
        const myEnrollment = Array.isArray(s.enrollments) ? s.enrollments[0] : null;

        return {
          id: s.id,
          title: s.title,
          subjectId: s.subjectId,
          topicId: s.topicId,
          scheduledAt: s.scheduledAt.toISOString(),
          durationMinutes: s.durationMinutes,
          learnerCapacity: s.learnerCapacity,
          status: s.status,
          isOngoing,
          facilitator: {
            id: s.facilitatorId,
            name: facilitatorName,
            avatarVariant: s.facilitator?.avatarVariant ?? null,
          },
          enrollmentStatus: myEnrollment?.status ?? (s.facilitatorId === userId ? 'FACILITATOR' : null),
        };
      })
      .filter(Boolean);

    return NextResponse.json(payload, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error listing registered guided group sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

