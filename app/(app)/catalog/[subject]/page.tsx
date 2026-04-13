/**
 * Subject Page
 *
 * Individual subject detail and topic listing.
 * Topics aligned with TIMSS, PISA, and common international curricula.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SUBJECTS } from '@/src/config/constants';
import { SUBJECT_COLORS } from '@/src/config/subject-meta';
import { PiBookOpen as BookOpen, PiCaretRight as ChevronRight } from 'react-icons/pi';
import { CatalogSearch } from '@/src/modules/materials/catalog-search';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubject } from '@/src/i18n/subject-utils';
import { getLocalizedTopics } from '@/src/i18n/topic-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SubjectPageProps {
  params: Promise<{ subject: string }>;
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { subject: subjectId } = await params;
  const { locale, messages } = await getI18n();
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
  const subjectSlug = dbSubject ? dbSubject.slug : (fallbackSubject as { id: string }).id;

  const localizedSubject = dbSubject
    ? {
        id: dbSubject.slug,
        name: locale === 'az' ? dbSubject.nameAz : dbSubject.nameEn,
        description: (locale === 'az' ? dbSubject.descriptionAz : dbSubject.descriptionEn) ?? '',
      }
    : (getLocalizedSubject(messages, (fallbackSubject as { id: string }).id) ??
      (fallbackSubject as { id: string; name: string; description: string }));

  let topics: Array<{ id: string; name: string }> = [];
  if (dbSubject) {
    try {
      topics = (
        await prisma.topic.findMany({
          where: { subjectId: dbSubject.id, deletedAt: null },
          orderBy: { slug: 'asc' },
          select: { slug: true, nameEn: true, nameAz: true },
        })
      ).map((topic) => ({
        id: topic.slug,
        name: locale === 'az' ? topic.nameAz : topic.nameEn,
      }));
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      topics = [];
    }
  }
  if ((!dbSubject || topics.length === 0) && fallbackSubject) {
    topics = getLocalizedTopics(messages, fallbackSubject.id).map((topic) => ({
      id: topic.id,
      name: topic.name,
    }));
  }

  if (!topics || topics.length === 0) notFound();

  let topicCounts: Array<{ topicId: string; _count: { _all: number } }> = [];
  try {
    const groupByArgs = {
      by: ['topicId'] as const,
      where: {
        subjectId: subjectSlug,
        status: 'PUBLISHED' as const,
        deletedAt: null,
      },
      _count: { _all: true as const },
    } satisfies Prisma.MaterialGroupByArgs;
    const counts = await prisma.material.groupBy(groupByArgs);
    topicCounts = counts;
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    topicCounts = [];
  }

  const topicCountMap = new Map(topicCounts.map((row) => [row.topicId, row._count._all]));

  return (
    <DashboardShell>
      <PageHeader
        title={localizedSubject.name}
        description={localizedSubject.description}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href="/catalog">{copy.backToCatalog}</Link>
          </Button>
        }
      />

      <main className="space-y-4 pt-2">
        <section className="relative">
          <CatalogSearch
            tagMode="topic"
            tagOptions={topics.map((item) => ({ id: item.id, name: item.name }))}
            baseSubjectIds={[subjectSlug]}
          />
        </section>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {copy.topicsIntro}
        </p>
        <section>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <li key={topic.id} className="min-w-0">
                <Link
                  href={`/catalog/${subjectId}/${topic.id}`}
                  className="group card-frame bg-card flex min-w-0 items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 hover:bg-muted/30"
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      (SUBJECT_COLORS as Record<string, string>)[subjectSlug] ??
                      'bg-muted text-foreground'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {topic.name}
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 text-[10px] text-muted-foreground truncate">
                          {topicCountMap.get(topic.id) ?? 0} {copy.materials}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </DashboardShell>
  );
}

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject: subject.id }));
}
