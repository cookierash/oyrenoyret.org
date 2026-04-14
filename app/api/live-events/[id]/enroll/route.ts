/**
 * Live Event Enrollment API
 *
 * POST: Register current user for live event
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { roundCredits } from '@/src/modules/credits';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramIdRaw } = await params;
    const body = await request.json().catch(() => ({} as { liveEventId?: string; eventId?: string }));
    const paramId = typeof paramIdRaw === 'string' ? paramIdRaw.trim() : '';
    const bodyId =
      typeof body?.liveEventId === 'string'
        ? body.liveEventId.trim()
        : typeof body?.eventId === 'string'
          ? body.eventId.trim()
          : '';
    const eventId = bodyId || paramId;
    if (!eventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
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
        { status: verified.status }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role && isStaff(user.role)) {
      return NextResponse.json(
        { error: 'Staff accounts cannot register for live events.' },
        { status: 403 },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:enroll:${identifier}`,
      RATE_LIMITS.LIVE_EVENT
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let event: { id: string; creditCost: number; date: Date; maxParticipants?: number | null } | null = null;
    try {
      event = await prisma.liveEvent.findFirst({
        where: { id: eventId, deletedAt: null },
        select: {
          id: true,
          creditCost: true,
          date: true,
          maxParticipants: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      try {
        event = (await prisma.liveEvent.findFirst({
          where: { id: eventId },
          select: {
            id: true,
            creditCost: true,
            date: true,
          },
        })) as any;
        if (event) (event as any).maxParticipants = null;
      } catch {
        event = null;
      }
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.date.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'This event is no longer accepting registrations.' },
        { status: 409 },
      );
    }

    if (event.maxParticipants !== null && event.maxParticipants !== undefined) {
      const reservedCount = await prisma.liveEventEnrollment.count({
        where: { liveEventId: event.id, status: { in: ['PENDING', 'CONFIRMED'] } },
      });
      if (reservedCount >= event.maxParticipants) {
        return NextResponse.json(
          { error: 'This event is full. Please try another session.' },
          { status: 409 },
        );
      }
    }

    const existing = await prisma.liveEventEnrollment.findUnique({
      where: { liveEventId_userId: { liveEventId: event.id, userId } },
      select: { id: true, status: true, liveEventId: true },
    });

    if (existing) {
      if (existing.status === 'CANCELLED') {
        const restored = await prisma.liveEventEnrollment.update({
          where: { id: existing.id },
          data: { status: 'PENDING', verifiedAt: null },
          select: { id: true, status: true, liveEventId: true },
        });
        return NextResponse.json({
          status: restored.status,
          enrollmentId: restored.id,
          eventId: restored.liveEventId,
        });
      }

      return NextResponse.json({
        status: existing.status,
        enrollmentId: existing.id,
        eventId: existing.liveEventId,
      });
    }

    const enrollment = await prisma.liveEventEnrollment.create({
      data: {
        liveEventId: event.id,
        userId,
        status: 'PENDING',
      },
      select: { id: true, status: true, liveEventId: true },
    });

    return NextResponse.json({
      status: enrollment.status,
      enrollmentId: enrollment.id,
      eventId: enrollment.liveEventId,
      creditCost: roundCredits(event.creditCost),
    });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Registrations are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error registering for live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
