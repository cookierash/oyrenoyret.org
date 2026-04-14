/**
 * Guided Group Session Details Page
 *
 * Shows session information (date/time/objectives/etc) and actions like register/join.
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
import { GuidedGroupSessionDetailsClient } from '@/src/modules/guided-group-sessions/session-details-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuidedGroupSessionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionIdRaw } = await params;
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
  if (!sessionId) redirect('/my-library/guided-group-sessions');

  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const { locale, messages } = await getI18n();

  let session: any = null;
  let myEnrollment: { status: string } | null = null;

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
      },
    });

    myEnrollment = await prisma.guidedGroupSessionEnrollment.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { status: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    redirect('/my-library/guided-group-sessions');
  }

  if (!session) redirect('/my-library/guided-group-sessions');

  const isFacilitator = session.facilitatorId === userId;

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
  const approvedLearners = (Array.isArray(session.enrollments) ? session.enrollments : []).map((row: any) => {
    const u = row.user;
    const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || (u?.email ? u.email.split('@')[0] : '—');
    return { id: String(u?.id ?? ''), name };
  }).filter((l: any) => Boolean(l.id));

  return (
    <DashboardShell>
      <PageHeader
        title={session.title}
        description={`${topicName} · ${subjectName}`}
        actions={
          <Button size="sm" variant="secondary-primary" asChild>
            <Link href="/my-library/guided-group-sessions">Leave</Link>
          </Button>
        }
      />

      <main className="space-y-4 pt-2">
        <GuidedGroupSessionDetailsClient
          session={{
            id: session.id,
            title: session.title,
            objectives: session.objectives ?? null,
            scheduledAt: session.scheduledAt.toISOString(),
            durationMinutes: session.durationMinutes,
            learnerCapacity: session.learnerCapacity,
            status: session.status,
            facilitator: { id: session.facilitatorId, name: facilitatorName },
          }}
          curriculum={{ subjectName, topicName }}
          myEnrollmentStatus={myEnrollment?.status ?? null}
          isFacilitator={isFacilitator}
          approvedLearners={approvedLearners}
        />
      </main>
    </DashboardShell>
  );
}
