/**
 * Guided Group Session Cancel API
 *
 * POST: Facilitator cancels their scheduled session.
 * If any learners are registered (pending/approved), facilitator receives a 1-credit penalty.
 * Creates notifications for facilitator + registered learners.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { spendGroupSessionCancelPenalty } from '@/src/modules/credits';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idRaw } = await params;
    const sessionId = typeof idRaw === 'string' ? idRaw.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'Session id is required.' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`guided-group-sessions:cancel:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const session = await prisma.guidedGroupSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: {
        id: true,
        title: true,
        facilitatorId: true,
        status: true,
        scheduledAt: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.facilitatorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'This session cannot be cancelled.' }, { status: 409 });
    }

    const now = new Date();
    if (session.scheduledAt.getTime() <= now.getTime()) {
      return NextResponse.json({ error: 'This session has already started.' }, { status: 409 });
    }

    const enrollments = await prisma.guidedGroupSessionEnrollment.findMany({
      where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
      select: { userId: true },
    });

    const hasRegistrations = enrollments.length > 0;

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.guidedGroupSession.update({
        where: { id: session.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledById: userId,
          endedAt: now,
        },
        select: { id: true },
      });

      await tx.guidedGroupSessionEnrollment.updateMany({
        where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'CANCELLED', cancelledAt: now },
      });

      // Notices
      const noticeRows = [
        {
          userId,
          type: 'GUIDED_GROUP_SESSION_CANCELLED' as const,
          title: 'Guided group session cancelled',
          body: hasRegistrations
            ? `You cancelled "${session.title}". A 1-credit cancellation penalty was applied.`
            : `You cancelled "${session.title}".`,
          linkUrl: '/my-library/guided-group-sessions',
        },
        ...enrollments.map((e) => ({
          userId: e.userId,
          type: 'GUIDED_GROUP_SESSION_CANCELLED' as const,
          title: 'Guided group session cancelled',
          body: `"${session.title}" was cancelled by the facilitator.`,
          linkUrl: '/my-library/guided-group-sessions',
        })),
      ];

      await tx.moderationNotice.createMany({
        data: noticeRows,
      });

      return { hasRegistrations };
    });

    let balanceAfter: number | null = null;
    if (outcome.hasRegistrations) {
      const penalty = await spendGroupSessionCancelPenalty(userId, session.id);
      if (penalty.success) balanceAfter = penalty.balanceAfter;
    }

    return NextResponse.json({ ok: true, balanceAfter });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error cancelling guided group session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
