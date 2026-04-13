/**
 * Curriculum API
 *
 * GET: Subjects + topics for dynamic routing and tag pickers.
 * Falls back to built-in constants when the DB tables are empty.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { RATE_LIMITS, SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { EN_MESSAGES } from '@/src/i18n/messages/en';
import { AZ_MESSAGES } from '@/src/i18n/messages/az';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

type SubjectMessages = Record<
  string,
  { name?: string; description?: string } | undefined
>;

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
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`curriculum:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let subjects: any[] = [];
    let hasSchemaMismatch = false;
    try {
      subjects = await prisma.subject.findMany({
        where: { deletedAt: null },
        orderBy: { slug: 'asc' },
        select: {
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
              slug: true,
              slugAz: true,
              nameEn: true,
              nameAz: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      hasSchemaMismatch = true;
    }

    if (!hasSchemaMismatch && subjects.length > 0) {
      return NextResponse.json({ subjects }, { headers: getPrivateNoStoreHeaders() });
    }

    if (!hasSchemaMismatch) {
      const total = await prisma.subject.count();
      if (total > 0) {
        return NextResponse.json({ subjects: [] }, { headers: getPrivateNoStoreHeaders() });
      }
    }

    const fallback = SUBJECTS.map((subject) => {
      const en = getFallbackSubject(subject.id, 'en');
      const az = getFallbackSubject(subject.id, 'az');
      const topics = (CURRICULUM_TOPICS as Record<string, Array<{ id: string }>>)[subject.id] ?? [];
      return {
        slug: subject.id,
        slugAz: subject.id,
        nameEn: en.name,
        nameAz: az.name,
        descriptionEn: en.description,
        descriptionAz: az.description,
        topics: topics.map((topic) => ({
          slug: topic.id,
          slugAz: topic.id,
          nameEn: getFallbackTopicName(subject.id, topic.id, 'en'),
          nameAz: getFallbackTopicName(subject.id, topic.id, 'az'),
        })),
      };
    });

    return NextResponse.json({ subjects: fallback }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching curriculum:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
