'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AppSidebar } from '@/src/components/layout/app-sidebar';
import { AccountTitle } from '@/src/components/layout/account-title';
import { DiscussionsRightSidebar } from '@/src/components/layout/discussions-right-sidebar';
import { LiveActivitiesRightSidebar } from '@/src/components/layout/live-activities-right-sidebar';
import { TrendingDiscussions } from '@/src/modules/discussions/trending-discussions';
import { LiveAnnouncementsList } from '@/src/modules/live-activities/live-announcements-list';
import { Logo } from '@/src/components/ui/logo';
import { cn } from '@/src/lib/utils';

interface AppShellProps {
  children: ReactNode;
  displayName: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    credits?: number;
    role?: string;
  };
}

export function AppShell({ children, displayName, user }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDiscussionsRoute = pathname === '/discussions' || pathname.startsWith('/discussions/');
  const isLiveActivitiesRoute =
    pathname === '/live-activities' || pathname.startsWith('/live-activities/');
  const showRight = isDiscussionsRoute || isLiveActivitiesRoute;
  const removeMainPaddingY = isDiscussionsRoute && pathname !== '/discussions';
  const gridColumns = showRight
    ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)]'
    : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]';

  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    const previous = prevPathnameRef.current;
    if (previous !== pathname && mobileNavOpen) {
      const id = requestAnimationFrame(() => setMobileNavOpen(false));
      prevPathnameRef.current = pathname;
      return () => cancelAnimationFrame(id);
    }
    prevPathnameRef.current = pathname;
    return;
  }, [pathname, mobileNavOpen]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      <AccountTitle displayName={displayName} />
      <div className="mx-auto flex h-full w-full max-w-[1200px] min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/70"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Logo size="sm" showText />
          <span className="h-9 w-9" aria-hidden />
        </div>

        <div className={`grid w-full flex-1 min-h-0 ${gridColumns}`}>
          <AppSidebar user={user} className="hidden lg:flex" />
          <main
            className={`min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 ${removeMainPaddingY ? 'py-0' : 'py-6'} sm:px-6 lg:px-8 lg:py-8`}
          >
            {children}
            {showRight ? (
              <section className="mt-6 lg:hidden">
                <div className="card-frame bg-card overflow-hidden">
                  <div className="flex h-12 items-center px-4 text-sm font-semibold text-foreground">
                    {isDiscussionsRoute ? 'Trending discussions' : 'Announcements'}
                  </div>
                  <div className="h-px w-full bg-border/70" />
                  <div className="p-4">
                    {isDiscussionsRoute ? (
                      <TrendingDiscussions variant="plain" showTitle={false} showScore={false} />
                    ) : (
                      <LiveAnnouncementsList limit={6} />
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </main>
          {isDiscussionsRoute ? (
            <DiscussionsRightSidebar className="hidden lg:flex" />
          ) : isLiveActivitiesRoute ? (
            <LiveActivitiesRightSidebar className="hidden lg:flex" />
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ease-in-out',
          mobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        role="dialog"
        aria-modal={mobileNavOpen}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-black/40 transition-opacity duration-300 ease-in-out',
            mobileNavOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          tabIndex={mobileNavOpen ? 0 : -1}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-72 border-r border-border bg-background shadow-xl transition-transform duration-350 ease-in-out will-change-transform',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <AppSidebar
            user={user}
            className="h-full border-r-0"
            onClose={() => setMobileNavOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
