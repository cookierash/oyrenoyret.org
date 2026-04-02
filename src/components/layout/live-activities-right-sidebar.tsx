'use client';

import { LiveAnnouncementsList } from '@/src/modules/live-activities/live-announcements-list';
import { cn } from '@/src/lib/utils';

interface LiveActivitiesRightSidebarProps {
  className?: string;
}

export function LiveActivitiesRightSidebar({ className }: LiveActivitiesRightSidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-[100dvh] w-full flex-col border-l border-border bg-background',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto">
        <section className="flex h-14 items-center">
          <h2 className="pl-4 text-sm font-semibold text-foreground">Announcements</h2>
        </section>
        <div className="h-px w-full bg-border/70" />
        <section className="p-4">
          <LiveAnnouncementsList limit={8} />
        </section>
      </div>
    </aside>
  );
}
