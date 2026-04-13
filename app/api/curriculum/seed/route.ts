/**
 * Curriculum Seed Admin API
 *
 * POST: Seed default subjects + topics into the DB (staff only).
 *
 * This is intended for first-time setup when curriculum tables exist but are empty.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS, SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { EN_MESSAGES } from '@/src/i18n/messages/en';
import { AZ_MESSAGES } from '@/src/i18n/messages/az';
import { isValidSlug, normalizeSlug } from '@/src/modules/curriculum/slug';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';

type SubjectMessages = Record<string, { name?: string; description?: string; tag?: string } | undefined>;
type TopicMessages = Record<string, Record<string, string> | undefined>;

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
    const rateLimit = await checkRateLimit(`curriculum:seed:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const existingCount = await prisma.subject.count();
    if (existingCount > 0) {
      return NextResponse.json({ seeded: false, reason: 'already_initialized' });
    }

    const enSubjects = EN_MESSAGES.subjects as SubjectMessages;
    const azSubjects = AZ_MESSAGES.subjects as SubjectMessages;
    const enTopics = EN_MESSAGES.topics as TopicMessages;
    const azTopics = AZ_MESSAGES.topics as TopicMessages;

    const seeded = await prisma.$transaction(async (tx) => {
      let subjectCount = 0;
      let topicCount = 0;

      for (const subject of SUBJECTS) {
        const subjectId = subject.id;
        const slug = normalizeSlug(subjectId);
        const enCopy = enSubjects[subjectId];
        const azCopy = azSubjects[subjectId];

        const slugAzCandidate = normalizeSlug(azCopy?.tag ?? azCopy?.name ?? subjectId);
        const slugAz = isValidSlug(slugAzCandidate) ? slugAzCandidate : slug;

        const nameEn = String(enCopy?.name ?? subject.name ?? slug).trim();
        const nameAz = String(azCopy?.name ?? nameEn).trim();
        const descriptionEn = String(enCopy?.description ?? subject.description ?? '').trim();
        const descriptionAz = String(azCopy?.description ?? descriptionEn).trim();

        const createdSubject = await tx.subject.create({
          data: {
            slug,
            slugAz,
            nameEn,
            nameAz,
            descriptionEn: descriptionEn || null,
            descriptionAz: descriptionAz || null,
          },
          select: { id: true },
        });
        subjectCount += 1;

        const defaults = (CURRICULUM_TOPICS as Record<string, Array<{ id: string; name: string }>>)[subjectId] ?? [];
        const rows = defaults.map((topic) => {
          const topicId = topic.id;
          const enName = String(enTopics?.[subjectId]?.[topicId] ?? topic.name ?? topicId).trim();
          const azName = String(azTopics?.[subjectId]?.[topicId] ?? enName).trim();

          const topicSlug = normalizeSlug(topicId);
          const topicSlugAzCandidate = normalizeSlug(azName);
          const topicSlugAz = isValidSlug(topicSlugAzCandidate) ? topicSlugAzCandidate : topicSlug;

          return {
            subjectId: createdSubject.id,
            slug: topicSlug,
            slugAz: topicSlugAz,
            nameEn: enName || topicSlug,
            nameAz: azName || enName || topicSlug,
          };
        });

        if (rows.length > 0) {
          await tx.topic.createMany({ data: rows });
          topicCount += rows.length;
        }
      }

      return { subjectCount, topicCount };
    });

    revalidatePath('/catalog');

    return NextResponse.json({ seeded: true, subjects: seeded.subjectCount, topics: seeded.topicCount });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Curriculum tables are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error seeding curriculum:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

