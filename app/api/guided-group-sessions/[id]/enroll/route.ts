/**
 * Guided Group Session Enrollment API
 *
 * POST: Request to join a guided group session (learner).
 * Enrollment starts as PENDING and must be approved by the facilitator.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

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
    const session = await prisma.guidedGroupSession.findFirst({
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
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.facilitatorId === userId) {
      return NextResponse.json({ error: 'You cannot enroll in your own session.' }, { status: 400 });
    }

    if (session.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'This session is not accepting registrations.' }, { status: 409 });
    }

    if (session.scheduledAt.getTime() <= now.getTime()) {
      return NextResponse.json({ error: 'This session has already started.' }, { status: 409 });
    }

    const approvedCount = await prisma.guidedGroupSessionEnrollment.count({
      where: { sessionId: session.id, status: 'APPROVED' },
    });

    if (approvedCount >= session.learnerCapacity) {
      return NextResponse.json({ error: 'This session is full.' }, { status: 409 });
    }

    const existing = await prisma.guidedGroupSessionEnrollment.findUnique({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === 'CANCELLED') {
        const restored = await prisma.guidedGroupSessionEnrollment.update({
          where: { id: existing.id },
          data: { status: 'PENDING', decidedAt: null, decidedById: null, cancelledAt: null },
          select: { id: true, status: true },
        });
        return NextResponse.json({ status: restored.status, enrollmentId: restored.id, sessionId: session.id });
      }

      return NextResponse.json({ status: existing.status, enrollmentId: existing.id, sessionId: session.id });
    }

    const enrollment = await prisma.guidedGroupSessionEnrollment.create({
      data: { sessionId: session.id, userId, status: 'PENDING' },
      select: { id: true, status: true },
    });

    return NextResponse.json({ status: enrollment.status, enrollmentId: enrollment.id, sessionId: session.id });
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
