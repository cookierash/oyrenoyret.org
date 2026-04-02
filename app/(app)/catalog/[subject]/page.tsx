/**
 * Subject Page
 *
 * Individual subject detail and topic listing.
 * Topics aligned with TIMSS, PISA, and common international curricula.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { SUBJECT_COLORS } from '@/src/config/subject-meta';
import { PiBookOpen as BookOpen, PiCaretRight as ChevronRight } from 'react-icons/pi';

interface SubjectPageProps {
  params: Promise<{ subject: string }>;
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { subject: subjectId } = await params;
  const subject = SUBJECTS.find((s) => s.id === subjectId);

  if (!subject) {
    notFound();
  }

  const topics = CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS];
  if (!topics || topics.length === 0) {
    notFound();
  }

  return (
    <DashboardShell>
      <PageHeader
        title={subject.name}
        description={subject.description}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href="/catalog">Back to catalog</Link>
          </Button>
        }
      />

      <main className="space-y-4 pt-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Topics aligned with TIMSS, PISA, and common international curricula across
          subjects.
        </p>
        <section>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/catalog/${subjectId}/${topic.id}`}
                  className="group card-frame bg-card flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 hover:bg-muted/30"
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${SUBJECT_COLORS[subject.id]}`}
                  >
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {topic.name}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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
