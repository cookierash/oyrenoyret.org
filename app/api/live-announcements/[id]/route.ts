/**
 * Live Announcement API
 *
 * DELETE: Soft delete announcement (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-announcements:delete:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let updated: { count: number } = { count: 0 };
    try {
      updated = await prisma.liveAnnouncement.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      // Safe rollout fallback: legacy schema may not have `deletedAt`.
      try {
        await prisma.liveAnnouncement.delete({ where: { id } });
        updated = { count: 1 };
      } catch {
        updated = { count: 0 };
      }
    }

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Live announcements are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error deleting announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
