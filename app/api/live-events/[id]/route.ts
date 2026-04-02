/**
 * Live Event API
 *
 * DELETE: Soft delete event (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({} as { id?: string; eventId?: string }));
    const paramId = typeof params?.id === 'string' ? params.id.trim() : '';
    const bodyId =
      typeof body?.id === 'string'
        ? body.id.trim()
        : typeof body?.eventId === 'string'
          ? body.eventId.trim()
          : '';
    const eventId = paramId || bodyId;

    if (!eventId) {
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:delete:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const existing = await prisma.liveEvent.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await prisma.liveEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
