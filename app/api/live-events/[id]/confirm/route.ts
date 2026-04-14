/**
 * Live Event Confirmation API
 *
 * POST: Confirm registration for current user
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, roundCredits, spendSprintEntry } from '@/src/modules/credits';
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
        { error: 'Staff accounts cannot confirm live event registrations.' },
        { status: 403 },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:confirm:${identifier}`,
      RATE_LIMITS.LIVE_EVENT
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => ({}));
    const accepted = body?.accepted === true;
    const eventId =
      typeof body?.liveEventId === 'string' && body.liveEventId.trim().length > 0
        ? body.liveEventId.trim()
        : typeof paramIdRaw === 'string' && paramIdRaw.trim().length > 0
          ? paramIdRaw
          : '';

    if (!eventId) {
      return NextResponse.json(
        { error: 'Live event id is required' },
        { status: 400 }
      );
    }
    if (!accepted) {
      return NextResponse.json(
        { error: 'Registration rules must be accepted' },
        { status: 400 }
      );
    }

    const enrollment = await prisma.liveEventEnrollment.findUnique({
      where: { liveEventId_userId: { liveEventId: eventId, userId } },
      select: { id: true, status: true },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (enrollment.status === 'CONFIRMED') {
      return NextResponse.json({ status: enrollment.status });
    }

    if (enrollment.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Registration was cancelled' }, { status: 400 });
    }

    let event:
      | { id: string; creditCost: number; type: string; date: Date; maxParticipants?: number | null }
      | null = null;
    try {
      event = await prisma.liveEvent.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { id: true, creditCost: true, type: true, date: true, maxParticipants: true },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      try {
        event = (await prisma.liveEvent.findFirst({
          where: { id: eventId },
          select: { id: true, creditCost: true, type: true, date: true },
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

    const cost = roundCredits(event.creditCost);
    const balance = await getBalance(userId);
    if (balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: cost, balance },
        { status: 402 },
      );
    }

    const creditResult = await spendSprintEntry(userId, cost, event.id);
    if (!creditResult.success) {
      if (creditResult.error === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
          { error: 'Insufficient credits', required: cost, balance },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { error: creditResult.error ?? 'Failed to complete registration' },
        { status: 500 },
      );
    }

    const updated = await prisma.liveEventEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'CONFIRMED', verifiedAt: new Date() },
      select: { status: true },
    });

    return NextResponse.json({
      status: updated.status,
      balanceAfter: creditResult.balanceAfter,
      creditsSpent: Math.abs(creditResult.amount),
    });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Registrations are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error confirming live event registration:', error);
    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
