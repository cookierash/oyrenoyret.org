/**
 * Guided Group Session Learner Feedback API
 *
 * POST: Facilitator optionally rates a learner after a completed session.
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

export const runtime = 'nodejs';

const bodySchema = z.object({
  learnerId: z.string().trim().min(1),
  sentiment: z.enum(['GOOD', 'BAD']),
  note: z.string().trim().max(1000).optional().nullable(),
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
      `guided-group-sessions:feedback:learner:${identifier}`,
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

    const learnerId = parsed.data.learnerId.trim();
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId is required.' }, { status: 400 });
    }

    const session = await prisma.guidedGroupSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { id: true, facilitatorId: true, status: true, endedAt: true, title: true },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.facilitatorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'COMPLETED' || !session.endedAt) {
      return NextResponse.json({ error: 'This session is not accepting feedback yet.' }, { status: 409 });
    }

    const enrollment = await prisma.guidedGroupSessionEnrollment.findFirst({
      where: { sessionId: session.id, userId: learnerId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: 'Learner is not enrolled in this session.' }, { status: 404 });
    }

    const sentiment = parsed.data.sentiment;
    const note = parsed.data.note ? sanitizeInput(parsed.data.note).trim() : null;

    await prisma.guidedGroupSessionLearnerFeedback.upsert({
      where: { sessionId_learnerId: { sessionId: session.id, learnerId } },
      create: {
        sessionId: session.id,
        facilitatorId: userId,
        learnerId,
        sentiment,
        note,
      },
      update: {
        sentiment,
        note,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error saving learner feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
