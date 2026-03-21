'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';

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
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

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
        No announcements yet.
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
                {createdAt.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
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
