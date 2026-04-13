/**
 * Curriculum Subject Admin API
 *
 * PATCH: Update/rename subject (staff only)
 * DELETE: Soft delete subject (staff only)
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const currentSlug = normalizeSlug(rawSlug);
    if (!isValidSlug(currentSlug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
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
    const rateLimit = await checkRateLimit(`curriculum:subjects:update:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subject = await prisma.subject.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: rawSlug },
          { id: currentSlug },
          { slug: rawSlug },
          { slugAz: rawSlug },
          { slug: currentSlug },
          { slugAz: currentSlug },
          { slug: { equals: rawSlug, mode: 'insensitive' } },
          { slugAz: { equals: rawSlug, mode: 'insensitive' } },
        ],
      },
      select: { id: true, slug: true, slugAz: true },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found', subject: rawSlug }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nextSlug = body?.slug ? normalizeSlug(body.slug) : null;
    if (nextSlug && !isValidSlug(nextSlug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }
    const nextSlugAz = body?.slugAz ? normalizeSlug(body.slugAz) : null;
    if (nextSlugAz && !isValidSlug(nextSlugAz)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    const nameEn = typeof body?.nameEn === 'string' ? sanitizeInput(body.nameEn) : undefined;
    const nameAz = typeof body?.nameAz === 'string' ? sanitizeInput(body.nameAz) : undefined;
    const descriptionEn =
      typeof body?.descriptionEn === 'string'
        ? sanitizeInput(body.descriptionEn)
        : body?.descriptionEn === null
          ? null
          : undefined;
    const descriptionAz =
      typeof body?.descriptionAz === 'string'
        ? sanitizeInput(body.descriptionAz)
        : body?.descriptionAz === null
          ? null
          : undefined;

    if (nextSlug && nextSlug !== subject.slug) {
      const existing = await prisma.subject.findFirst({
        where: {
          deletedAt: null,
          id: { not: subject.id },
          OR: [{ slug: nextSlug }, { slugAz: nextSlug }],
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: 'Subject slug already exists' }, { status: 409 });
      }
    }

    if (nextSlugAz && nextSlugAz !== subject.slugAz) {
      const existing = await prisma.subject.findFirst({
        where: {
          deletedAt: null,
          id: { not: subject.id },
          OR: [{ slug: nextSlugAz }, { slugAz: nextSlugAz }],
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: 'Subject slug already exists' }, { status: 409 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSubject = await tx.subject.update({
        where: { id: subject.id },
        data: {
          ...(nextSlug && nextSlug !== subject.slug ? { slug: nextSlug } : {}),
          ...(nextSlugAz && nextSlugAz !== subject.slugAz ? { slugAz: nextSlugAz } : {}),
          ...(nameEn !== undefined ? { nameEn } : {}),
          ...(nameAz !== undefined ? { nameAz } : {}),
          ...(descriptionEn !== undefined ? { descriptionEn } : {}),
          ...(descriptionAz !== undefined ? { descriptionAz } : {}),
        },
        select: {
          id: true,
          slug: true,
          slugAz: true,
          nameEn: true,
          nameAz: true,
          descriptionEn: true,
          descriptionAz: true,
        },
      });

      if (nextSlug && nextSlug !== subject.slug) {
        await Promise.all([
          tx.material.updateMany({
            where: { subjectId: subject.slug },
            data: { subjectId: nextSlug },
          }),
          tx.discussion.updateMany({
            where: { subjectId: subject.slug },
            data: { subjectId: nextSlug },
          }),
        ]);
      }

      return updatedSubject;
    });

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${subject.slug}`);
    revalidatePath(`/catalog/${updated.slug}`);

    return NextResponse.json(updated);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = normalizeSlug(rawSlug);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
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
    const rateLimit = await checkRateLimit(`curriculum:subjects:delete:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subject = await prisma.subject.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: rawSlug },
          { id: slug },
          { slug: rawSlug },
          { slugAz: rawSlug },
          { slug },
          { slugAz: slug },
          { slug: { equals: rawSlug, mode: 'insensitive' } },
          { slugAz: { equals: rawSlug, mode: 'insensitive' } },
        ],
      },
      select: { id: true, slug: true },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found', subject: rawSlug }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.subject.update({ where: { id: subject.id }, data: { deletedAt: new Date() } }),
      prisma.topic.updateMany({ where: { subjectId: subject.id }, data: { deletedAt: new Date() } }),
    ]);

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${subject.slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
