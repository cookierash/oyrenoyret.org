/**
 * Material Detail Page
 *
 * Full view of a material. Unlock with credits to view content.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { prisma } from '@/src/db/client';
import { MaterialDetailView } from '@/src/modules/materials/material-detail-view';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, calcMaterialUnlockCost, roundCredits } from '@/src/modules/credits';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';

interface MaterialPageProps {
  params: Promise<{ subject: string; topic: string; material: string }>;
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { subject: subjectId, topic: topicId, material: materialId } = await params;
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  if (!subject) notFound();

  const topics = CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS];
  const topic = topics?.find((t) => t.id === topicId);
  if (!topic) notFound();

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      subjectId,
      topicId,
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
        questionCount: true,
        difficulty: true,
        publishedAt: true,
        user: {
          select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!material) notFound();

  const userId = await getCurrentSession();
  const [unlocked, balance, unlockCount] = await Promise.all([
    userId
      ? prisma.materialAccess.findUnique({
        where: { userId_materialId: { userId, materialId } },
        select: { materialId: true },
      })
      : null,
    userId ? getBalance(userId) : 0,
    prisma.materialAccess.count({ where: { materialId } }),
  ]);

  let questionCount =
    material.materialType === 'PRACTICE_TEST' ? material.questionCount : 0;
  if (material.materialType === 'PRACTICE_TEST' && questionCount === 0) {
    questionCount = getPracticeTestQuestionCount(material.content);
  }
  const wordCount =
    material.materialType === 'TEXTUAL' ? getTextWordCount(material.content) : 0;
  const estimatedCost = roundCredits(
    calcMaterialUnlockCost({
      materialType: material.materialType,
      questionCount,
      wordCount,
    })
  );
  const isOwn = userId !== null && material.userId === userId;
  const hasAccess = Boolean(unlocked) || isOwn;
  const authorName =
    [material.user.firstName, material.user.lastName].filter(Boolean).join(' ') || 'Student';

  return (
    <DashboardShell>
      <PageHeader
        title={material.title}
        description={`${topic.name} · ${subject.name}`}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href={hasAccess ? '/library' : '/catalog'}>
              {hasAccess ? 'Back to library' : 'Back to catalog'}
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
          isUnlocked={!!unlocked || isOwn}
          isOwn={isOwn}
          difficulty={material.difficulty}
          estimatedCost={estimatedCost}
          balance={balance}
          unlockCount={unlockCount}
        />
      </main>
    </DashboardShell>
  );
}
