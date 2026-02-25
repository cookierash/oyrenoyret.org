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
import { Card, CardContent } from '@/components/ui/card';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { BookOpen } from 'lucide-react';

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

      <main className="space-y-6">
        <section>
          <p className="text-xs text-muted-foreground mb-4">
            Topics aligned with TIMSS, PISA, and common international curricula across subjects.
          </p>

          <Card>
            <CardContent className="pt-4">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      href={`/catalog/${subjectId}/${topic.id}`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{topic.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
    </DashboardShell>
  );
}

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject: subject.id }));
}
