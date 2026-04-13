/**
 * Guided Group Session Start API
 *
 * POST: Facilitator marks a session as started (used for no-show detection).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { calcGroupSessionParticipantCost, roundCredits } from '@/src/modules/credits';

export const runtime = 'nodejs';

const EARLY_START_WINDOW_MS = 10 * 60 * 1000;

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
    const rateLimit = await checkRateLimit(`guided-group-sessions:start:${identifier}`, RATE_LIMITS.WRITE);
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
        durationMinutes: true,
        startedAt: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.facilitatorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'SCHEDULED' && session.status !== 'LIVE') {
      return NextResponse.json({ error: 'This session cannot be started.' }, { status: 409 });
    }

    const now = Date.now();
    const startMs = session.scheduledAt.getTime();
    const endMs = startMs + session.durationMinutes * 60_000;

    if (now < startMs - EARLY_START_WINDOW_MS) {
      return NextResponse.json({ error: 'Too early to start this session.' }, { status: 409 });
    }
    if (now > endMs) {
      return NextResponse.json({ error: 'This session has already ended.' }, { status: 409 });
    }

    const participantCost = calcGroupSessionParticipantCost(session.durationMinutes);
    const approvedEnrollments = await prisma.guidedGroupSessionEnrollment.findMany({
      where: { sessionId: session.id, status: 'APPROVED' },
      select: {
        id: true,
        userId: true,
        user: { select: { credits: true } },
      },
    });

    const insufficient = approvedEnrollments.filter(
      (e) => roundCredits(e.user?.credits ?? 0) < participantCost,
    );
    if (insufficient.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.guidedGroupSessionEnrollment.updateMany({
          where: { id: { in: insufficient.map((e) => e.id) } },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await tx.moderationNotice.createMany({
          data: insufficient.map((e) => ({
            userId: e.userId,
            type: 'GUIDED_GROUP_SESSION_ENROLLMENT_REJECTED' as const,
            title: 'Guided group session: removed',
            body: `You were removed from "${session.title}" because you did not have enough credits at the start time.`,
            linkUrl: '/my-library/guided-group-sessions',
          })),
        });
      });
    }

    const approvedCount = approvedEnrollments.length - insufficient.length;
    if (approvedCount < 2) {
      return NextResponse.json({ error: 'Not enough approved learners to start.' }, { status: 409 });
    }

    if (session.startedAt) {
      return NextResponse.json({ ok: true, status: session.status });
    }

    await prisma.guidedGroupSession.update({
      where: { id: session.id },
      data: { startedAt: new Date(), status: 'LIVE' },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, status: 'LIVE' });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error starting guided group session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
