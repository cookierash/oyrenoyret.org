/**
 * Leaderboard Page
 *
 * Highlights the top 10 learners by credits.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { prisma } from '@/src/db/client';
import { getI18n } from '@/src/i18n/server';
import { roundCredits } from '@/src/modules/credits';
import { cn } from '@/src/lib/utils';
import { PiTrophy as Trophy, PiMedal as Medal, PiStar as Star } from 'react-icons/pi';

export const metadata = {
  title: 'Leaderboard',
};

const AVATAR_COLORS = [
  'bg-blue-400',
  'bg-emerald-400',
  'bg-violet-400',
  'bg-amber-400',
  'bg-rose-400',
] as const;

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string) {
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((value) => value!.trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
  if (initials) return initials;
  if (email) return email.trim().charAt(0).toUpperCase();
  return '?';
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string,
  fallback = 'Learner',
) {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  if (name) return name;
  if (email) return email.split('@')[0];
  return fallback;
}

const TOP_STYLES: Record<number, { badge: string; row: string }> = {
  1: {
    badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    row: 'bg-gradient-to-r from-amber-50 via-transparent to-transparent dark:from-amber-500/10',
  },
  2: {
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    row: 'bg-gradient-to-r from-slate-50 via-transparent to-transparent dark:from-slate-400/10',
  },
  3: {
    badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
    row: 'bg-gradient-to-r from-rose-50 via-transparent to-transparent dark:from-rose-500/10',
  },
};

const TOP_ICONS: Partial<Record<number, typeof Trophy>> = {
  1: Trophy,
  2: Medal,
  3: Star,
};

export default async function LeaderboardPage() {
  const { messages, t } = await getI18n();
  const copy = messages.app.leaderboard;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      role: 'STUDENT',
    },
    orderBy: [{ credits: 'desc' }, { updatedAt: 'desc' }],
    take: 10,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      credits: true,
    },
  });

  return (
    <DashboardShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />

      <main className="space-y-4 pt-2 animate-fade-up motion-reduce:animate-none">
        <section className="card-frame relative overflow-hidden bg-card">
          <div className="pointer-events-none absolute -top-16 right-4 h-32 w-32 rounded-full bg-primary/10 blur-3xl animate-pulse-soft motion-reduce:animate-none" />
          <div className="pointer-events-none absolute -bottom-12 left-4 h-28 w-28 rounded-full bg-amber-400/20 blur-3xl animate-pulse-soft motion-reduce:animate-none" />

          <div className="relative">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{copy.rankLabel}</span>
              <span>{copy.learnerLabel}</span>
              <span className="text-right">{copy.creditsLabel}</span>
            </div>

            {users.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">{copy.emptyTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{copy.emptyDescription}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {users.map((user, index) => {
                  const rank = index + 1;
                  const topStyle = TOP_STYLES[rank];
                  const Icon = TOP_ICONS[rank];
                  const initials = getInitials(user.firstName, user.lastName, user.email);
                  const displayName = getDisplayName(
                    user.firstName,
                    user.lastName,
                    user.email,
                    copy.fallbackName,
                  );
                  const credits = roundCredits(user.credits ?? 0);
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        'flex flex-col gap-3 px-4 py-4 transition-colors duration-200 sm:flex-row sm:items-center sm:gap-4',
                        topStyle?.row ?? 'bg-transparent',
                        'hover:bg-muted/30',
                        'animate-fade-up motion-reduce:animate-none',
                      )}
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                            topStyle?.badge ?? 'bg-muted text-muted-foreground ring-1 ring-border',
                          )}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : rank}
                        </div>
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white ring-1 ring-black/5',
                            getAvatarColor(user.id),
                          )}
                        >
                          {initials}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('app.leaderboard.rankValue', { rank })}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {t('sidebar.creditsValue', { count: credits })}
                        </p>
                        <p className="text-xs text-muted-foreground">{copy.creditsCaption}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
