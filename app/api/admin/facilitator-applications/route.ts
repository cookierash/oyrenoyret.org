/**
 * Admin Facilitator Applications API
 *
 * GET: List facilitator applications (staff only).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { sanitizeInput } from '@/src/security/validation';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const STATUSES = new Set(['PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'ALL']);

function isDbUnreachable(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string'
      ? String((error as any).code)
      : '';

  if (code === 'P1001') return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message) return false;
  const lowered = message.toLowerCase();
  return lowered.includes("can't reach database server") || lowered.includes('cannot reach database server');
}

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`admin:facilitator-applications:list:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user?.role || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = prisma as unknown as Record<string, unknown>;
    const facilitatorApplicationDelegate = db.facilitatorApplication as
      | { findMany: (args: unknown) => Promise<any[]> }
      | undefined;
    if (!facilitatorApplicationDelegate) {
      return NextResponse.json(
        {
          error: 'Guided group sessions are not available yet. Database migrations may be missing.',
          errorKey: 'DB_SCHEMA_MISMATCH',
        },
        { status: 503, headers: getPrivateNoStoreHeaders() },
      );
    }

    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 200);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 200;
    const statusParam = String(searchParams.get('status') ?? 'ALL').toUpperCase();
    const status = STATUSES.has(statusParam) ? statusParam : 'ALL';
    const qRaw = String(searchParams.get('q') ?? '').trim();
    const q = qRaw ? sanitizeInput(qRaw).slice(0, 120) : '';

    let rows: any[] = [];
    try {
      rows = await facilitatorApplicationDelegate.findMany({
        where: {
          deletedAt: null,
          ...(status === 'ALL' ? {} : { status: status as any }),
          ...(q
            ? {
                OR: [
                  { user: { email: { contains: q, mode: 'insensitive' } } },
                  { user: { firstName: { contains: q, mode: 'insensitive' } } },
                  { user: { lastName: { contains: q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          phoneNumber: true,
          finCode: true,
          motivationLetter: true,
          status: true,
          reviewerMessage: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              grade: true,
              dateOfBirth: true,
              parentFirstName: true,
              parentLastName: true,
              parentEmail: true,
            },
          },
          reviewedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
          subjects: {
            orderBy: { subjectId: 'asc' },
            select: { subjectId: true, approvedAt: true },
          },
        },
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) {
        return NextResponse.json(
          {
            error: 'Guided group sessions are not available yet. Database migrations may be missing.',
            errorKey: 'DB_SCHEMA_MISMATCH',
          },
          { status: 503, headers: getPrivateNoStoreHeaders() },
        );
      }
      if (isDbUnreachable(error)) {
        return NextResponse.json(
          {
            error: 'Database is unreachable. Please check your DATABASE_URL and network access.',
            errorKey: 'DB_UNREACHABLE',
          },
          { status: 503, headers: getPrivateNoStoreHeaders() },
        );
      }
      throw error;
    }

    return NextResponse.json(rows, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error listing facilitator applications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
