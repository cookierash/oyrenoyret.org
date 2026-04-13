/**
 * Curriculum Subjects Admin API
 *
 * GET: List subjects + topics (staff only)
 * POST: Create subject (staff only)
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS, SUBJECTS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { EN_MESSAGES } from '@/src/i18n/messages/en';
import { AZ_MESSAGES } from '@/src/i18n/messages/az';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { isValidSlug, normalizeSlug } from '@/src/modules/curriculum/slug';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

type SubjectMessages = Record<string, { name?: string; description?: string } | undefined>;
type TopicMessages = Record<string, Record<string, string> | undefined>;

function getFallbackSubject(slug: string, locale: 'en' | 'az') {
  const source = locale === 'az' ? AZ_MESSAGES : EN_MESSAGES;
  const subjects = source.subjects as SubjectMessages;
  const copy = subjects[slug];
  return {
    name: copy?.name ?? slug,
    description: copy?.description ?? '',
  };
}

function getFallbackTopicName(subjectSlug: string, topicSlug: string, locale: 'en' | 'az') {
  const source = locale === 'az' ? AZ_MESSAGES : EN_MESSAGES;
  const topics = source.topics as TopicMessages;
  return topics?.[subjectSlug]?.[topicSlug] ?? topicSlug;
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`curriculum:subjects:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subjects = await prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        slugAz: true,
        nameEn: true,
        nameAz: true,
        descriptionEn: true,
        descriptionAz: true,
        topics: {
          where: { deletedAt: null },
          orderBy: { slug: 'asc' },
          select: {
            id: true,
            slug: true,
            slugAz: true,
            nameEn: true,
            nameAz: true,
          },
        },
      },
    });

    if (subjects.length > 0) {
      return NextResponse.json({ source: 'db', subjects }, { headers: getPrivateNoStoreHeaders() });
    }

    const fallback = SUBJECTS.map((subject) => {
      const en = getFallbackSubject(subject.id, 'en');
      const az = getFallbackSubject(subject.id, 'az');
      const topics = (CURRICULUM_TOPICS as Record<string, Array<{ id: string }>>)[subject.id] ?? [];
      return {
        id: subject.id,
        slug: subject.id,
        slugAz: subject.id,
        nameEn: en.name,
        nameAz: az.name,
        descriptionEn: en.description,
        descriptionAz: az.description,
        topics: topics.map((topic) => ({
          id: topic.id,
          slug: topic.id,
          slugAz: topic.id,
          nameEn: getFallbackTopicName(subject.id, topic.id, 'en'),
          nameAz: getFallbackTopicName(subject.id, topic.id, 'az'),
        })),
      };
    });

    return NextResponse.json({ source: 'fallback', subjects: fallback }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error listing subjects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
        id: true,
        slug: true,
        slugAz: true,
        nameEn: true,
        nameAz: true,
        descriptionEn: true,
        descriptionAz: true,
      },
    });

    revalidatePath('/catalog');
    revalidatePath(`/catalog/${created.slug}`);
    revalidatePath(`/catalog/${created.slugAz}`);

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
