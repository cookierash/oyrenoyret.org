/**
 * Live Event Enrollment API
 *
 * POST: Register current user for live event
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { roundCredits } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({} as { liveEventId?: string; eventId?: string }));
    const paramId = typeof params?.id === 'string' ? params.id.trim() : '';
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

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:enroll:${identifier}`,
      RATE_LIMITS.LIVE_EVENT
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const event = await prisma.liveEvent.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        id: true,
        creditCost: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
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
    console.error('Error registering for live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
