'use client';

import { LiveAnnouncementsList } from '@/src/modules/events/live-announcements-list';
import { PiMegaphone as Megaphone } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';

interface LiveActivitiesRightSidebarProps {
  className?: string;
}

export function LiveActivitiesRightSidebar({ className }: LiveActivitiesRightSidebarProps) {
  const { t } = useI18n();
  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-[100dvh] w-full flex-col border-l border-border bg-background',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background">
          <section className="flex h-14 items-center gap-2 px-4">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              {t('sidebar.announcements')}
            </h2>
          </section>
          <div className="h-px w-full bg-border/70" />
        </div>
        <section className="p-4">
          <LiveAnnouncementsList limit={8} />
        </section>
      </div>
    </aside>
  );
}
