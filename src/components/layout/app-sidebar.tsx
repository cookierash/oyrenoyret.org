'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Sparkles, BookOpen, Library, CalendarDays, MessageSquare, GraduationCap, LogOut, Settings, Receipt, X, ShieldCheck } from 'lucide-react';
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
  { href: '/messages', label: 'Messages', icon: Receipt },
  { href: '/academic-record', label: 'Academic record', icon: GraduationCap },
];

import { CREDITS_UPDATED_EVENT } from '@/src/lib/credits-events';

export function AppSidebar({ user, className, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(user.credits ?? null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-screen w-full flex-col border-r border-border bg-background',
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
        {navItems.map((item) => {
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
        })}
        {isStaff ? (
          <div className="mt-4 border-t border-border/70 pt-3">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </p>
            <Link
              href="/admin/live-activities"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                pathname === '/admin/live-activities'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Live activities
            </Link>
          </div>
        ) : null}
      </nav>

      <div className="mx-3 mb-3 rounded-md border border-primary/20 bg-primary/10 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
          Credits
        </p>
        <p className="mt-1 text-sm font-semibold text-primary">
          {Number(displayCredits).toFixed(2)} credits
        </p>
      </div>

      <div className="border-t border-border p-3">
        <HoverCard
          openDelay={10}
          closeDelay={100}
          open={profileMenuOpen}
          onOpenChange={setProfileMenuOpen}
        >
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
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
            className={cn(
              'w-52 rounded-md border border-border/70 bg-popover p-1 shadow-sm transition-opacity duration-220 ease-out',
              profileMenuOpen
                ? 'opacity-100'
                : 'pointer-events-none opacity-0',
            )}
            onMouseEnter={() => setProfileMenuOpen(true)}
            onMouseLeave={() => setProfileMenuOpen(false)}
          >
            <div
              className={cn(
                'origin-bottom-left transition-transform duration-220 ease-out',
                profileMenuOpen
                  ? 'scale-100 translate-y-0'
                  : 'scale-[0.95] -translate-y-2',
              )}
            >
              <div className="flex flex-col gap-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-500/90 transition-colors hover:bg-red-500/10 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </aside>
  );
}
