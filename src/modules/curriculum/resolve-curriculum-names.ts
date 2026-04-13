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
}): Promise<{ subjectName: string; topicName: string } | null> {
  const { messages, locale, subjectId, topicId } = args;

  const fallbackSubject = SUBJECTS.find((s) => s.id === subjectId) ?? null;

  let dbSubject:
    | { id: string; slug: string; nameEn: string; nameAz: string }
    | null = null;
  try {
    dbSubject = await prisma.subject.findFirst({
      where: { slug: subjectId, deletedAt: null },
      select: { id: true, slug: true, nameEn: true, nameAz: true },
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
    };
  }

  const subjectName = locale === 'az' ? dbSubject.nameAz : dbSubject.nameEn;

  let dbTopic: { slug: string; nameEn: string; nameAz: string } | null = null;
  try {
    dbTopic = await prisma.topic.findFirst({
      where: { subjectId: dbSubject.id, slug: topicId, deletedAt: null },
      select: { slug: true, nameEn: true, nameAz: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbTopic = null;
  }

  if (dbTopic) {
    return {
      subjectName,
      topicName: locale === 'az' ? dbTopic.nameAz : dbTopic.nameEn,
    };
  }

  if (!fallbackSubject) return null;
  const topicName = getLocalizedTopicName(messages, fallbackSubject.id, topicId);
  if (!topicName) return null;
  return {
    subjectName,
    topicName,
  };
}

