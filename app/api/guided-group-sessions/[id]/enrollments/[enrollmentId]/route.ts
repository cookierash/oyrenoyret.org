/**
 * Guided Group Session Enrollment Decision API
 *
 * PATCH: Facilitator approves or rejects a learner enrollment request.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { calcGroupSessionParticipantCost, getBalance } from '@/src/modules/credits';

const bodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  try {
    const { id: sessionIdRaw, enrollmentId: enrollmentIdRaw } = await params;
    const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
    const enrollmentId = typeof enrollmentIdRaw === 'string' ? enrollmentIdRaw.trim() : '';
    if (!sessionId || !enrollmentId) {
      return NextResponse.json({ error: 'Missing ids.' }, { status: 400 });
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
      `guided-group-sessions:enrollments:decide:${identifier}`,
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

    const enrollment = await prisma.guidedGroupSessionEnrollment.findFirst({
      where: { id: enrollmentId, sessionId },
      select: {
        id: true,
        status: true,
        userId: true,
        session: {
          select: {
            id: true,
            title: true,
            facilitatorId: true,
            status: true,
            scheduledAt: true,
            durationMinutes: true,
            learnerCapacity: true,
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }

    if (enrollment.session.facilitatorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (enrollment.session.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'This session is not accepting changes.' }, { status: 409 });
    }

    if (enrollment.session.scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This session has already started.' }, { status: 409 });
    }

    const next = parsed.data.status;
    if (next === 'APPROVED') {
      const approvedCount = await prisma.guidedGroupSessionEnrollment.count({
        where: { sessionId, status: 'APPROVED' },
      });
      if (approvedCount >= enrollment.session.learnerCapacity) {
        return NextResponse.json({ error: 'This session is full.' }, { status: 409 });
      }

      const cost = calcGroupSessionParticipantCost(enrollment.session.durationMinutes);
      const balance = await getBalance(enrollment.userId);
      if (balance < cost) {
        return NextResponse.json(
          { error: 'Insufficient credits', required: cost, balance },
          { status: 402 },
        );
      }
    }

    const now = new Date();
    const updated = await prisma.guidedGroupSessionEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: next,
        decidedAt: now,
        decidedById: userId,
      },
      select: { id: true, status: true },
    });

    try {
      await prisma.moderationNotice.create({
        data: {
          userId: enrollment.userId,
          type: next === 'APPROVED' ? 'GUIDED_GROUP_SESSION_ENROLLMENT_APPROVED' : 'GUIDED_GROUP_SESSION_ENROLLMENT_REJECTED',
          title: next === 'APPROVED' ? 'Guided group session: approved' : 'Guided group session: rejected',
          body:
            next === 'APPROVED'
              ? `You have been approved to join "${enrollment.session.title}".`
              : `Your request to join "${enrollment.session.title}" was rejected.`,
          linkUrl: '/library/guided-group-sessions',
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) {
        console.warn('Failed to create notice for guided-group-session enrollment decision:', error);
      }
    }

    return NextResponse.json({ status: updated.status });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error deciding enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
