/**
 * Problem Sprint Workspace
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, Clock, Coins, ArrowLeft } from 'lucide-react';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { DifficultyBars } from '@/src/modules/materials/difficulty-bars';

export default async function SprintWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const userId = await getCurrentSession();
  if (!userId) {
    redirect('/login');
  }

  const event = await prisma.liveEvent.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      topic: true,
      date: true,
      durationMinutes: true,
      difficulty: true,
      creditCost: true,
      type: true,
    },
  });

  if (!event) {
    redirect('/live-activities');
  }

  const enrollment = await prisma.liveEventEnrollment.findUnique({
    where: { liveEventId_userId: { liveEventId: event.id, userId } },
    select: { status: true },
  });

  if (!enrollment || enrollment.status !== 'CONFIRMED') {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Problem sprint workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Complete registration to enter
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This sprint requires a verified registration before you can access the contest room.
          </p>
          <Link
            href="/live-activities"
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to live activities
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Problem sprint CMS
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{event.topic}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Competition workspace for verified participants.
            </p>
          </div>
          <Link
            href="/live-activities"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to live activities
          </Link>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="card-frame bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Sprint arena</h2>
              <span className="text-xs text-emerald-600">Verified</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This is the contest management workspace. The problem statement, timer, and
              submission queue will appear here once the sprint starts.
            </p>
            <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Awaiting problem release...</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Organizers can paste the challenge prompt and start the timer.
              </p>
            </div>
          </section>

          <aside className="card-frame bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Event details</h3>
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
                <span className="text-foreground">{event.creditCost.toFixed(1)} credits</span>
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
