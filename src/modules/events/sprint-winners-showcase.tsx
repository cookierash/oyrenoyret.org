'use client';

import { useMemo } from 'react';
import { PiMedal as Medal, PiCrownSimple as Crown } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';

export type SprintWinnerSlot = {
  rank: 1 | 2 | 3;
  userId: string;
  profileId: string | null;
  name: string;
  avatarVariant: string | null;
};

function rankLabel(rank: 1 | 2 | 3) {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
}

export function SprintWinnersShowcase(props: {
  winners: SprintWinnerSlot[];
  isEvaluating: boolean;
}) {
  const { messages } = useI18n();
  const copy = messages.liveActivities.cms;

  const winnersByRank = useMemo(() => {
    const map = new Map<1 | 2 | 3, SprintWinnerSlot>();
    for (const w of props.winners) map.set(w.rank, w);
    return map;
  }, [props.winners]);

  if (props.isEvaluating) {
    return (
      <div className="card-frame bg-card p-4 sprint-winners-reveal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">{copy.evaluatingTitle}</p>
            <p className="text-xs text-muted-foreground">{copy.evaluatingSubtitle}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-700/20 border-t-amber-700 dark:border-amber-400/20 dark:border-t-amber-400" />
            {copy.evaluatingBadge}
          </span>
        </div>
      </div>
    );
  }

  if (props.winners.length === 0) return null;

  return (
    <div className="card-frame bg-gradient-to-r from-amber-50 to-sky-50 p-4 dark:from-amber-500/10 dark:to-sky-500/10 sprint-winners-reveal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            {copy.winnersBadge}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{copy.winnersTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.winnersSubtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-card/70 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/60">
          <Crown className="h-4 w-4 text-amber-500" />
          {copy.winnersCelebrate}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {([1, 2, 3] as const).map((rank, index) => {
          const winner = winnersByRank.get(rank) ?? null;
          const accent =
            rank === 1
              ? 'border-amber-500/30 bg-amber-500/10'
              : rank === 2
                ? 'border-slate-500/25 bg-slate-500/10'
                : 'border-orange-600/20 bg-orange-600/10';
          return (
            <div
              key={rank}
              className={cn(
                'card-frame border p-3 bg-card/70 sprint-winner-pop',
                accent,
                index === 0 ? 'sprint-winner-delay-1' : index === 1 ? 'sprint-winner-delay-2' : 'sprint-winner-delay-3',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                  <Medal
                    className={cn(
                      'h-4 w-4',
                      rank === 1
                        ? 'text-amber-500'
                        : rank === 2
                          ? 'text-slate-500'
                          : 'text-orange-600',
                    )}
                  />
                  <span>{copy.winnersRank.replace('{{rank}}', rankLabel(rank))}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2.5">
                {winner ? (
                  <>
                    <PostAvatar
                      userId={winner.userId}
                      profileId={winner.profileId ?? undefined}
                      authorName={winner.name}
                      avatarVariant={winner.avatarVariant}
                      size="sm"
                      showHoverCard
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{winner.name}</div>
                      <div className="text-xs text-muted-foreground">{copy.winnersWinnerLabel}</div>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{copy.winnersPending}</div>
                    <div className="text-xs text-muted-foreground">{copy.winnersPendingHint}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

