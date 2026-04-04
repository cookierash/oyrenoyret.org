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
import { CatalogSearch } from '@/src/modules/materials/catalog-search';

interface TopicPageProps {
  params: Promise<{ subject: string; topic: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { subject: subjectId, topic: topicId } = await params;
  const subject = SUBJECTS.find((s) => s.id === subjectId);

  if (!subject) notFound();

  const topics = CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS];
  const topic = topics?.find((t) => t.id === topicId);

  if (!topic) notFound();

  return (
    <DashboardShell>
      <PageHeader
        title={topic.name}
        description={`${topic.name} in ${subject.name}`}
        actions={
          <>
            <Button size="sm" variant="primary" asChild>
              <Link href="/studio">Create material</Link>
            </Button>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href={`/catalog/${subjectId}`}>Back to {subject.name}</Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 pt-2">
        <section className="relative">
          <CatalogSearch
            tagMode="topic"
            tagOptions={topics.map((item) => ({ id: item.id, name: item.name }))}
            baseSubjectIds={[subjectId]}
            baseTopicIds={[topicId]}
          />
        </section>
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
