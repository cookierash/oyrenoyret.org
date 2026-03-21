/**
 * Live Event Enrollment API
 *
 * POST: Register current user for live event
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, roundCredits, spendSprintEntry } from '@/src/modules/credits';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await prisma.liveEvent.findFirst({
      where: { id: params.id, deletedAt: null },
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
      select: { id: true, status: true },
    });

    if (existing) {
      return NextResponse.json({
        status: existing.status,
        enrollmentId: existing.id,
      });
    }

    const cost = roundCredits(event.creditCost);
    const balance = await getBalance(userId);
    if (balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: cost, balance },
        { status: 402 }
      );
    }

    const creditResult = await spendSprintEntry(userId, cost, event.id);
    if (!creditResult.success) {
      if (creditResult.error === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
          { error: 'Insufficient credits', required: cost, balance },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: creditResult.error ?? 'Failed to register' },
        { status: 500 }
      );
    }

    const enrollment = await prisma.liveEventEnrollment.create({
      data: {
        liveEventId: event.id,
        userId,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({
      status: enrollment.status,
      enrollmentId: enrollment.id,
      balanceAfter: creditResult.balanceAfter,
      creditsSpent: Math.abs(creditResult.amount),
    });
  } catch (error) {
    console.error('Error registering for live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
