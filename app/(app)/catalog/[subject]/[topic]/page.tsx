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
import { TopicMaterialsClient } from '@/src/modules/materials/topic-materials-client';
import { getI18n } from '@/src/i18n/server';
import { resolveCurriculumNames } from '@/src/modules/curriculum/resolve-curriculum-names';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TopicPageProps {
  params: Promise<{ subject: string; topic: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { subject: subjectId, topic: topicId } = await params;
  const { locale, messages, t } = await getI18n();
  const copy = messages.app.catalog;

  const curriculum = await resolveCurriculumNames({ messages, locale, subjectId, topicId });
  if (!curriculum) notFound();
  const {
    subjectName,
    topicName,
    subjectId: canonicalSubjectId,
    topicId: canonicalTopicId,
    subjectHrefSlug,
  } = curriculum;

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
              <Link href={`/catalog/${subjectHrefSlug}`}>
                {t('app.catalog.backToSubject', { subject: subjectName })}
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 pt-2">
        <section>
          <TopicMaterialsClient subjectId={canonicalSubjectId} topicId={canonicalTopicId} />
        </section>
      </main>
    </DashboardShell>
  );
}

export function generateStaticParams() {
  return [];
}
