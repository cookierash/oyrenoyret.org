'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PiTrendUp as TrendingUp } from 'react-icons/pi';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';

interface Discussion {
  id: string;
  title: string;
  voteScore: number;
  totalPopularity: number;
  replyCount: number;
  lastActivityAt: string;
}

interface TrendingDiscussionsProps {
  variant?: 'card' | 'plain';
  showScore?: boolean;
  showTitle?: boolean;
}

export function TrendingDiscussions({
  variant = 'card',
  showScore = true,
  showTitle = true,
}: TrendingDiscussionsProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/discussions?take=50', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Discussion[]) => {
        const sorted = [...data].sort((a, b) => {
          const scoreDiff = b.totalPopularity - a.totalPopularity;
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        });
        setItems(sorted.slice(0, 5));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const content = (
    <>
      {showTitle && (
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          {t('discussions.trendingTitle')}
        </h2>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('discussions.trendingEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <Link
              key={d.id}
              href={`/discussions/${d.id}`}
              className="flex items-start justify-between gap-3 group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {d.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('discussions.repliesLabel', { count: d.replyCount })}
                </p>
              </div>
              {showScore ? (
                <span
                  className={cn(
                    'text-xs font-semibold px-2 py-1 rounded-md border',
                    d.totalPopularity > 0
                      ? 'text-primary border-primary/30 bg-primary/10'
                      : d.totalPopularity < 0
                        ? 'text-destructive border-destructive/30 bg-destructive/10'
                        : 'text-muted-foreground border-border/60 bg-muted/40'
                  )}
                >
                  {d.totalPopularity}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </>
  );

  if (variant === 'plain') {
    return <>{content}</>;
  }

  return <section className="card-frame bg-card p-5">{content}</section>;
}
