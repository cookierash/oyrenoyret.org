/**
 * Problem Sprint Workspace (CMS)
 *
 * Participant workspace for a confirmed problem sprint enrollment.
 * Route: /cms/sprint/[id]
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PiArrowLeft as ArrowLeft } from 'react-icons/pi';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { SprintCmsClient } from '@/src/modules/events/sprint-cms-client';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/src/i18n/server';

export default async function SprintWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentSession();
  if (!userId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const staff = Boolean(user?.role && isStaff(user.role));

  let event:
    | {
        id: string;
        topic: string;
        date: Date;
        durationMinutes: number;
        difficulty: any;
        creditCost: number;
        type: string;
        maxParticipants: number | null;
        prompt: string | null;
      }
    | null = null;
  try {
    event = await prisma.liveEvent.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        topic: true,
        date: true,
        durationMinutes: true,
        difficulty: true,
        creditCost: true,
        type: true,
        maxParticipants: true,
        prompt: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    try {
      event = await prisma.liveEvent.findFirst({
        where: { id },
        select: {
          id: true,
          topic: true,
          date: true,
          durationMinutes: true,
          difficulty: true,
          creditCost: true,
          type: true,
        },
      }) as any;
      if (event) {
        (event as any).maxParticipants = null;
        (event as any).prompt = null;
      }
    } catch {
      event = null;
    }
  }

  if (!event || event.type !== 'PROBLEM_SPRINT') {
    redirect('/events');
  }

  let enrollment: { status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' } | null = null;
  if (staff) {
    enrollment = { status: 'CONFIRMED' };
  } else {
    try {
      enrollment = await prisma.liveEventEnrollment.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { status: true },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      enrollment = null;
    }
  }

  if (!enrollment || enrollment.status !== 'CONFIRMED') {
    const { messages } = await getI18n();
    const copy = messages.liveActivities.cms;
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            {copy.workspaceBadge}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {copy.workspaceGateTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.workspaceGateDescription}
          </p>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/events" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {copy.workspaceBack}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { messages } = await getI18n();
  const copy = messages.liveActivities.cms;

  const allowPromptForClient = staff || Date.now() >= event.date.getTime();
  const allowProblemsForClient = allowPromptForClient;
  const difficulty =
    event.difficulty === 'BASIC' || event.difficulty === 'INTERMEDIATE' || event.difficulty === 'ADVANCED'
      ? (event.difficulty as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')
      : null;

  let problems: Array<{
    id: string;
    order: number;
    type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
    prompt: string;
    options: Array<{ id: string; order: number; text: string; isCorrect?: boolean }>;
  }> = [];
  try {
    problems = await prisma.liveEventProblem.findMany({
      where: { liveEventId: event.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        type: true,
        prompt: true,
        options: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            text: true,
            ...(staff ? { isCorrect: true } : {}),
          },
        },
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    problems = [];
  }

  let mySubmission: { id: string; createdAt: Date } | null = null;
  try {
    mySubmission = await prisma.liveEventSubmission.findUnique({
      where: { liveEventId_userId: { liveEventId: event.id, userId } },
      select: { id: true, createdAt: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    try {
      mySubmission = await prisma.liveEventSubmission.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { id: true, createdAt: true },
      });
    } catch (fallbackError) {
      if (!isDbSchemaMismatch(fallbackError)) throw fallbackError;
      mySubmission = null;
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              {copy.workspaceBadge}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{event.topic}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.workspaceDescription}
            </p>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/events" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {copy.workspaceBack}
            </Link>
          </Button>
        </header>

        <div className="mt-5">
          <SprintCmsClient
            liveEventId={event.id}
            initialTopic={event.topic}
            startsAt={event.date.toISOString()}
            durationMinutes={event.durationMinutes}
            initialDifficulty={difficulty}
            initialPrompt={allowPromptForClient ? (event.prompt ?? null) : null}
            initialProblems={allowProblemsForClient ? problems : null}
            initialProblemsLocked={!allowProblemsForClient}
            isStaff={staff}
            initialHasSubmitted={Boolean(mySubmission)}
            initialSubmittedAt={mySubmission?.createdAt ? mySubmission.createdAt.toISOString() : null}
          />
        </div>
      </div>
    </div>
  );
}
