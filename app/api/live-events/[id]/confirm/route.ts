/**
 * Live Event Confirmation API
 *
 * POST: Confirm registration for current user
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enrollment = await prisma.liveEventEnrollment.findUnique({
      where: { liveEventId_userId: { liveEventId: params.id, userId } },
      select: { id: true, status: true },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (enrollment.status === 'CONFIRMED') {
      return NextResponse.json({ status: enrollment.status });
    }

    const updated = await prisma.liveEventEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'CONFIRMED', verifiedAt: new Date() },
      select: { status: true },
    });

    return NextResponse.json({ status: updated.status });
  } catch (error) {
    console.error('Error confirming live event registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
