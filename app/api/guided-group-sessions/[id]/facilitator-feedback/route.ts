/**
 * Guided Group Session Facilitator Feedback API
 *
 * POST: Learner rates the facilitator after a completed session.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { sanitizeInput } from '@/src/security/validation';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionIdRaw } = await params;
    const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
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
    const rateLimit = await checkRateLimit(
      `guided-group-sessions:feedback:facilitator:${identifier}`,
      RATE_LIMITS.WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const session = await prisma.guidedGroupSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { id: true, facilitatorId: true, status: true, endedAt: true },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.status !== 'COMPLETED' || !session.endedAt) {
      return NextResponse.json({ error: 'This session is not accepting feedback yet.' }, { status: 409 });
    }

    if (session.facilitatorId === userId) {
      return NextResponse.json({ error: 'Facilitators cannot rate themselves.' }, { status: 400 });
    }

    const enrollment = await prisma.guidedGroupSessionEnrollment.findFirst({
      where: { sessionId: session.id, userId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: 'You are not enrolled in this session.' }, { status: 403 });
    }

    const rating = parsed.data.rating;
    const comment = parsed.data.comment ? sanitizeInput(parsed.data.comment).trim() : null;

    await prisma.guidedGroupSessionFacilitatorFeedback.upsert({
      where: { sessionId_learnerId: { sessionId: session.id, learnerId: userId } },
      create: {
        sessionId: session.id,
        learnerId: userId,
        facilitatorId: session.facilitatorId,
        rating,
        comment,
      },
      update: {
        rating,
        comment,
      },
      select: { id: true },
    });

    const agg = await prisma.guidedGroupSessionFacilitatorFeedback.aggregate({
      where: { sessionId: session.id },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const ratingAvg = agg._avg.rating ? Number(agg._avg.rating) : 0;
    const ratingCount = agg._count._all ?? 0;

    await prisma.guidedGroupSession.update({
      where: { id: session.id },
      data: { ratingAvg, ratingCount },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, ratingAvg, ratingCount });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error saving facilitator feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

