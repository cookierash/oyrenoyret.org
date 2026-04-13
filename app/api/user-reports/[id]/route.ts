/**
 * User Report Admin API
 *
 * PATCH: Update status / resolve (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const ALLOWED = new Set(['PENDING', 'RESOLVED', 'DISMISSED']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`user-reports:update:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => ({}));
    const status = typeof body?.status === 'string' ? body.status.trim().toUpperCase() : '';
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await prisma.userReport.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const resolvedAt = status === 'PENDING' ? null : new Date();
    const resolvedById = status === 'PENDING' ? null : userId;

    const updated = await prisma.userReport.update({
      where: { id },
      data: {
        status: status as any,
        resolvedAt,
        resolvedById,
      },
      select: { id: true, status: true, resolvedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'User reports are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error updating user report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
