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
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubject } from '@/src/i18n/subject-utils';
import { getLocalizedTopics } from '@/src/i18n/topic-utils';

interface TopicPageProps {
  params: Promise<{ subject: string; topic: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { subject: subjectId, topic: topicId } = await params;
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { messages, t } = await getI18n();
  const copy = messages.app.catalog;

  if (!subject) notFound();

  const localizedSubject = getLocalizedSubject(messages, subject.id) ?? subject;

  const topics = getLocalizedTopics(messages, subject.id);
  const topic = topics.find((t) => t.id === topicId);

  if (!topic) notFound();

  return (
    <DashboardShell>
      <PageHeader
        title={topic.name}
        description={`${topic.name} · ${localizedSubject.name}`}
        actions={
          <>
            <Button size="sm" variant="primary" asChild>
              <Link href="/studio">{copy.createMaterial}</Link>
            </Button>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href={`/catalog/${subjectId}`}>
                {t('app.catalog.backToSubject', { subject: localizedSubject.name })}
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
