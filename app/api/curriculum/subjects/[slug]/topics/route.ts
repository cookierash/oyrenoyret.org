/**
 * Curriculum Topics Admin API
 *
 * POST: Create topic under subject (staff only)
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const subjectSlug = normalizeSlug(rawSlug);
    if (!isValidSlug(subjectSlug)) {
      return NextResponse.json({ error: 'Invalid subject slug' }, { status: 400 });
    }

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
    const rateLimit = await checkRateLimit(`curriculum:topics:create:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subject = await prisma.subject.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: rawSlug },
          { id: subjectSlug },
          { slug: rawSlug },
          { slugAz: rawSlug },
          { slug: subjectSlug },
          { slugAz: subjectSlug },
          { slug: { equals: rawSlug, mode: 'insensitive' } },
          { slugAz: { equals: rawSlug, mode: 'insensitive' } },
        ],
      },
      select: { id: true, slug: true },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found', subject: rawSlug }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const slug = normalizeSlug(body?.slug);
    const slugAz = normalizeSlug(body?.slugAz);
    const nameEn = typeof body?.nameEn === 'string' ? sanitizeInput(body.nameEn) : '';
    const nameAz = typeof body?.nameAz === 'string' ? sanitizeInput(body.nameAz) : '';

    if (!isValidSlug(slug) || !isValidSlug(slugAz)) {
      return NextResponse.json({ error: 'Invalid topic slug' }, { status: 400 });
    }
    if (!nameEn || !nameAz) {
      return NextResponse.json({ error: 'nameEn and nameAz are required' }, { status: 400 });
    }

    const existing = await prisma.topic.findFirst({
      where: {
        subjectId: subject.id,
        deletedAt: null,
        OR: [{ slug }, { slugAz }, { slug: slugAz }, { slugAz: slug }],
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Topic slug already exists' }, { status: 409 });
    }

    const created = await prisma.topic.create({
      data: {
        subjectId: subject.id,
        slug,
        slugAz,
        nameEn,
        nameAz,
      },
      select: { id: true, slug: true, slugAz: true, nameEn: true, nameAz: true },
    });

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${subject.slug}`);
    revalidatePath(`/catalog/${subject.slug}/${created.slug}`);

    return NextResponse.json(created);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error creating topic:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
