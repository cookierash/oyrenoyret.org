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
import { prisma } from '@/src/db/client';
import { MaterialDetailView } from '@/src/modules/materials/material-detail-view';
import { MaterialCommentsSection } from '@/src/modules/materials/material-comments-section';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { getBalance, calcMaterialUnlockCost, roundCredits } from '@/src/modules/credits';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';
import { getI18n } from '@/src/i18n/server';
import { getLocalizedSubject } from '@/src/i18n/subject-utils';
import { getLocalizedTopicName } from '@/src/i18n/topic-utils';
import { ReportButton } from '@/src/modules/reports/report-user-button';
import { AdminRemoveContentButton } from '@/src/modules/moderation/admin-remove-content-button';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

interface MaterialPageProps {
  params: Promise<{ subject: string; topic: string; material: string }>;
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { subject: subjectId, topic: topicId, material: materialId } = await params;
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { messages } = await getI18n();
  const catalogCopy = messages.app.catalog;
  const libraryCopy = messages.app.library;
  const authorFallback = messages.materials.authorFallback;
  if (!subject) notFound();

  const localizedSubject = getLocalizedSubject(messages, subject.id) ?? subject;
  const topicName = getLocalizedTopicName(messages, subject.id, topicId);
  if (!topicName) notFound();

  const userId = await getCurrentSession();
  const viewer = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    : null;
  const viewerIsAdmin = viewer?.role === 'ADMIN';

  let material: any = null;
  try {
    material = await prisma.material.findFirst({
      where: {
        id: materialId,
        subjectId,
        topicId,
        status: 'PUBLISHED',
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
        ratingAvg: true,
        ratingCount: true,
        deletedAt: true,
        removedAt: true,
        removedReason: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    // Safe rollout fallback: DB may not have moderation columns yet.
    material = await prisma.material.findFirst({
      where: {
        id: materialId,
        subjectId,
        topicId,
        status: 'PUBLISHED',
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
        ratingAvg: true,
        ratingCount: true,
        deletedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (material) {
      material = { ...material, removedAt: null, removedReason: null };
    }
  }

  if (!material) notFound();

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
  const canSeeRemoved = viewerIsAdmin || isOwn;
  const hasAccess = Boolean(unlocked) || isOwn;
  if (material.removedAt && !canSeeRemoved) notFound();
  if (material.deletedAt && !hasAccess) notFound();
  const authorName =
    [material.user.firstName, material.user.lastName].filter(Boolean).join(' ') || authorFallback;

  return (
    <DashboardShell>
      <PageHeader
        title={material.title}
        description={`${topicName} · ${localizedSubject.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href={hasAccess ? '/library' : '/catalog'}>
                {hasAccess ? libraryCopy.backToLibrary : catalogCopy.backToCatalog}
              </Link>
            </Button>
            <ReportButton
              reportedUserId={material.userId}
              reportedUserPublicId={null}
              reportedUserName={authorName}
              targetType="MATERIAL"
              targetId={material.id}
              buttonVariant="danger"
            />
            {viewerIsAdmin ? (
              <AdminRemoveContentButton targetType="MATERIAL" targetId={material.id} />
            ) : null}
          </div>
        }
      />

      <main className="space-y-4 pt-2">
        {material.removedAt ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
            <div className="font-medium">Removed by moderators</div>
            {material.removedReason ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Message from the moderators: {material.removedReason}
              </div>
            ) : null}
          </div>
        ) : null}
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
          ratingAvg={material.ratingAvg}
          ratingCount={material.ratingCount}
        />
        <MaterialCommentsSection
          materialId={material.id}
          initialRatingAvg={material.ratingAvg}
          initialRatingCount={material.ratingCount}
          initialCanComment={!material.removedAt}
          initialCanReview={hasAccess && !material.removedAt}
        />
      </main>
    </DashboardShell>
  );
}
