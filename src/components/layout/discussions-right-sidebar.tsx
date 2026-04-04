'use client';

import { TrendingDiscussions } from '@/src/modules/discussions/trending-discussions';
import { PiTrendUp as TrendingUp } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';

interface DiscussionsRightSidebarProps {
  className?: string;
}

export function DiscussionsRightSidebar({ className }: DiscussionsRightSidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-[100dvh] w-full flex-col border-l border-border bg-background',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto">
        <section className="flex h-14 items-center gap-2 px-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Trending discussions</h2>
        </section>
        <div className="h-px w-full bg-border/70" />
        <section className="p-4 pb-8">
          <TrendingDiscussions variant="plain" showTitle={false} showScore />
        </section>
      </div>
    </aside>
  );
}
