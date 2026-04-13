import 'server-only';

import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { SUBJECTS } from '@/src/config/constants';
import { getLocalizedSubject } from '@/src/i18n/subject-utils';
import { getLocalizedTopicName } from '@/src/i18n/topic-utils';
import type { Messages } from '@/src/i18n';

export async function resolveCurriculumNames(args: {
  messages: Messages;
  locale: 'en' | 'az';
  subjectId: string;
  topicId: string;
}): Promise<{
  subjectName: string;
  topicName: string;
  subjectId: string;
  topicId: string;
  subjectHrefSlug: string;
  topicHrefSlug: string;
} | null> {
  const { messages, locale, subjectId, topicId } = args;

  const fallbackSubject = SUBJECTS.find((s) => s.id === subjectId) ?? null;

  let dbSubject:
    | { id: string; slug: string; slugAz: string; nameEn: string; nameAz: string }
    | null = null;
  try {
    dbSubject = await prisma.subject.findFirst({
      where: { OR: [{ slug: subjectId }, { slugAz: subjectId }], deletedAt: null },
      select: { id: true, slug: true, slugAz: true, nameEn: true, nameAz: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbSubject = null;
  }

  if (!dbSubject) {
    if (!fallbackSubject) return null;
    const localizedSubject = getLocalizedSubject(messages, fallbackSubject.id) ?? fallbackSubject;
    const topicName = getLocalizedTopicName(messages, fallbackSubject.id, topicId);
    if (!topicName) return null;
    return {
      subjectName: localizedSubject.name,
      topicName,
      subjectId: fallbackSubject.id,
      topicId,
      subjectHrefSlug: fallbackSubject.id,
      topicHrefSlug: topicId,
    };
  }

  const subjectName = locale === 'az' ? dbSubject.nameAz : dbSubject.nameEn;
  const subjectHrefSlug = locale === 'az' ? dbSubject.slugAz : dbSubject.slug;

  let dbTopic: { slug: string; slugAz: string; nameEn: string; nameAz: string } | null = null;
  try {
    dbTopic = await prisma.topic.findFirst({
      where: {
        subjectId: dbSubject.id,
        OR: [{ slug: topicId }, { slugAz: topicId }],
        deletedAt: null,
      },
      select: { slug: true, slugAz: true, nameEn: true, nameAz: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbTopic = null;
  }

  if (dbTopic) {
    return {
      subjectName,
      topicName: locale === 'az' ? dbTopic.nameAz : dbTopic.nameEn,
      subjectId: dbSubject.slug,
      topicId: dbTopic.slug,
      subjectHrefSlug,
      topicHrefSlug: locale === 'az' ? dbTopic.slugAz : dbTopic.slug,
    };
  }

  const fallbackBySlug = SUBJECTS.find((s) => s.id === dbSubject.slug) ?? null;
  if (!fallbackBySlug) return null;
  const topicName = getLocalizedTopicName(messages, fallbackBySlug.id, topicId);
  if (!topicName) return null;
  return {
    subjectName,
    topicName,
    subjectId: dbSubject.slug,
    topicId,
    subjectHrefSlug,
    topicHrefSlug: topicId,
  };
}
