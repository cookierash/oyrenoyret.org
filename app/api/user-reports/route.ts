/**
 * User Reports API
 *
 * POST: Create a report against another user (auth required)
 * GET:  List reports (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const ALLOWED_REASONS = new Set(['SPAM', 'HARASSMENT', 'CHEATING', 'IMPERSONATION', 'OTHER']);
const ALLOWED_TARGETS = new Set(['PROFILE', 'DISCUSSION', 'DISCUSSION_REPLY', 'MATERIAL', 'MATERIAL_COMMENT']);

export async function POST(request: Request) {
  try {
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

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`user-reports:create:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => ({}));
    const reported = typeof body?.reportedUserId === 'string' ? body.reportedUserId.trim() : '';
    const targetTypeRaw = typeof body?.targetType === 'string' ? body.targetType.trim().toUpperCase() : '';
    const targetId = typeof body?.targetId === 'string' ? sanitizeInput(body.targetId).slice(0, 64) : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim().toUpperCase() : '';
    const details = typeof body?.details === 'string' ? sanitizeInput(body.details).slice(0, 2000) : '';
    const contextUrl = typeof body?.contextUrl === 'string' ? sanitizeInput(body.contextUrl).slice(0, 500) : '';

    if (!reported) {
      return NextResponse.json({ error: 'reportedUserId is required' }, { status: 400 });
    }
    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }
    if (!details || !details.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const targetType = targetTypeRaw && ALLOWED_TARGETS.has(targetTypeRaw) ? targetTypeRaw : 'PROFILE';
    if (targetType !== 'PROFILE' && !targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }

    const reportedUser = await prisma.user.findFirst({
      where: { deletedAt: null, OR: [{ id: reported }, { publicId: reported }] },
      select: { id: true },
    });
    if (!reportedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (reportedUser.id === userId) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 });
    }

    const created = await prisma.userReport.create({
      data: {
        reporterId: userId,
        reportedUserId: reportedUser.id,
        targetType: targetType as any,
        targetId: targetType === 'PROFILE' ? (targetId || reportedUser.id) : targetId,
        reason: reason as any,
        details: details,
        contextUrl: contextUrl || null,
        status: 'PENDING',
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(created);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Reporting is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error creating user report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !isStaff(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`user-reports:list:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const allowedStatuses = new Set(['PENDING', 'RESOLVED', 'DISMISSED']);
    const status = statusParam && allowedStatuses.has(statusParam) ? statusParam : null;
    const takeParam = Number(searchParams.get('take') ?? 100);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100;

    const reports = await prisma.userReport.findMany({
      where: { deletedAt: null, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        contextUrl: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        reporter: {
          select: { id: true, publicId: true, email: true, firstName: true, lastName: true },
        },
        reportedUser: {
          select: { id: true, publicId: true, email: true, firstName: true, lastName: true },
        },
        resolvedBy: {
          select: { id: true, publicId: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'User reports are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error listing user reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
