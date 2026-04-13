'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PiSquaresFour as LayoutDashboard, PiSparkle as Sparkles, PiTrophy as Trophy, PiBookOpen as BookOpen, PiBooks as Library, PiUsersThree as UsersThree, PiCalendar as CalendarDays, PiChatCircle as MessageSquare, PiGraduationCap as GraduationCap, PiSignOut as LogOut, PiGear as Settings, PiX as X, PiShieldCheck as ShieldCheck, PiUserCircle as UserCircle, PiBell as Bell, PiPalette as Palette, PiTranslate as Translate, PiArrowLeft as ArrowLeft, PiWarningCircle as WarningCircle } from 'react-icons/pi';
import { ProfileAvatar } from '@/src/components/layout/profile-avatar';
import { Logo } from '@/src/components/ui/logo';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { USER_ROLES } from '@/src/config/constants';
import { NOTIFICATIONS_UNREAD_UPDATED_EVENT } from '@/src/lib/notifications-events';

interface AppSidebarProps {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarVariant?: string | null;
    email: string;
    credits?: number;
    role?: string;
  };
  className?: string;
  onClose?: () => void;
}

import { CREDITS_UPDATED_EVENT } from '@/src/lib/credits-events';

export function AppSidebar({ user, className, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [credits, setCredits] = useState<number | null>(user.credits ?? null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [logoutPending, setLogoutPending] = useState(false);
  const lastBalanceFetchRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const lastUnreadFetchRef = useRef(0);
  const unreadFetchInFlightRef = useRef(false);
  const normalizedRole = typeof user.role === 'string' ? user.role.toUpperCase() : '';
  const isStaff = normalizedRole === USER_ROLES.ADMIN || normalizedRole === USER_ROLES.TEACHER;
  const homeHref = isStaff ? '/admin' : '/dashboard';
  const isSettingsRoute = pathname === '/settings' || pathname.startsWith('/settings/');
  const settingsNavSections = [
    {
      id: 'user-settings',
      title: t('settings.nav.userSettings'),
      items: [
        {
          href: '/settings/my-account',
          label: t('settings.nav.myAccount'),
          icon: UserCircle,
        },
        {
          href: '/settings/notifications',
          label: t('settings.nav.notifications'),
          icon: Bell,
        },
      ],
    },
    {
      id: 'app-settings',
      title: t('settings.nav.appSettings'),
      items: [
        {
          href: '/settings/appearance',
          label: t('settings.nav.appearance'),
          icon: Palette,
        },
        {
          href: '/settings/language-time',
          label: t('settings.nav.languageTime'),
          icon: Translate,
        },
      ],
    },
  ];
  const navItems = [
    { href: '/dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { href: '/studio', label: t('sidebar.studio'), icon: Sparkles, isBrand: true },
    { href: '/leaderboard', label: t('sidebar.leaderboard'), icon: Trophy },
    { href: '/catalog', label: t('sidebar.catalog'), icon: BookOpen },
    { href: '/my-library', label: t('sidebar.library'), icon: Library },
    { href: '/my-library/guided-group-sessions', label: t('sidebar.guidedGroupSessions'), icon: UsersThree },
    { href: '/interactive-sessions', label: t('sidebar.liveActivities'), icon: CalendarDays },
    { href: '/discussions', label: t('sidebar.discussions'), icon: MessageSquare },
    { href: '/notifications', label: t('sidebar.notifications'), icon: Bell },
    { href: '/academic-record', label: t('sidebar.academicRecord'), icon: GraduationCap },
  ];

  const fetchBalance = useCallback(async (force = false) => {
    if (fetchInFlightRef.current) return;
    const now = Date.now();
    if (!force && now - lastBalanceFetchRef.current < 60_000) return;
    fetchInFlightRef.current = true;
    try {
      const res = await fetch('/api/credits/balance', { cache: 'no-store' });
      if (res.ok) {
        const { balance } = await res.json();
        setCredits(balance);
        lastBalanceFetchRef.current = Date.now();
      }
    } catch {
      /* ignore */
    } finally {
      fetchInFlightRef.current = false;
    }
  }, []);

  const fetchUnreadNotifications = useCallback(async (force = false) => {
    if (unreadFetchInFlightRef.current) return;
    const now = Date.now();
    if (!force && now - lastUnreadFetchRef.current < 8_000) return;
    unreadFetchInFlightRef.current = true;
    try {
      const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const unreadCount = typeof data?.unreadCount === 'number' ? data.unreadCount : 0;
        setUnreadNotifications(unreadCount);
        lastUnreadFetchRef.current = Date.now();
      }
    } catch {
      /* ignore */
    } finally {
      unreadFetchInFlightRef.current = false;
    }
  }, []);

  const handleCreditsUpdated = useCallback(
    (e: CustomEvent<{ balance: number }>) => {
      setCredits(e.detail.balance);
      fetchBalance(true); // Re-fetch to stay in sync with server
      fetchUnreadNotifications(true); // Credit changes often imply a new credit activity item.
    },
    [fetchBalance, fetchUnreadNotifications],
  );

  const handleUnreadUpdated = useCallback(
    (e: CustomEvent<{ unreadCount: number }>) => {
      const nextUnread =
        typeof e.detail?.unreadCount === 'number' ? e.detail.unreadCount : 0;
      setUnreadNotifications(nextUnread);
      fetchUnreadNotifications(true);
    },
    [fetchUnreadNotifications],
  );

  useEffect(() => {
    window.addEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated as EventListener);
    return () =>
      window.removeEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated as EventListener);
  }, [handleCreditsUpdated]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_UNREAD_UPDATED_EVENT, handleUnreadUpdated as EventListener);
    return () =>
      window.removeEventListener(
        NOTIFICATIONS_UNREAD_UPDATED_EVENT,
        handleUnreadUpdated as EventListener,
      );
  }, [handleUnreadUpdated]);

  // Fetch on navigation (e.g. after publish from editor, user lands here with fresh data)
  useEffect(() => {
    if (!pathname) return;
    const id = requestAnimationFrame(() => {
      void fetchBalance();
      void fetchUnreadNotifications(true);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, fetchBalance, fetchUnreadNotifications]);

  // Poll balance when tab is visible (catches external changes e.g. upvotes on your reply)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchBalance();
        void fetchUnreadNotifications(true);
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    requestAnimationFrame(handleVisibility);
    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchBalance, fetchUnreadNotifications]);

  // Lightweight polling for unread badge while tab is visible.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let interval: number | null = null;
    const start = () => {
      if (interval) return;
      interval = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        void fetchUnreadNotifications(true);
      }, 10_000);
    };
    const stop = () => {
      if (!interval) return;
      window.clearInterval(interval);
      interval = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadNotifications]);

  const displayCredits = credits ?? user.credits ?? 0;

  // Near real-time unread badge updates (server-sent events).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof EventSource === 'undefined') return;

    let closed = false;
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelayMs = 3000;

    const cleanup = () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      source?.close();
      source = null;
    };

    const connect = () => {
      cleanup();
      if (closed) return;

      source = new EventSource('/api/notifications/unread-stream');
      source.addEventListener('unread', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data ?? '{}') as { unreadCount?: unknown };
          const nextUnread = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
          setUnreadNotifications(nextUnread);
          lastUnreadFetchRef.current = Date.now();
          reconnectDelayMs = 3000; // reset backoff on success
        } catch {
          /* ignore */
        }
      });

      source.onerror = () => {
        // Fall back to polling; keep trying to reconnect in the background.
        cleanup();
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
      };
    };

    connect();
    return () => {
      closed = true;
      cleanup();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    onClose?.();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      // Avoid crashing the client if the request fails (offline, dev env, transient network).
      console.warn('[LOGOUT] Request failed; redirecting anyway.', error);
    } finally {
      router.replace('/');
      router.refresh();
    }
  }, [logoutPending, onClose, router]);

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-[100dvh] w-full flex-col border-r border-border bg-background',
        className,
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-4">
        {isSettingsRoute ? (
          <div className="relative flex w-full items-center justify-start">
            <Button size="sm" variant="ghost" asChild>
              <Link
                href={homeHref}
                onClick={() => onClose?.()}
                className="inline-flex items-center gap-1"
                aria-label={t('settings.nav.backHome')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{t('settings.nav.backHome')}</span>
              </Link>
            </Button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('header.closeNavigation')}
                className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <Logo size="sm" showText priority />
            <div className="ml-auto flex items-center gap-2">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('header.closeNavigation')}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <nav className={cn('flex-1', isSettingsRoute ? 'space-y-6 p-3' : 'space-y-0.5 p-2')}>
        {isSettingsRoute ? (
          <div className="space-y-6">
            {settingsNavSections.map((section) => (
              <div key={section.id} className="space-y-2">
                <p className="px-3 text-xs font-medium text-muted-foreground">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onClose?.()}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <p className="px-3 text-xs font-medium text-muted-foreground">
                {t('settings.nav.logOut')}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutPending}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive/90 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut className="h-4 w-4" />
                {logoutPending ? t('settings.nav.loggingOut') : t('settings.nav.logOut')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isStaff
              ? navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const showUnreadBadge = item.href === '/notifications' && unreadNotifications > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.isBrand ? (
                        <span className="lowercase">
                          <span className="brand-font">oyrenoyret</span> studio
                        </span>
                      ) : (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {showUnreadBadge ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-none text-destructive-foreground">
                          {unreadNotifications > 99 ? '99+' : unreadNotifications}
                        </span>
                      ) : null}
                    </Link>
                  );
                })
              : null}
            {isStaff ? (
              <div className="space-y-0.5">
                <Link
                  href="/admin"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname === '/admin'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {t('sidebar.adminHome')}
                </Link>
                <Link
                  href="/admin/interactive-sessions"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin/interactive-sessions')
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('sidebar.manageLive')}
                </Link>
                <Link
                  href="/admin/guided-group-sessions"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin/guided-group-sessions')
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <UsersThree className="h-4 w-4" />
                  {t('sidebar.guidedGroupSessions')}
                </Link>
                <Link
                  href="/admin/messages"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin/messages')
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  {t('sidebar.contactMessages')}
                </Link>
                <Link
                  href="/admin/curriculum"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin/curriculum')
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  {t('sidebar.curriculum')}
                </Link>
                <Link
                  href="/admin/reports"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin/reports')
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <WarningCircle className="h-4 w-4" />
                  {t('sidebar.reports')}
                </Link>
              </div>
            ) : null}
          </>
        )}
      </nav>

      {!isStaff && !isSettingsRoute ? (
        <div className="px-2 pb-3">
          <div className="w-full rounded-md border border-primary/20 bg-primary/10 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-primary/80">
              {t('sidebar.creditsLabel')}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              {t('sidebar.creditsValue', { count: Math.round(Number(displayCredits)) })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="border-t border-border px-2 py-3">
        <div className="flex w-full items-center gap-2 rounded-md px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ProfileAvatar
              userId={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              avatarVariant={user.avatarVariant}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user.firstName || user.email.split('@')[0]}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
          {!isSettingsRoute ? (
            <Link
              href="/settings/my-account"
              onClick={() => onClose?.()}
              aria-label={t('settings.nav.settings')}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
