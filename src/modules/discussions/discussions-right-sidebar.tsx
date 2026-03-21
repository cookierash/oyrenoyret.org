'use client';

import { usePathname } from 'next/navigation';
import { TrendingDiscussions } from '@/src/modules/discussions/trending-discussions';

export function DiscussionsRightSidebar() {
  const pathname = usePathname();
  const isIndex = pathname === '/discussions';
  const showRules = !isIndex;

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-full flex-col border-l border-border bg-background">
      <div className="h-full overflow-y-auto space-y-8 px-6 py-8">
        <TrendingDiscussions variant={isIndex ? 'card' : 'plain'} />
        {showRules && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Community rules</h2>
            <p className="text-xs text-muted-foreground">Be respectful and stay on topic.</p>
            <p className="text-xs text-muted-foreground">No spam or self-promotion.</p>
            <p className="text-xs text-muted-foreground">Share sources when possible.</p>
          </section>
        )}
      </div>
    </aside>
  );
}
