'use client';

import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useSettings } from '@/src/components/settings/settings-provider';
import { getLocaleCode } from '@/src/i18n';

interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface LiveAnnouncementsListProps {
  limit?: number;
  className?: string;
}

export function LiveAnnouncementsList({ limit = 6, className }: LiveAnnouncementsListProps) {
  const { locale, messages } = useI18n();
  const { timeFormat } = useSettings();
  const copy = messages.liveActivities.announcements;
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const localeCode = getLocaleCode(locale);
  const hour12 =
    timeFormat === '12-hour' ? true : timeFormat === '24-hour' ? false : undefined;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        month: 'short',
        day: 'numeric',
        ...(hour12 === undefined ? {} : { hour12 }),
      }),
    [localeCode, hour12],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('take', String(limit));
    fetch(`/api/live-announcements?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        {copy.empty}
      </p>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {announcements.map((announcement) => {
        const createdAt = new Date(announcement.createdAt);
        return (
          <div key={announcement.id} className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {announcement.title}
              </h3>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {dateFormatter.format(createdAt)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {announcement.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
