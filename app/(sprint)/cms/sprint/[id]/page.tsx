/**
 * Problem Sprint Workspace (CMS)
 *
 * Participant workspace for a confirmed problem sprint enrollment.
 * Route: /cms/sprint/[id]
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  PiCalendar as Calendar,
  PiClock as Clock,
  PiCoins as Coins,
  PiArrowLeft as ArrowLeft,
} from 'react-icons/pi';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { DifficultyBars } from '@/src/modules/materials/difficulty-bars';
import { isStaff } from '@/src/lib/permissions';
import { SprintCmsClient } from '@/src/modules/interactive-sessions/sprint-cms-client';
import { Button } from '@/components/ui/button';

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
    redirect('/interactive-sessions');
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
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Contest area
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Complete registration to enter
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This sprint requires a verified registration before you can access the contest room.
          </p>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/interactive-sessions" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to interactive sessions
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const allowPromptForClient = staff || Date.now() >= event.date.getTime();
  const allowProblemsForClient = allowPromptForClient;

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
  let submissions: Array<{
    id: string;
    answer: string;
    createdAt: Date;
    user: {
      id: string;
      publicId: string | null;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    answers?: Array<{
      id: string;
      problemId: string;
      type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
      textAnswer: string | null;
      selectedOptionId: string | null;
      selectedOption?: { id: string; text: string } | null;
      images?: Array<{ id: string; order: number; key: string }>;
    }>;
  }> = [];
  try {
    [mySubmission, submissions] = await Promise.all([
      prisma.liveEventSubmission.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { id: true, createdAt: true },
      }),
      staff
        ? prisma.liveEventSubmission.findMany({
            where: { liveEventId: event.id, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              answer: true,
              createdAt: true,
              answers: {
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  problemId: true,
                  type: true,
                  textAnswer: true,
                  selectedOptionId: true,
                  selectedOption: { select: { id: true, text: true } },
                  images: { orderBy: { order: 'asc' }, select: { id: true, order: true, key: true } },
                },
              },
              user: {
                select: {
                  id: true,
                  publicId: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    try {
      [mySubmission, submissions] = await Promise.all([
        prisma.liveEventSubmission.findUnique({
          where: { liveEventId_userId: { liveEventId: event.id, userId } },
          select: { id: true, createdAt: true },
        }),
        staff
          ? prisma.liveEventSubmission.findMany({
              where: { liveEventId: event.id, deletedAt: null },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                answer: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    publicId: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);
    } catch (fallbackError) {
      if (!isDbSchemaMismatch(fallbackError)) throw fallbackError;
      mySubmission = null;
      submissions = [];
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Contest area
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{event.topic}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Competition area for verified participants.
            </p>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/interactive-sessions" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to interactive sessions
            </Link>
          </Button>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <SprintCmsClient
            liveEventId={event.id}
            startsAt={event.date.toISOString()}
            durationMinutes={event.durationMinutes}
            initialPrompt={allowPromptForClient ? (event.prompt ?? null) : null}
            initialProblems={allowProblemsForClient ? problems : null}
            initialProblemsLocked={!allowProblemsForClient}
            initialMaxParticipants={event.maxParticipants ?? null}
            isStaff={staff}
            initialHasSubmitted={Boolean(mySubmission)}
            initialSubmittedAt={mySubmission?.createdAt ? mySubmission.createdAt.toISOString() : null}
            initialSubmissions={submissions.map((row) => ({
              ...row,
              createdAt: row.createdAt.toISOString(),
            }))}
          />

          <aside className="card-frame bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Event details</h3>
              <p className="text-xs text-muted-foreground">Key info for this sprint.</p>
            </div>

            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </span>
                <span className="text-foreground">
                  {eventDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time
                </span>
                <span className="text-foreground">
                  {eventDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duration
                </span>
                <span className="text-foreground">{event.durationMinutes} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Entry cost
                </span>
                <span className="text-foreground">{Math.round(event.creditCost)} credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">Difficulty</span>
                <DifficultyBars difficulty={event.difficulty} />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-3">
              <p className="text-xs font-medium text-foreground">Next steps</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stay on this page. When the organizer starts the sprint, the timer and
                problem statement will appear automatically.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
