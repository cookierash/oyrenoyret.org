/**
 * Curriculum Topic Admin API
 *
 * PATCH: Update/rename topic under subject (staff only)
 * DELETE: Soft delete topic under subject (staff only)
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildDeletedSlug(base: string) {
  const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return normalizeSlug(`${base}-deleted-${suffix}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; topic: string }> },
) {
  try {
    const { slug: rawSubject, topic: rawTopic } = await params;
    const subjectLooksLikeId = isUuid(rawSubject);
    const subjectSlug = subjectLooksLikeId ? '' : normalizeSlug(rawSubject);
    if (!subjectLooksLikeId && !isValidSlug(subjectSlug)) {
      return NextResponse.json({ error: 'Invalid subject slug' }, { status: 400 });
    }

    const topicLooksLikeId = isUuid(rawTopic);
    const topicSlug = topicLooksLikeId ? '' : normalizeSlug(rawTopic);
    if (!topicLooksLikeId && !isValidSlug(topicSlug)) {
      return NextResponse.json({ error: 'Invalid topic slug' }, { status: 400 });
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
    const rateLimit = await checkRateLimit(`curriculum:topics:update:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subject = await prisma.subject.findFirst({
      where: subjectLooksLikeId
        ? { id: rawSubject, deletedAt: null }
        : {
            deletedAt: null,
            OR: [
              { slug: subjectSlug },
              { slugAz: subjectSlug },
              { slug: { equals: rawSubject, mode: 'insensitive' } },
              { slugAz: { equals: rawSubject, mode: 'insensitive' } },
            ],
          },
      select: { id: true, slug: true, slugAz: true },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found', subject: rawSubject }, { status: 404 });
    }

    const topic = await prisma.topic.findFirst({
      where: {
        subjectId: subject.id,
        deletedAt: null,
        ...(topicLooksLikeId
          ? { id: rawTopic }
          : {
              OR: [
                { slug: topicSlug },
                { slugAz: topicSlug },
                { slug: { equals: rawTopic, mode: 'insensitive' } },
                { slugAz: { equals: rawTopic, mode: 'insensitive' } },
              ],
            }),
      },
      select: { id: true, slug: true, slugAz: true },
    });
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found', topic: rawTopic }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nextSlug = body?.slug ? normalizeSlug(body.slug) : null;
    if (nextSlug && !isValidSlug(nextSlug)) {
      return NextResponse.json({ error: 'Invalid topic slug' }, { status: 400 });
    }
    const nextSlugAz = body?.slugAz ? normalizeSlug(body.slugAz) : null;
    if (nextSlugAz && !isValidSlug(nextSlugAz)) {
      return NextResponse.json({ error: 'Invalid topic slug' }, { status: 400 });
    }

    const nameEn = typeof body?.nameEn === 'string' ? sanitizeInput(body.nameEn) : undefined;
    const nameAz = typeof body?.nameAz === 'string' ? sanitizeInput(body.nameAz) : undefined;

    if (nextSlug && nextSlug !== topic.slug) {
      const existing = await prisma.topic.findFirst({
        where: {
          subjectId: subject.id,
          id: { not: topic.id },
          OR: [{ slug: nextSlug }, { slugAz: nextSlug }],
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: 'Topic slug already exists' }, { status: 409 });
      }
    }

    if (nextSlugAz && nextSlugAz !== topic.slugAz) {
      const existing = await prisma.topic.findFirst({
        where: {
          subjectId: subject.id,
          id: { not: topic.id },
          OR: [{ slug: nextSlugAz }, { slugAz: nextSlugAz }],
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: 'Topic slug already exists' }, { status: 409 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTopic = await tx.topic.update({
        where: { id: topic.id },
        data: {
          ...(nextSlug && nextSlug !== topic.slug ? { slug: nextSlug } : {}),
          ...(nextSlugAz && nextSlugAz !== topic.slugAz ? { slugAz: nextSlugAz } : {}),
          ...(nameEn !== undefined ? { nameEn } : {}),
          ...(nameAz !== undefined ? { nameAz } : {}),
        },
        select: { id: true, slug: true, slugAz: true, nameEn: true, nameAz: true },
      });

      if (nextSlug && nextSlug !== topic.slug) {
        await Promise.all([
          tx.material.updateMany({
            where: { subjectId: subject.slug, topicId: topic.slug },
            data: { topicId: nextSlug },
          }),
          tx.discussion.updateMany({
            where: { subjectId: subject.slug, topicId: topic.slug },
            data: { topicId: nextSlug },
          }),
          tx.guidedGroupSession.updateMany({
            where: { subjectId: subject.slug, topicId: topic.slug },
            data: { topicId: nextSlug },
          }),
        ]);
      }

      return updatedTopic;
    });

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${subject.slug}`);
    revalidatePath(`/catalog/${subject.slugAz}`);
    revalidatePath(`/catalog/${subject.slug}/${topic.slug}`);
    revalidatePath(`/catalog/${subject.slugAz}/${topic.slugAz}`);
    revalidatePath(`/catalog/${subject.slug}/${updated.slug}`);
    revalidatePath(`/catalog/${subject.slugAz}/${updated.slugAz}`);

    return NextResponse.json(updated);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error updating topic:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; topic: string }> },
) {
  try {
    const { slug: rawSubject, topic: rawTopic } = await params;
    const subjectLooksLikeId = isUuid(rawSubject);
    const subjectSlug = subjectLooksLikeId ? '' : normalizeSlug(rawSubject);
    if (!subjectLooksLikeId && !isValidSlug(subjectSlug)) {
      return NextResponse.json({ error: 'Invalid subject slug' }, { status: 400 });
    }

    const topicLooksLikeId = isUuid(rawTopic);
    const topicSlug = topicLooksLikeId ? '' : normalizeSlug(rawTopic);
    if (!topicLooksLikeId && !isValidSlug(topicSlug)) {
      return NextResponse.json({ error: 'Invalid topic slug' }, { status: 400 });
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
    const rateLimit = await checkRateLimit(`curriculum:topics:delete:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subject = await prisma.subject.findFirst({
      where: subjectLooksLikeId
        ? { id: rawSubject, deletedAt: null }
        : {
            deletedAt: null,
            OR: [
              { slug: subjectSlug },
              { slugAz: subjectSlug },
              { slug: { equals: rawSubject, mode: 'insensitive' } },
              { slugAz: { equals: rawSubject, mode: 'insensitive' } },
            ],
          },
      select: { id: true, slug: true, slugAz: true },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found', subject: rawSubject }, { status: 404 });
    }

    const topic = await prisma.topic.findFirst({
      where: {
        subjectId: subject.id,
        deletedAt: null,
        ...(topicLooksLikeId
          ? { id: rawTopic }
          : {
              OR: [
                { slug: topicSlug },
                { slugAz: topicSlug },
                { slug: { equals: rawTopic, mode: 'insensitive' } },
                { slugAz: { equals: rawTopic, mode: 'insensitive' } },
              ],
            }),
      },
      select: { id: true, slug: true, slugAz: true },
    });
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found', topic: rawTopic }, { status: 404 });
    }

    await prisma.topic.update({
      where: { id: topic.id },
      data: {
        deletedAt: new Date(),
        slug: buildDeletedSlug(topic.slug),
        slugAz: buildDeletedSlug(topic.slugAz),
      },
      select: { id: true },
    });

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${subject.slug}`);
    revalidatePath(`/catalog/${subject.slugAz}`);
    revalidatePath(`/catalog/${subject.slug}/${topic.slug}`);
    revalidatePath(`/catalog/${subject.slugAz}/${topic.slugAz}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error deleting topic:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
