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
import { Card, CardContent } from '@/components/ui/card';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { prisma } from '@/src/db/client';
import { TopicMaterialsSection, type TopicMaterialWithCost } from '@/src/modules/materials/topic-materials-section';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, calcMaterialUnlockCost, roundCredits } from '@/src/modules/credits';

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

  const userId = await getCurrentSession();
  const materials = await prisma.material.findMany({
    where: {
      subjectId,
      topicId,
      status: 'PUBLISHED',
      deletedAt: null,
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      title: true,
      content: true,
      materialType: true,
      alignmentScore: true,
      difficulty: true,
      publishedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: { accesses: true },
      },
    },
  });

  const materialIds = materials.map((m) => m.id);
  const [unlockedForUser, balance] = await Promise.all([
    userId && materialIds.length > 0
      ? prisma.materialAccess.findMany({
          where: { userId, materialId: { in: materialIds } },
          select: { materialId: true },
        })
      : Promise.resolve([]),
    userId ? getBalance(userId) : Promise.resolve(0),
  ]);
  const unlockedIds = new Set(unlockedForUser.map((a) => a.materialId));

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

      <main className="space-y-4">
        <section>
          <h2 className="text-base font-semibold mb-2">Materials from students</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Learning materials created and shared by students in Oyrenoyret Studio. Unlock with credits to view.
          </p>

          {materials.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-2">
                  No materials shared yet for this topic.
                </p>
                <Button variant="primary" size="sm" asChild>
                  <Link href="/studio">Be the first to create one</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <TopicMaterialsSection
              materials={materials.map(({ content, ...m }) => {
                let questionCount = 0;
                if (m.materialType === 'PRACTICE_TEST' && content) {
                  try {
                    const parsed = JSON.parse(content) as { questions?: unknown[] };
                    questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
                  } catch {
                    /* ignore */
                  }
                }
                return {
                  ...m,
                  estimatedCost: roundCredits(
                    calcMaterialUnlockCost({
                      alignmentScore: m.alignmentScore ?? 0.75,
                      materialType: m.materialType,
                      questionCount,
                    })
                  ),
                };
              }) as unknown as TopicMaterialWithCost[]}
              subjectId={subjectId}
              topicId={topicId}
              userId={userId}
              unlockedIds={Array.from(unlockedIds)}
              balance={balance}
            />
          )}
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
