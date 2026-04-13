'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PiList as Menu, PiTrendUp as TrendingUp, PiMegaphone as Megaphone } from 'react-icons/pi';
import { AppSidebar } from '@/src/components/layout/app-sidebar';
import { AccountTitle } from '@/src/components/layout/account-title';
import { DiscussionsRightSidebar } from '@/src/components/layout/discussions-right-sidebar';
import { LiveActivitiesRightSidebar } from '@/src/components/layout/live-activities-right-sidebar';
import { TrendingDiscussions } from '@/src/modules/discussions/trending-discussions';
import { LiveAnnouncementsList } from '@/src/modules/interactive-sessions/live-announcements-list';
import { Logo } from '@/src/components/ui/logo';
import { WelcomeTour } from '@/src/modules/onboarding/welcome-tour';
import { OnlinePresence } from '@/src/components/presence/online-presence';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { EmailVerificationBanner } from '@/src/modules/auth/components/email-verification-banner';
import { CurrentUserProvider } from '@/src/modules/auth/components/current-user-context';
import { AccountRestrictionDialog } from '@/src/components/moderation/account-restriction-dialog';

interface AppShellProps {
  children: ReactNode;
  displayName: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarVariant?: string | null;
    email: string;
    credits?: number;
    role?: string;
    emailVerifiedAt?: string | null;
    status?: string | null;
    suspensionUntil?: string | null;
    suspensionReason?: string | null;
    bannedAt?: string | null;
    banReason?: string | null;
  };
  showTutorial?: boolean;
}

export function AppShell({
  children,
  displayName,
  user,
  showTutorial = false,
}: AppShellProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    if (!showTutorial) return false;
    try {
      return localStorage.getItem('oyrenoyret:welcomeTourSeen') !== '1';
    } catch {
      return true;
    }
  });
  const tutorialCompleteRef = useRef(false);
  const isDiscussionsRoute = pathname === '/discussions' || pathname.startsWith('/discussions/');
  const isInteractiveSessionsRoute =
    pathname === '/interactive-sessions' || pathname.startsWith('/interactive-sessions/');
  const showRight = isDiscussionsRoute || isInteractiveSessionsRoute;
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

  const handleTutorialComplete = useCallback(async () => {
    if (tutorialCompleteRef.current) return;
    tutorialCompleteRef.current = true;
    setTutorialOpen(false);
    try {
      localStorage.setItem('oyrenoyret:welcomeTourSeen', '1');
    } catch {
      // ignore
    }
    try {
      await fetch('/api/onboarding/complete', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore network errors; we still treat the tour as seen locally.
    }
  }, []);

  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      <OnlinePresence />
      <AccountTitle displayName={displayName} />
      <CurrentUserProvider
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarVariant: user.avatarVariant,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt,
          status: user.status ?? null,
          suspensionUntil: user.suspensionUntil ?? null,
          bannedAt: user.bannedAt ?? null,
        }}
      >
        <AccountRestrictionDialog
          status={user.status ?? null}
          suspensionUntil={user.suspensionUntil ?? null}
          suspensionReason={user.suspensionReason ?? null}
          banReason={user.banReason ?? null}
        />
        <div className="mx-auto flex h-full w-full max-w-[1200px] min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/70"
              aria-label={t('header.toggleMenu')}
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
              {!user.emailVerifiedAt ? (
                <div className="mb-4">
                  <EmailVerificationBanner />
                </div>
              ) : null}

              {children}
              {showRight ? (
                <section className="mt-6 mb-6 lg:mb-0 lg:hidden">
                  {isDiscussionsRoute ? (
                    <div className="card-frame bg-card overflow-hidden">
                      <div className="flex h-12 items-center gap-2 px-4 text-sm font-medium text-foreground">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        {t('discussions.trendingTitle')}
                      </div>
                      <div className="h-px w-full bg-border/70" />
                      <div className="p-4">
                        <TrendingDiscussions variant="plain" showTitle={false} showScore={false} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1 text-sm font-medium text-foreground">
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                        {t('sidebar.announcements')}
                      </div>
                      <LiveAnnouncementsList limit={6} />
                    </div>
                  )}
                </section>
              ) : null}
            </main>
            {isDiscussionsRoute ? (
              <DiscussionsRightSidebar className="hidden lg:flex" />
            ) : isInteractiveSessionsRoute ? (
              <LiveActivitiesRightSidebar className="hidden lg:flex" />
            ) : null}
          </div>
        </div>
      </CurrentUserProvider>

      {showTutorial ? (
        <WelcomeTour open={tutorialOpen} onComplete={handleTutorialComplete} />
      ) : null}

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
          aria-label={t('header.closeNavigation')}
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
