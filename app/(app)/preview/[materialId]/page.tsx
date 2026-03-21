/**
 * Material Preview Page
 *
 * Preview-only view for materials before unlocking.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { prisma } from '@/src/db/client';
import { MaterialDetailView } from '@/src/modules/materials/material-detail-view';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, calcMaterialUnlockCost, roundCredits } from '@/src/modules/credits';

interface PreviewPageProps {
  params: Promise<{ materialId: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { materialId } = await params;

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      status: 'PUBLISHED',
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      title: true,
      objectives: true,
      content: true,
      materialType: true,
      difficulty: true,
      publishedAt: true,
      subjectId: true,
      topicId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!material) notFound();

  const subject = SUBJECTS.find((s) => s.id === material.subjectId);
  if (!subject) notFound();

  const topics = CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS];
  const topic = topics?.find((t) => t.id === material.topicId);
  if (!topic) notFound();

  const userId = await getCurrentSession();
  const isOwn = userId !== null && material.userId === userId;
  const unlocked = userId
    ? await prisma.materialAccess.findUnique({
      where: { userId_materialId: { userId, materialId } },
      select: { materialId: true },
    })
    : null;

  if (unlocked && !isOwn) {
    redirect(`/catalog/${material.subjectId}/${material.topicId}/${material.id}`);
  }

  const [balance, unlockCount] = await Promise.all([
    userId ? getBalance(userId) : 0,
    prisma.materialAccess.count({ where: { materialId } }),
  ]);

  let questionCount = 0;
  if (material.materialType === 'PRACTICE_TEST' && material.content) {
    try {
      const parsed = JSON.parse(material.content) as { questions?: unknown[] };
      questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
    } catch {
      /* ignore */
    }
  }

  const estimatedCost = roundCredits(
    calcMaterialUnlockCost({
      materialType: material.materialType,
      questionCount,
    }),
  );

  const authorName =
    [material.user.firstName, material.user.lastName].filter(Boolean).join(' ') || 'Student';

  return (
    <DashboardShell>
      <PageHeader
        title={material.title}
        description={`${topic.name} · ${subject.name}`}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href="/library">
              Back to library
            </Link>
          </Button>
        }
      />

      <main className="space-y-4 pt-2">
        <MaterialDetailView
          id={material.id}
          title={material.title}
          objectives={material.objectives}
          content={material.content}
          materialType={material.materialType}
          authorName={authorName}
          publishedAt={material.publishedAt}
          isUnlocked={false}
          isOwn={false}
          isPreview
          difficulty={material.difficulty}
          estimatedCost={estimatedCost}
          balance={balance}
          unlockCount={unlockCount}
        />
      </main>
    </DashboardShell>
  );
}
