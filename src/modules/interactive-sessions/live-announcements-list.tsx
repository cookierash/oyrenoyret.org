'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useSettings } from '@/src/components/settings/settings-provider';
import { getLocaleCode } from '@/src/i18n';
import { getAnnouncementImageSrc } from '@/src/lib/announcement-images';

interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
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
        const imageSrc = getAnnouncementImageSrc(announcement.imageUrl);
        return (
          <Link
            key={announcement.id}
            href={`/a/${announcement.id}`}
            className="block space-y-2 rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border/50 bg-muted/30">
              {imageSrc ? (
                // Use a plain <img> to avoid Next/Image remote host allowlist issues in some deployments.
                <img
                  src={imageSrc}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-2 px-1 pb-1">
              <h3 className="text-sm font-medium text-foreground">
                {announcement.title}
              </h3>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {dateFormatter.format(createdAt)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
