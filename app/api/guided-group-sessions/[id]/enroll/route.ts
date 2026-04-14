/**
 * Guided Group Session Enrollment API
 *
 * POST: Register for a guided group session (first-come, first-served).
 * Enrollment is immediately APPROVED if seats are available.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { Prisma } from '@prisma/client';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

async function registerFirstCome({
  sessionId,
  userId,
  now,
}: {
  sessionId: string;
  userId: string;
  now: Date;
}): Promise<{ enrollmentId: string; status: string; sessionId: string }> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const session = await tx.guidedGroupSession.findFirst({
            where: { id: sessionId, deletedAt: null },
            select: {
              id: true,
              facilitatorId: true,
              status: true,
              scheduledAt: true,
              learnerCapacity: true,
            },
          });

          if (!session) {
            throw new Error('SESSION_NOT_FOUND');
          }

          if (session.facilitatorId === userId) {
            throw new Error('CANNOT_ENROLL_OWN');
          }

          if (session.status !== 'SCHEDULED') {
            throw new Error('NOT_ACCEPTING');
          }

          if (session.scheduledAt.getTime() <= now.getTime()) {
            throw new Error('ALREADY_STARTED');
          }

          const existing = await tx.guidedGroupSessionEnrollment.findUnique({
            where: { sessionId_userId: { sessionId: session.id, userId } },
            select: { id: true, status: true },
          });

          const restorable =
            existing &&
            (existing.status === 'CANCELLED' || existing.status === 'REJECTED' || existing.status === 'PENDING');

          if (existing && !restorable) {
            return { enrollmentId: existing.id, status: existing.status, sessionId: session.id };
          }

          const approvedCount = await tx.guidedGroupSessionEnrollment.count({
            where: { sessionId: session.id, status: 'APPROVED' },
          });

          if (approvedCount >= session.learnerCapacity) {
            throw new Error('SESSION_FULL');
          }

          const enrollment =
            restorable
              ? await tx.guidedGroupSessionEnrollment.update({
                  where: { id: existing.id },
                  data: {
                    status: 'APPROVED',
                    decidedAt: now,
                    decidedById: null,
                    cancelledAt: null,
                  },
                  select: { id: true, status: true },
                })
              : await tx.guidedGroupSessionEnrollment.create({
                  data: {
                    sessionId: session.id,
                    userId,
                    status: 'APPROVED',
                    decidedAt: now,
                    decidedById: null,
                  },
                  select: { id: true, status: true },
                });

          return { enrollmentId: enrollment.id, status: enrollment.status, sessionId: session.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isDbSchemaMismatch(error)) throw error;

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < MAX_RETRIES - 1) continue;
      }

      const message = error instanceof Error ? error.message : '';
      if (message === 'SESSION_NOT_FOUND') throw error;
      if (message === 'CANNOT_ENROLL_OWN') throw error;
      if (message === 'NOT_ACCEPTING') throw error;
      if (message === 'ALREADY_STARTED') throw error;
      if (message === 'SESSION_FULL') throw error;

      throw error;
    }
  }

  throw new Error('TRANSACTION_RETRY_EXHAUSTED');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: paramIdRaw } = await params;
    const body = await request.json().catch(() => ({} as { sessionId?: string }));
    const paramId = typeof paramIdRaw === 'string' ? paramIdRaw.trim() : '';
    const bodyId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const sessionId = bodyId || paramId;
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role && isStaff(user.role)) {
      return NextResponse.json(
        { error: 'Staff accounts cannot enroll in guided group sessions.' },
        { status: 403 },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `guided-group-sessions:enroll:${identifier}`,
      RATE_LIMITS.WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const now = new Date();

    const result = await registerFirstCome({ sessionId, userId, now }).catch((error) => {
      const message = error instanceof Error ? error.message : '';
      if (message === 'SESSION_NOT_FOUND') return { errorKey: 'not_found' as const };
      if (message === 'CANNOT_ENROLL_OWN') return { errorKey: 'own' as const };
      if (message === 'NOT_ACCEPTING') return { errorKey: 'not_accepting' as const };
      if (message === 'ALREADY_STARTED') return { errorKey: 'started' as const };
      if (message === 'SESSION_FULL') return { errorKey: 'full' as const };
      throw error;
    });

    if ('errorKey' in result) {
      if (result.errorKey === 'not_found') {
        return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
      }
      if (result.errorKey === 'own') {
        return NextResponse.json({ error: 'You cannot enroll in your own session.' }, { status: 400 });
      }
      if (result.errorKey === 'not_accepting') {
        return NextResponse.json({ error: 'This session is not accepting registrations.' }, { status: 409 });
      }
      if (result.errorKey === 'started') {
        return NextResponse.json({ error: 'This session has already started.' }, { status: 409 });
      }
      if (result.errorKey === 'full') {
        return NextResponse.json({ error: 'This session is full.' }, { status: 409 });
      }
    }

    return NextResponse.json({ status: result.status, enrollmentId: result.enrollmentId, sessionId: result.sessionId });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Registrations are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error enrolling in guided group session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: paramIdRaw } = await params;
    const body = await request.json().catch(() => ({} as { sessionId?: string }));
    const paramId = typeof paramIdRaw === 'string' ? paramIdRaw.trim() : '';
    const bodyId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const sessionId = bodyId || paramId;
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
      `guided-group-sessions:enroll:cancel:${identifier}`,
      RATE_LIMITS.WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const enrollment = await prisma.guidedGroupSessionEnrollment.findFirst({
      where: { sessionId, userId },
      select: {
        id: true,
        status: true,
        session: { select: { status: true, scheduledAt: true } },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }

    if (enrollment.session.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'This session is not accepting changes.' }, { status: 409 });
    }

    const now = new Date();
    if (enrollment.session.scheduledAt.getTime() <= now.getTime()) {
      return NextResponse.json({ error: 'This session has already started.' }, { status: 409 });
    }

    if (enrollment.status === 'CANCELLED') {
      return NextResponse.json({ ok: true, status: enrollment.status });
    }

    const updated = await prisma.guidedGroupSessionEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'CANCELLED', cancelledAt: now },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error cancelling guided group session enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
