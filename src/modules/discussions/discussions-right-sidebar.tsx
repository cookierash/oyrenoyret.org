'use client';

import { usePathname } from 'next/navigation';
import { TrendingDiscussions } from '@/src/modules/discussions/trending-discussions';
import { useI18n } from '@/src/i18n/i18n-provider';

export function DiscussionsRightSidebar() {
  const pathname = usePathname();
  const isIndex = pathname === '/discussions';
  const showRules = !isIndex;
  const { messages } = useI18n();
  const rulesCopy = messages.discussions.rules;

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-full flex-col border-l border-border bg-background">
      <div className="h-full overflow-y-auto space-y-8 px-6 py-8">
        <TrendingDiscussions variant={isIndex ? 'card' : 'plain'} />
        {showRules && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{rulesCopy.title}</h2>
            <p className="text-xs text-muted-foreground">{rulesCopy.rule1}</p>
            <p className="text-xs text-muted-foreground">{rulesCopy.rule2}</p>
            <p className="text-xs text-muted-foreground">{rulesCopy.rule3}</p>
          </section>
        )}
      </div>
    </aside>
  );
}
