/**
 * Dashboard Page
 *
 * Compact, friendly student dashboard with:
 * - Greeting and daily focus
 * - Micro progress tiles
 * - Upcoming events
 * - Recent materials
 * - Quick actions
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { STREAK_OFFSET_HOURS, toDayNumber } from '@/src/lib/streak';
import { recordDailyVisit } from '@/src/modules/visits';
import { PiBookOpen as BookOpen, PiCheck as Check, PiCaretRight as ChevronRight, PiClock as Clock, PiMegaphone as Megaphone, PiUsersThree as Users, PiVideoCamera as Video } from 'react-icons/pi';
import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { getI18n } from '@/src/i18n/server';
import { getLocaleCode } from '@/src/i18n';
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';
import { getAnnouncementImageSrc } from '@/src/lib/announcement-images';

type LiveAnnouncement = { id: string; title: string; body: string; createdAt: Date; imageUrl?: string | null };

async function getLatestLiveAnnouncements(take: number): Promise<LiveAnnouncement[]> {
  const safeTake = Number.isFinite(take) ? Math.min(Math.max(take, 1), 20) : 3;
  try {
    return await prisma.liveAnnouncement.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
      select: { id: true, title: true, body: true, imageUrl: true, createdAt: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    try {
      return await prisma.liveAnnouncement.findMany({
        orderBy: { createdAt: 'desc' },
        take: safeTake,
        select: { id: true, title: true, body: true, createdAt: true },
      });
    } catch {
      return [];
    }
  }
}

function calcStreakStats(dayNumbers: number[], labels: readonly string[]) {
  const daySet = new Set<number>(dayNumbers);

  const today = toDayNumber(new Date());
  const hasToday = daySet.has(today);
  const hasYesterday = daySet.has(today - 1);

  if (daySet.size === 0) {
    return {
      current: 0,
      best: 0,
      weekCount: 0,
      weekDays: buildWeekDays(daySet, today, labels),
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
    weekDays: buildWeekDays(daySet, today, labels),
    hasToday,
    hasYesterday,
  };
}

function buildWeekDays(daySet: Set<number>, today: number, labels: readonly string[]) {
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

function getGreeting(copy: { morning: string; afternoon: string; evening: string }) {
  const hour = new Date().getUTCHours() + STREAK_OFFSET_HOURS; // UTC+4 (user's timezone)
  if (hour < 12) return copy.morning;
  if (hour < 17) return copy.afternoon;
  return copy.evening;
}

function StreakMetric({
  title,
  value,
  unit,
  message,
  align = 'left',
}: {
  title: string;
  value: number;
  unit: string;
  message?: string;
  align?: 'left' | 'right';
}) {
  const isRight = align === 'right';
  return (
    <div className={`space-y-1 ${isRight ? 'text-right' : ''}`}>
      <p className="text-[10px] font-medium uppercase text-muted-foreground">
        {title}
      </p>
      <div className={`flex items-baseline gap-2 ${isRight ? 'justify-end' : ''}`}>
        <span className="text-2xl font-medium text-foreground sm:text-3xl">
          {value}
        </span>
        <span className="text-xs text-muted-foreground sm:text-sm">{unit}</span>
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');
  const { timeFormat } = await getSettingsPreferences();
  const { locale, messages, t } = await getI18n();
  const copy = messages.app.dashboard;
  let dbSubjects: Array<{ slug: string; nameEn: string; nameAz: string }> = [];
  let subjectHrefMap = new Map<string, string>();
  let topicHrefMap = new Map<string, string>();
  try {
    dbSubjects = await prisma.subject.findMany({
      where: { deletedAt: null },
      select: { slug: true, nameEn: true, nameAz: true },
      orderBy: { slug: 'asc' },
    });
    const slugRows = await prisma.subject.findMany({
      where: { deletedAt: null },
      select: {
        slug: true,
        slugAz: true,
        topics: { where: { deletedAt: null }, select: { slug: true, slugAz: true } },
      },
    });
    subjectHrefMap = new Map(
      slugRows.map((s) => [s.slug, locale === 'az' ? s.slugAz : s.slug]),
    );
    const topicPairs: Array<[string, string]> = [];
    slugRows.forEach((s) => {
      (s.topics ?? []).forEach((topic) => {
        topicPairs.push([
          `${s.slug}:${topic.slug}`,
          locale === 'az' ? topic.slugAz : topic.slug,
        ]);
      });
    });
    topicHrefMap = new Map(topicPairs);
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    dbSubjects = [];
    subjectHrefMap = new Map();
    topicHrefMap = new Map();
  }
  const subjectNameMap = new Map(
    (dbSubjects.length
      ? dbSubjects.map((subject) => [
          subject.slug,
          locale === 'az' ? subject.nameAz : subject.nameEn,
        ])
      : getLocalizedSubjects(messages).map((subject) => [subject.id, subject.name])) as Array<
      [string, string]
    >,
  );
  const difficultyCopy = messages.materials.difficulty;

  const now = new Date();
  await recordDailyVisit(userId, now);

  // Fetch user info + upcoming activities + recent purchases in parallel
  const [user, upcomingActivities, upcomingGuidedSessions, recentPurchases, dailyVisits, liveAnnouncements] = await Promise.all([
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
    (async () => {
      try {
        const recentWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const rows = await prisma.guidedGroupSession.findMany({
          where: {
            deletedAt: null,
            status: { in: ['SCHEDULED', 'LIVE'] },
            scheduledAt: { gte: recentWindowStart },
            OR: [
              { facilitatorId: userId },
              { enrollments: { some: { userId, status: 'APPROVED' } } },
            ],
          },
          orderBy: { scheduledAt: 'asc' },
          take: 3,
          select: {
            id: true,
            title: true,
            subjectId: true,
            topicId: true,
            scheduledAt: true,
            durationMinutes: true,
            facilitatorId: true,
            facilitator: { select: { firstName: true, lastName: true, email: true } },
          },
        });

        const nowMs = now.getTime();
        return rows
          .map((s) => {
            const startMs = s.scheduledAt.getTime();
            const endMs = startMs + s.durationMinutes * 60_000;
            if (nowMs >= endMs) return null;
            const facilitatorName =
              [s.facilitator?.firstName, s.facilitator?.lastName].filter(Boolean).join(' ') ||
              (s.facilitator?.email ? s.facilitator.email.split('@')[0] : '');
            return {
              id: s.id,
              title: s.title,
              subjectId: s.subjectId,
              topicId: s.topicId,
              scheduledAt: s.scheduledAt,
              durationMinutes: s.durationMinutes,
              isOngoing: nowMs >= startMs && nowMs < endMs,
              facilitator: { id: s.facilitatorId, name: facilitatorName },
            };
          })
          .filter(Boolean);
      } catch (error) {
        if (isDbSchemaMismatch(error)) return [];
        throw error;
      }
    })(),
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
    getLatestLiveAnnouncements(3),
  ]);

  if (user?.role === 'ADMIN' || user?.role === 'TEACHER') {
    redirect('/admin/events');
  }

  const displayName = user?.firstName || copy.fallbackName;
  const greeting = getGreeting(copy.greeting);
  const streakStats = calcStreakStats(
    dailyVisits.map((entry) => entry.dayNumber),
    copy.weekdays,
  );
  const streakMessage = streakStats.hasToday
    ? copy.streakMessages.today
    : streakStats.hasYesterday
      ? copy.streakMessages.yesterday
      : copy.streakMessages.start;
  const currentUnit =
    streakStats.current === 1 ? copy.dayLabel.singular : copy.dayLabel.plural;
  const bestUnit =
    streakStats.best === 1 ? copy.dayLabel.singular : copy.dayLabel.plural;

  const announcementEmptyCopy = messages.liveActivities.announcements.empty;
  const announcementsDateFormatter = new Intl.DateTimeFormat(getLocaleCode(locale), {
    month: 'short',
    day: 'numeric',
  });

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
                {copy.snapshot}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50 via-orange-50/70 to-rose-50 px-4 py-4 sm:px-6 sm:py-5 dark:border-white/10 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-rose-500/10">
              <div className="pointer-events-none absolute -top-12 right-6 h-32 w-32 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-400/20" />
              <div className="pointer-events-none absolute -bottom-12 left-6 h-32 w-32 rounded-full bg-rose-300/40 blur-3xl dark:bg-rose-400/20" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.7),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.55),transparent_70%)]" />

              <div className="relative grid grid-cols-2 gap-4 md:grid-cols-[1fr_3fr_1fr] md:items-center md:gap-6">
                <div className="order-1 md:order-none">
                  <StreakMetric
                    title={copy.today}
                    value={streakStats.current}
                    unit={currentUnit}
                    message={streakMessage}
                  />
                </div>

                <div className="order-3 col-span-2 flex flex-col items-center gap-4 md:order-none md:col-auto">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3">
                    {streakStats.weekDays.map((day) => (
                      <div key={day.key} className="flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground/70">
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

                <div className="order-2 md:order-none">
                  <StreakMetric
                    title={copy.bestStreak}
                    value={streakStats.best}
                    unit={bestUnit}
                    align="right"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-foreground">
                  {t('sidebar.announcements')}
                </h2>
              </div>

              {liveAnnouncements.length === 0 ? (
                <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
                  <Megaphone className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {announcementEmptyCopy}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveAnnouncements.map((announcement) => (
                    (() => {
                      const imageSrc = getAnnouncementImageSrc(announcement.imageUrl);
                      return (
                    <Link
                      key={announcement.id}
                      href={`/a/${announcement.id}`}
                      className="block space-y-2 rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border/50 bg-muted/30">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex items-start justify-between gap-2 px-1 pb-1">
                        <h3 className="font-medium text-sm leading-snug line-clamp-2">
                          {announcement.title}
                        </h3>
                        <div className="shrink-0 flex items-center gap-1">
                          <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-foreground">
                            {announcementsDateFormatter.format(announcement.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">{copy.upcoming}</h2>
            </div>
            <Link
              href="/events"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {copy.viewAll}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingActivities.length === 0 ? (
            <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
              <Video className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">{copy.noLive}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {copy.noLiveHint}
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
                        <span className="text-[11px] font-medium uppercase text-muted-foreground">
                          {activityDate.toLocaleDateString(getLocaleCode(locale), { month: 'short' })}
                        </span>
                        <span className="text-lg font-medium text-foreground">
                          {activityDate.toLocaleDateString(getLocaleCode(locale), { day: '2-digit' })}
                        </span>
                      </div>
                      <div className="min-w-[200px] flex-1">
                        <p className="text-sm font-medium text-foreground line-clamp-1">
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
                            {activityDate.toLocaleTimeString(getLocaleCode(locale), {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12:
                                timeFormat === 'auto'
                                  ? undefined
                                  : timeFormat === '12-hour',
                            })}
                          </span>
                          {activity.duration && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              <Clock className="h-3 w-3" />
                              {activity.duration} {copy.minLabel}
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
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">
                {locale === 'az' ? 'Yaxınlaşan bələdçili qrup sessiyaları' : 'Upcoming guided group sessions'}
              </h2>
            </div>
            <Link
              href="/my-library/guided-group-sessions"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {copy.viewAll}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingGuidedSessions.length === 0 ? (
            <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
              <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">
                {locale === 'az' ? 'Qeydiyyat sessiyanız yoxdur' : 'No registered sessions yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {locale === 'az'
                  ? 'Sessiya olduqda “Bələdçili qrup sessiyaları” bölməsindən qeydiyyatdan keçin.'
                  : 'When a session is available, register from Guided group sessions.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingGuidedSessions.map((session: any) => (
                <Link
                  key={session.id}
                  href={`/my-library/guided-group-sessions/${session.id}`}
                  className="card-frame border-dashed bg-muted/20 px-4 py-3 block hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-muted/60 text-center">
                      <span className="text-[11px] font-medium uppercase text-muted-foreground">
                        {session.scheduledAt.toLocaleDateString(getLocaleCode(locale), { month: 'short' })}
                      </span>
                      <span className="text-lg font-medium text-foreground">
                        {session.scheduledAt.toLocaleDateString(getLocaleCode(locale), { day: '2-digit' })}
                      </span>
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1">
                          {session.title}
                        </p>
                        {session.isOngoing ? (
                          <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300">
                            {locale === 'az' ? 'Canlı' : 'Ongoing'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {session.facilitator?.name ?? '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                          <Clock className="h-3 w-3" />
                          {session.scheduledAt.toLocaleTimeString(getLocaleCode(locale), {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12:
                              timeFormat === 'auto'
                                ? undefined
                                : timeFormat === '12-hour',
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                          <Clock className="h-3 w-3" />
                          {session.durationMinutes} {copy.minLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">{copy.recentMaterials}</h2>
            </div>
            <Link
              href="/my-library"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {copy.allMaterials}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">{copy.noMaterials}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {copy.noMaterialsHintStart}
                <Link href="/catalog" className="text-foreground underline underline-offset-2">
                  {copy.noMaterialsLink}
                </Link>{' '}
                {copy.noMaterialsHintEnd}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentPurchases.map(({ material, createdAt }) => (
                <Link
                  key={material.id}
                  href={`/catalog/${
                    subjectHrefMap.get(material.subjectId) ?? material.subjectId
                  }/${
                    topicHrefMap.get(`${material.subjectId}:${material.topicId}`) ?? material.topicId
                  }/${material.id}`}
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
                        {material.materialType === 'PRACTICE_TEST' ? copy.testLabel : copy.textualLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="capitalize">
                      {subjectNameMap.get(material.subjectId) ?? material.subjectId}
                    </span>
                    {material.difficulty && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          material.difficulty === 'ADVANCED'
                            ? 'bg-destructive/10 text-destructive'
                            : material.difficulty === 'INTERMEDIATE'
                              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                              : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                        }`}
                      >
                        {difficultyCopy[material.difficulty]}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground/60 mt-auto">
                    {copy.purchased}{' '}
                    {new Date(createdAt).toLocaleDateString(getLocaleCode(locale), {
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
