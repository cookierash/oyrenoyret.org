/**
 * Dashboard Page
 *
 * Compact, friendly student dashboard with:
 * - Greeting and daily focus
 * - Micro progress tiles
 * - Upcoming live activities
 * - Recent materials
 * - Quick actions
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { DifficultyBars } from '@/src/modules/materials/difficulty-bars';
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Video,
} from 'lucide-react';

const STREAK_OFFSET_HOURS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDayNumber(date: Date) {
  return Math.floor((date.getTime() + STREAK_OFFSET_HOURS * 60 * 60 * 1000) / DAY_MS);
}

function formatDayCount(count: number) {
  return `${count} day${count === 1 ? '' : 's'}`;
}

function calcStreakStats(dates: Date[]) {
  const daySet = new Set<number>();
  for (const date of dates) {
    daySet.add(toDayNumber(date));
  }

  const today = toDayNumber(new Date());
  const hasToday = daySet.has(today);
  const hasYesterday = daySet.has(today - 1);

  if (daySet.size === 0) {
    return {
      current: 0,
      best: 0,
      weekCount: 0,
      weekDays: buildWeekDays(daySet, today),
      hasToday,
      hasYesterday,
    };
  }

  let cursor: number | null = null;
  if (hasToday) {
    cursor = today;
  } else if (hasYesterday) {
    cursor = today - 1;
  }

  let current = 0;
  if (cursor !== null) {
    while (daySet.has(cursor)) {
      current += 1;
      cursor -= 1;
    }
  }

  const daysAsc = Array.from(daySet).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of daysAsc) {
    if (prev !== null && day === prev + 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = day;
  }

  const weekCount = daysAsc.filter((day) => day >= today - 6).length;

  return {
    current,
    best,
    weekCount,
    weekDays: buildWeekDays(daySet, today),
    hasToday,
    hasYesterday,
  };
}

function buildWeekDays(daySet: Set<number>, today: number) {
  return Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const dayNumber = toDayNumber(date);
    return {
      key: `${dayNumber}-${idx}`,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      isActive: daySet.has(dayNumber),
      isToday: dayNumber === today,
    };
  });
}

function getGreeting() {
  const hour = new Date().getUTCHours() + STREAK_OFFSET_HOURS; // UTC+4 (user's timezone)
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const now = new Date();

  // Fetch user info + upcoming activities + recent purchases in parallel
  const [user, upcomingActivities, recentPurchases, streakActivity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    }),
    prisma.activity.findMany({
      where: {
        userId,
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: 4,
    }),
    prisma.materialAccess.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        material: {
          select: {
            id: true,
            title: true,
            subjectId: true,
            topicId: true,
            materialType: true,
            difficulty: true,
          },
        },
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 365,
      select: { createdAt: true },
    }),
  ]);

  if (user?.role === 'ADMIN' || user?.role === 'TEACHER') {
    redirect('/admin/dashboard');
  }

  const displayName = user?.firstName || 'there';
  const greeting = getGreeting();
  const streakStats = calcStreakStats(streakActivity.map((entry) => entry.createdAt));

  return (
    <DashboardShell>
      <main className="space-y-6">
        <section className="card-frame bg-card p-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">
                {greeting}, {displayName}
              </h1>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/90 text-white shadow-sm">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDayCount(streakStats.current)} streak
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {streakStats.hasToday
                        ? 'Streak updated today'
                        : streakStats.hasYesterday
                          ? 'Last chance!'
                          : 'Start a streak today'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {streakStats.weekDays.map((day) => (
                    <div key={day.key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {day.label}
                      </span>
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] ${
                          day.isActive
                            ? 'border-amber-300 bg-amber-400 text-white'
                            : 'border-border/60 bg-muted/40 text-muted-foreground'
                        } ${day.isToday ? 'ring-2 ring-amber-300/60' : ''}`}
                      >
                        {day.isActive ? <Check className="h-3.5 w-3.5" /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden items-end sm:flex" aria-hidden="true">
                <div className="relative h-16 w-16 rounded-2xl bg-emerald-400/90">
                  <div className="absolute left-3.5 top-4 h-4 w-4 rounded-full bg-white" />
                  <div className="absolute right-3.5 top-4 h-4 w-4 rounded-full bg-white" />
                  <div className="absolute left-[18px] top-5.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />
                  <div className="absolute right-[18px] top-5.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />
                  <div className="absolute bottom-3.5 left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-full bg-emerald-300" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Upcoming live activities</h2>
            </div>
            <Link
              href="/live-activities"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingActivities.length === 0 ? (
            <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
              <Video className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">No live activities yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                New sessions will appear here once scheduled.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingActivities.map((activity) => {
                const activityDate = new Date(activity.date);
                return (
                  <div
                    key={activity.id}
                    className="card-frame border-dashed bg-muted/20 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-muted/60 text-center">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {activityDate.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-lg font-semibold text-foreground">
                          {activityDate.toLocaleDateString('en-US', { day: '2-digit' })}
                        </span>
                      </div>
                      <div className="min-w-[200px] flex-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {activity.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            <Video className="h-3 w-3" />
                            {activity.type.replace(/_/g, ' ')}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            <Clock className="h-3 w-3" />
                            {activityDate.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {activity.duration && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              <Clock className="h-3 w-3" />
                              {activity.duration} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Recently purchased materials</h2>
            </div>
            <Link
              href="/library"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              All materials
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">No materials yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Browse the{' '}
                <Link href="/catalog" className="text-foreground underline underline-offset-2">
                  catalog
                </Link>{' '}
                to find your first one.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentPurchases.map(({ material, createdAt }) => (
                <Link
                  key={material.id}
                  href={`/catalog/${material.subjectId}/${material.topicId}/${material.id}`}
                  className="card-frame border-dashed bg-muted/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="capitalize">{material.subjectId.replace(/-/g, ' ')}</span>
                    <span>
                      {new Date(createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground line-clamp-2">
                    {material.title}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                      {material.materialType === 'PRACTICE_TEST' ? 'Practice test' : 'Text lesson'}
                    </span>
                    <DifficultyBars difficulty={material.difficulty} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
