/**
 * Catalog Page
 *
 * Catalog of all subjects available for learning.
 */

import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { SUBJECTS } from '@/src/config/constants';
import { SUBJECT_ICONS, SUBJECT_COLORS } from '@/src/config/subject-meta';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { ChevronRight } from 'lucide-react';

export default function CatalogPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Subject catalog"
        description="Browse all subjects and topics. Pick what you want to learn next."
      />

      <main className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((subject) => {
            const Icon = SUBJECT_ICONS[subject.id];
            const topicCount = CURRICULUM_TOPICS[subject.id]?.length ?? 0;
            return (
              <Link
                key={subject.id}
                href={`/catalog/${subject.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all duration-200 hover:bg-muted/30 hover:shadow-sm"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${SUBJECT_COLORS[subject.id]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {subject.name}
                    </span>
                    {topicCount > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {topicCount} topics
                      </span>
                    )}
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
