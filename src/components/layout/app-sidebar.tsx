'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PiSquaresFour as LayoutDashboard, PiSparkle as Sparkles, PiBookOpen as BookOpen, PiBooks as Library, PiCalendar as CalendarDays, PiChatCircle as MessageSquare, PiGraduationCap as GraduationCap, PiSignOut as LogOut, PiGear as Settings, PiReceipt as Receipt, PiX as X, PiShieldCheck as ShieldCheck } from 'react-icons/pi';
import { ProfileAvatar } from '@/src/components/layout/profile-avatar';
import { Logo } from '@/src/components/ui/logo';
import { ThemeToggle } from '@/src/components/theme-toggle';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/src/lib/utils';

interface AppSidebarProps {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    credits?: number;
    role?: string;
  };
  className?: string;
  onClose?: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/studio', label: 'oyrenoyret studio', icon: Sparkles, isBrand: true },
  { href: '/catalog', label: 'Catalog', icon: BookOpen },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/live-activities', label: 'Live Activities', icon: CalendarDays },
  { href: '/discussions', label: 'Discussions', icon: MessageSquare },
  { href: '/recent-activities', label: 'Recent Activities', icon: Receipt },
  { href: '/academic-record', label: 'Academic record', icon: GraduationCap },
];

import { CREDITS_UPDATED_EVENT } from '@/src/lib/credits-events';

export function AppSidebar({ user, className, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(user.credits ?? null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const lastBalanceFetchRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const isStaff = user.role === 'ADMIN' || user.role === 'TEACHER';

  const fetchBalance = useCallback(async (force = false) => {
    if (fetchInFlightRef.current) return;
    const now = Date.now();
    if (!force && now - lastBalanceFetchRef.current < 60_000) return;
    fetchInFlightRef.current = true;
    try {
      const res = await fetch(`/api/credits/balance?_=${Date.now()}`, { cache: 'no-store' });
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

  const handleCreditsUpdated = useCallback(
    (e: CustomEvent<{ balance: number }>) => {
      setCredits(e.detail.balance);
      fetchBalance(true); // Re-fetch to stay in sync with server
    },
    [fetchBalance],
  );

  useEffect(() => {
    window.addEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated as EventListener);
    return () =>
      window.removeEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated as EventListener);
  }, [handleCreditsUpdated]);

  // Fetch on navigation (e.g. after publish from editor, user lands here with fresh data)
  useEffect(() => {
    if (!pathname) return;
    const id = requestAnimationFrame(() => {
      void fetchBalance();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, fetchBalance]);

  // Poll balance when tab is visible (catches external changes e.g. upvotes on your reply)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchBalance();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    requestAnimationFrame(handleVisibility);
    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchBalance]);

  const displayCredits = credits ?? user.credits ?? 0;

  const handleLogout = useCallback(async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    setProfileMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/');
      router.refresh();
    }
  }, [logoutPending, router]);

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-[100dvh] w-full flex-col border-r border-border bg-background',
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Logo size="sm" showText />
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-8 w-8 shrink-0" />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {!isStaff
          ? navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
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
                  <span className="font-comfortaa">oyrenoyret</span> studio
                </span>
              ) : (
                item.label
              )}
            </Link>
          );
        })
          : null}
        {isStaff ? (
          <div className="space-y-0.5">
            <Link
              href="/admin/dashboard"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                pathname === '/admin/dashboard'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/admin/live-activities"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                pathname.startsWith('/admin/live-activities')
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Manage live activities
            </Link>
            <div className="ml-6 space-y-0.5">
              <Link
                href="/admin/live-activities/problem-sprints"
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname === '/admin/live-activities/problem-sprints'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <CalendarDays className="h-4 w-4" />
                Problem Sprint
              </Link>
              <Link
                href="/admin/live-activities/announcements"
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname === '/admin/live-activities/announcements'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Announcements
              </Link>
              <Link
                href="/admin/live-activities/events"
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname === '/admin/live-activities/events'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <Sparkles className="h-4 w-4" />
                Events
              </Link>
            </div>
          </div>
        ) : null}
      </nav>

      {!isStaff ? (
        <div className="px-2 pb-3">
          <div className="w-full rounded-md border border-primary/20 bg-primary/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
              Credits
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {Math.round(Number(displayCredits))} credits
            </p>
          </div>
        </div>
      ) : null}

      <div className="border-t border-border px-2 py-3">
        <HoverCard
          openDelay={10}
          closeDelay={100}
          open={profileMenuOpen}
          onOpenChange={setProfileMenuOpen}
        >
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/70"
              onMouseEnter={() => setProfileMenuOpen(true)}
              onMouseLeave={() => setProfileMenuOpen(false)}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <ProfileAvatar
                userId={user.id}
                firstName={user.firstName}
                lastName={user.lastName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {user.firstName || user.email.split('@')[0]}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
              </div>
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="start"
            forceMount
            sideOffset={4}
            className={cn(
              'relative origin-bottom-left w-[var(--radix-hover-card-trigger-width)] bg-background p-1.5 shadow-sm transition-all duration-240 ease-in-out will-change-[opacity,transform] after:absolute after:left-0 after:top-full after:h-2 after:w-full after:content-[\"\"]',
              profileMenuOpen
                ? 'opacity-100 translate-y-0 scale-100'
                : 'pointer-events-none opacity-0 -translate-y-2 scale-[0.97]',
            )}
            onMouseEnter={() => setProfileMenuOpen(true)}
            onMouseLeave={() => setProfileMenuOpen(false)}
          >
            <div className="flex flex-col gap-1">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/70"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutPending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-500/90 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut className="h-4 w-4" />
                {logoutPending ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </aside>
  );
}
