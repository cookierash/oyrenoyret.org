/**
 * Guided Group Session Room / Archive Page
 *
 * Accessible to the facilitator + approved learners.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/src/i18n/server';
import { resolveCurriculumNames } from '@/src/modules/curriculum/resolve-curriculum-names';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { GuidedGroupSessionRoomClient } from '@/src/modules/guided-group-sessions/session-room-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuidedGroupSessionRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionIdRaw } = await params;
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
  if (!sessionId) redirect('/library/guided-group-sessions');

  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const { locale, messages } = await getI18n();

  let session: any = null;
  let myEnrollment: { status: string } | null = null;
  let myFacilitatorFeedback: { rating: number; comment: string | null } | null = null;
  let learnerFeedback: Array<{ learnerId: string; sentiment: 'GOOD' | 'BAD'; note: string | null }> = [];

  try {
    session = await prisma.guidedGroupSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: {
        id: true,
        title: true,
        subjectId: true,
        topicId: true,
        objectives: true,
        scheduledAt: true,
        durationMinutes: true,
        learnerCapacity: true,
        status: true,
        ratingAvg: true,
        ratingCount: true,
        activeMaterialId: true,
        whiteboardData: true,
        facilitatorId: true,
        facilitator: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarVariant: true },
        },
        enrollments: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'asc' },
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatarVariant: true },
            },
          },
        },
        facilitatorFeedback: {
          where: { learnerId: userId },
          select: { rating: true, comment: true },
          take: 1,
        },
      },
    });

    myEnrollment = await prisma.guidedGroupSessionEnrollment.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { status: true },
    });

    if (session?.facilitatorId === userId) {
      learnerFeedback = await prisma.guidedGroupSessionLearnerFeedback.findMany({
        where: { sessionId: session.id, facilitatorId: userId },
        select: { learnerId: true, sentiment: true, note: true },
      });
    }

    const feedbackRow = Array.isArray(session?.facilitatorFeedback) ? session.facilitatorFeedback[0] : null;
    myFacilitatorFeedback = feedbackRow ? { rating: feedbackRow.rating, comment: feedbackRow.comment ?? null } : null;
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    redirect('/library/guided-group-sessions');
  }

  if (!session) redirect('/library/guided-group-sessions');

  const isFacilitator = session.facilitatorId === userId;
  const isApprovedLearner = myEnrollment?.status === 'APPROVED';
  if (!isFacilitator && !isApprovedLearner) {
    redirect('/library/guided-group-sessions');
  }

  const curriculum = await resolveCurriculumNames({
    messages,
    locale,
    subjectId: session.subjectId,
    topicId: session.topicId,
  });
  const subjectName = curriculum?.subjectName ?? session.subjectId;
  const topicName = curriculum?.topicName ?? session.topicId;

  const facilitatorName =
    [session.facilitator?.firstName, session.facilitator?.lastName].filter(Boolean).join(' ') ||
    (session.facilitator?.email ? session.facilitator.email.split('@')[0] : '');

  const activeMaterial = session.activeMaterialId
    ? await prisma.material.findFirst({
        where: { id: session.activeMaterialId, userId: session.facilitatorId, deletedAt: null },
        select: {
          id: true,
          title: true,
          objectives: true,
          content: true,
          materialType: true,
          subjectId: true,
          topicId: true,
          difficulty: true,
        },
      })
    : null;

  const learnerFeedbackMap = learnerFeedback.reduce<Record<string, any>>((acc, row) => {
    acc[row.learnerId] = { sentiment: row.sentiment, note: row.note ?? null };
    return acc;
  }, {});

  return (
    <DashboardShell>
      <PageHeader
        title={session.title}
        description={`${topicName} · ${subjectName}`}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href="/library/guided-group-sessions">Leave</Link>
          </Button>
        }
      />

      <main className="space-y-4 pt-2">
        <GuidedGroupSessionRoomClient
          session={{
            id: session.id,
            title: session.title,
            subjectId: session.subjectId,
            topicId: session.topicId,
            objectives: session.objectives ?? null,
            scheduledAt: session.scheduledAt.toISOString(),
            durationMinutes: session.durationMinutes,
            learnerCapacity: session.learnerCapacity,
            status: session.status,
            ratingAvg: session.ratingAvg ?? 0,
            ratingCount: session.ratingCount ?? 0,
            facilitator: {
              id: session.facilitatorId,
              name: facilitatorName,
              avatarVariant: session.facilitator?.avatarVariant ?? null,
            },
            learners: Array.isArray(session.enrollments) ? session.enrollments : [],
          }}
          isFacilitator={isFacilitator}
          myEnrollmentStatus={myEnrollment?.status ?? null}
          initialActiveMaterial={activeMaterial}
          initialWhiteboardData={session.whiteboardData}
          initialMyFacilitatorFeedback={myFacilitatorFeedback}
          initialLearnerFeedback={learnerFeedbackMap}
        />
      </main>
    </DashboardShell>
  );
}

