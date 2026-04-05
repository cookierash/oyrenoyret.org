/**
 * Catalog Page
 *
 * Catalog of all subjects available for learning.
 */

import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { SUBJECT_ICONS, SUBJECT_COLORS } from '@/src/config/subject-meta';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { PiCaretRight as ChevronRight } from 'react-icons/pi';
import { CatalogSearch } from '@/src/modules/materials/catalog-search';
import { prisma } from '@/src/db/client';
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';
import type { SubjectId } from '@/src/config/curriculum';

export default async function CatalogPage() {
  const { messages } = await getI18n();
  const copy = messages.app.catalog;
  const subjects = getLocalizedSubjects(messages);
  const subjectCounts = await prisma.material.groupBy({
    by: ['subjectId'],
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
    },
    _count: { _all: true },
  });

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
            const subjectId = subject.id as SubjectId;
            const Icon = SUBJECT_ICONS[subjectId];
            const topicCount = CURRICULUM_TOPICS[subjectId]?.length ?? 0;
            const materialCount = subjectCountMap.get(subjectId) ?? 0;
            return (
              <Link
                key={subjectId}
                href={`/catalog/${subjectId}`}
                className="group card-frame bg-card flex items-center gap-3 px-3 py-2.5 transition-all duration-200 hover:bg-muted/30"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${SUBJECT_COLORS[subjectId]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {subject.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {topicCount} {copy.topics}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {materialCount} {copy.materials}
                    </span>
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
