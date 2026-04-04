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
import { STREAK_OFFSET_HOURS, toDayNumber } from '@/src/lib/streak';
import { recordDailyVisit } from '@/src/modules/visits';
import { PiBookOpen as BookOpen, PiCheck as Check, PiCaretRight as ChevronRight, PiClock as Clock, PiVideoCamera as Video } from 'react-icons/pi';

function calcStreakStats(dayNumbers: number[]) {
  const daySet = new Set<number>(dayNumbers);

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
  const labels = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
  return Array.from({ length: 7 }).map((_, idx) => {
    const dayNumber = today - (6 - idx);
    const date = new Date(dayNumber * 24 * 60 * 60 * 1000);
    return {
      key: `${dayNumber}-${idx}`,
      label: labels[date.getUTCDay()],
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
  await recordDailyVisit(userId, now);

  // Fetch user info + upcoming activities + recent purchases in parallel
  const [user, upcomingActivities, recentPurchases, dailyVisits] = await Promise.all([
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
      take: 3,
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
    prisma.userDailyVisit.findMany({
      where: { userId },
      orderBy: { dayNumber: 'desc' },
      take: 365,
      select: { dayNumber: true },
    }),
  ]);

  if (user?.role === 'ADMIN' || user?.role === 'TEACHER') {
    redirect('/admin/dashboard');
  }

  const displayName = user?.firstName || 'there';
  const greeting = getGreeting();
  const streakStats = calcStreakStats(dailyVisits.map((entry) => entry.dayNumber));
  const streakMessage = streakStats.hasToday
    ? 'Keep it up!'
    : streakStats.hasYesterday
      ? 'Keep it alive today'
      : 'Start a streak today!';

  return (
    <DashboardShell>
      <main className="space-y-6">
        <section>
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-foreground">
                {greeting}, {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Here is your learning snapshot for today.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50 via-orange-50/70 to-rose-50 px-4 py-4 sm:px-6 sm:py-5 dark:border-white/10 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-rose-500/10">
              <div className="pointer-events-none absolute -top-12 right-6 h-32 w-32 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-400/20" />
              <div className="pointer-events-none absolute -bottom-12 left-6 h-32 w-32 rounded-full bg-rose-300/40 blur-3xl dark:bg-rose-400/20" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.7),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.55),transparent_70%)]" />

              <div className="relative grid gap-6 md:grid-cols-[1fr_3fr_1fr] md:items-center">
                <div className="flex items-center gap-4 md:flex-col md:items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Today
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold text-foreground">
                        {streakStats.current}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {streakStats.current === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{streakMessage}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3">
                    {streakStats.weekDays.map((day) => (
                      <div key={day.key} className="flex flex-col items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground/70">
                          {day.label}
                        </span>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border sm:h-11 sm:w-11 ${
                            day.isActive
                              ? 'border-amber-200/80 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30 ring-1 ring-white/40 dark:border-amber-200/50 dark:ring-white/20'
                              : 'border-border/60 bg-white/70 text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/60'
                          }`}
                        >
                          <Check className={`h-4 w-4 sm:h-5 sm:w-5 ${day.isActive ? '' : 'opacity-50'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:text-right">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Best streak
                    </p>
                    <div className="flex items-baseline gap-2 md:justify-end">
                      <span className="text-2xl font-semibold text-foreground">
                        {streakStats.best}
                      </span>
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentPurchases.map(({ material, createdAt }) => (
                <Link
                  key={material.id}
                  href={`/catalog/${material.subjectId}/${material.topicId}/${material.id}`}
                  className="group card-frame bg-card p-3 transition-all duration-200 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {material.title}
                    </h3>
                    <div className="shrink-0 flex items-center gap-1">
                      <span
                        className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          material.materialType === 'PRACTICE_TEST'
                            ? 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400'
                            : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'
                        }`}
                      >
                        {material.materialType === 'PRACTICE_TEST' ? 'Test' : 'Textual'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="capitalize">
                      {material.subjectId.replace(/-/g, ' ')}
                    </span>
                    {material.difficulty && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          material.difficulty === 'ADVANCED'
                            ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                            : material.difficulty === 'INTERMEDIATE'
                              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                              : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                        }`}
                      >
                        {material.difficulty.charAt(0) + material.difficulty.slice(1).toLowerCase()}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground/60 mt-auto">
                    Purchased{' '}
                    {new Date(createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
