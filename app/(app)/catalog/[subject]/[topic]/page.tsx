/**
 * Topic Page
 *
 * Individual topic detail. Shows materials shared by students (created in Studio).
 * Materials require credits to unlock.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { TopicMaterialsClient } from '@/src/modules/materials/topic-materials-client';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubject } from '@/src/i18n/subject-utils';
import { getLocalizedTopics } from '@/src/i18n/topic-utils';

interface TopicPageProps {
  params: Promise<{ subject: string; topic: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { subject: subjectId, topic: topicId } = await params;
  const { locale, messages, t } = await getI18n();
  const copy = messages.app.catalog;

  let dbSubject: {
    id: string;
    slug: string;
    nameEn: string;
    nameAz: string;
    descriptionEn: string | null;
    descriptionAz: string | null;
  } | null = null;
  try {
    dbSubject = await prisma.subject.findFirst({
      where: { slug: subjectId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAz: true,
        descriptionEn: true,
        descriptionAz: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbSubject = null;
  }
  const fallbackSubject = SUBJECTS.find((s) => s.id === subjectId) ?? null;
  if (!dbSubject && !fallbackSubject) notFound();

  const fallbackLocalizedSubject = fallbackSubject
    ? getLocalizedSubject(messages, fallbackSubject.id) ?? fallbackSubject
    : null;
  const subjectName = dbSubject
    ? locale === 'az'
      ? dbSubject.nameAz
      : dbSubject.nameEn
    : (fallbackLocalizedSubject?.name ?? subjectId);

  let topic:
    | { slug: string; nameEn: string; nameAz: string }
    | { name: string }
    | null = null;
  if (dbSubject) {
    try {
      topic = await prisma.topic.findFirst({
        where: { subjectId: dbSubject.id, slug: topicId, deletedAt: null },
        select: { slug: true, nameEn: true, nameAz: true },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      topic = null;
    }
  }
  if (!topic && fallbackSubject) {
    topic = getLocalizedTopics(messages, fallbackSubject.id).find((t) => t.id === topicId) ?? null;
  }

  if (!topic) notFound();
  const topicName =
    dbSubject && 'nameEn' in topic
      ? locale === 'az'
        ? topic.nameAz
        : topic.nameEn
      : (topic as { name: string }).name;

  return (
    <DashboardShell>
      <PageHeader
        title={topicName}
        description={`${topicName} · ${subjectName}`}
        actions={
          <>
            <Button size="sm" variant="primary" asChild>
              <Link href="/studio">{copy.createMaterial}</Link>
            </Button>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href={`/catalog/${subjectId}`}>
                {t('app.catalog.backToSubject', { subject: subjectName })}
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 pt-2">
        <section>
          <TopicMaterialsClient subjectId={subjectId} topicId={topicId} />
        </section>
      </main>
    </DashboardShell>
  );
}

export function generateStaticParams() {
  const params: { subject: string; topic: string }[] = [];
  for (const subject of SUBJECTS) {
    const topics = CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS];
    for (const topic of topics ?? []) {
      params.push({ subject: subject.id, topic: topic.id });
    }
  }
  return params;
}
