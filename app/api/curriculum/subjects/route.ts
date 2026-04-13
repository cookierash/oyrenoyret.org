/**
 * Curriculum Subjects Admin API
 *
 * POST: Create subject (staff only)
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
import { isValidSlug, normalizeSlug } from '@/src/modules/curriculum/slug';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

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

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`curriculum:subjects:create:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => ({}));
    const slug = normalizeSlug(body?.slug);
    const slugAz = normalizeSlug(body?.slugAz);
    const nameEn = typeof body?.nameEn === 'string' ? sanitizeInput(body.nameEn) : '';
    const nameAz = typeof body?.nameAz === 'string' ? sanitizeInput(body.nameAz) : '';
    const descriptionEn =
      typeof body?.descriptionEn === 'string' ? sanitizeInput(body.descriptionEn) : '';
    const descriptionAz =
      typeof body?.descriptionAz === 'string' ? sanitizeInput(body.descriptionAz) : '';

    if (!isValidSlug(slug) || !isValidSlug(slugAz)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }
    if (!nameEn || !nameAz) {
      return NextResponse.json({ error: 'nameEn and nameAz are required' }, { status: 400 });
    }

    const existing = await prisma.subject.findFirst({
      where: {
        deletedAt: null,
        OR: [{ slug }, { slugAz }, { slug: slugAz }, { slugAz: slug }],
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Subject slug already exists' }, { status: 409 });
    }

    const created = await prisma.subject.create({
      data: {
        slug,
        slugAz,
        nameEn,
        nameAz,
        descriptionEn: descriptionEn || null,
        descriptionAz: descriptionAz || null,
      },
      select: {
        slug: true,
        slugAz: true,
        nameEn: true,
        nameAz: true,
        descriptionEn: true,
        descriptionAz: true,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
