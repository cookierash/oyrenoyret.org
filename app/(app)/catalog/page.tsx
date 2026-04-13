/**
 * Catalog Page
 *
 * Catalog of all subjects available for learning.
 */

import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { SUBJECT_ICONS, SUBJECT_COLORS } from '@/src/config/subject-meta';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { PiCaretRight as ChevronRight } from 'react-icons/pi';
import { CatalogSearch } from '@/src/modules/materials/catalog-search';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';
import { PiBookOpen as BookOpen } from 'react-icons/pi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CatalogPage() {
  const { locale, messages } = await getI18n();
  const copy = messages.app.catalog;
  let dbSubjects: Array<{
    id: string;
    slug: string;
    nameEn: string;
    nameAz: string;
    descriptionEn: string | null;
    descriptionAz: string | null;
  }> = [];
  let topicCounts: Array<{ subjectId: string; _count: { _all: number } }> = [];
  try {
    dbSubjects = await prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAz: true,
        descriptionEn: true,
        descriptionAz: true,
      },
    });
    const groupByArgs = {
      by: ['subjectId'] as const,
      where: { deletedAt: null },
      _count: { _all: true as const },
    } satisfies Prisma.TopicGroupByArgs;
    const counts = await prisma.topic.groupBy(groupByArgs);
    topicCounts = counts;
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbSubjects = [];
    topicCounts = [];
  }
  const topicCountBySubjectId = new Map(topicCounts.map((row) => [row.subjectId, row._count._all]));
  const subjects =
    dbSubjects.length > 0
      ? dbSubjects.map((subject) => ({
          id: subject.slug,
          name: locale === 'az' ? subject.nameAz : subject.nameEn,
          description:
            (locale === 'az' ? subject.descriptionAz : subject.descriptionEn) ?? '',
          topicCount: topicCountBySubjectId.get(subject.id) ?? 0,
        }))
      : getLocalizedSubjects(messages).map((subject) => ({
          id: subject.id,
          name: subject.name,
          description: subject.description,
          topicCount:
            (CURRICULUM_TOPICS as Record<string, unknown[]>)[subject.id]?.length ?? 0,
        }));
  let subjectCounts: Array<{ subjectId: string; _count: { _all: number } }> = [];
  try {
    const groupByArgs = {
      by: ['subjectId'] as const,
      where: {
        status: 'PUBLISHED' as const,
        deletedAt: null,
      },
      _count: { _all: true as const },
    } satisfies Prisma.MaterialGroupByArgs;
    const counts = await prisma.material.groupBy(groupByArgs);
    subjectCounts = counts;
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    subjectCounts = [];
  }

  const subjectCountMap = new Map(
    subjectCounts.map((row) => [row.subjectId, row._count._all])
  );

  return (
    <DashboardShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />

      <main className="space-y-4 pt-2">
        <section className="relative">
          <CatalogSearch />
        </section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const subjectId = subject.id;
            const Icon =
              (SUBJECT_ICONS as Record<string, typeof BookOpen>)[subjectId] ?? BookOpen;
            const topicCount = subject.topicCount ?? 0;
            const materialCount = subjectCountMap.get(subjectId) ?? 0;
            return (
              <Link
                key={subjectId}
                href={`/catalog/${subjectId}`}
                className="group card-frame bg-card flex min-w-0 items-center gap-3 px-3 py-2.5 transition-all duration-200 hover:bg-muted/30"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    (SUBJECT_COLORS as Record<string, string>)[subjectId] ??
                    'bg-muted text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground truncate">
                      {subject.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {topicCount} {copy.topics}
                      </span>
                      <span className="whitespace-nowrap">
                        {materialCount} {copy.materials}
                      </span>
                    </div>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            );
          })}
        </div>
      </main>
    </DashboardShell>
  );
}
