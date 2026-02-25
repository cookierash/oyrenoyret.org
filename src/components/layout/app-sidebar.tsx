'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Sparkles, BookOpen, AlertCircle, MessageSquare, GraduationCap, LogOut, Settings, Receipt } from 'lucide-react';
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
  };
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/studio', label: 'Oyrenoyret Studio', icon: Sparkles },
  { href: '/catalog', label: 'Catalog', icon: BookOpen },
  { href: '/mistakes', label: 'Mistake library', icon: AlertCircle },
  { href: '/discussions', label: 'Discussions', icon: MessageSquare },
  { href: '/messages', label: 'Messages', icon: Receipt },
  { href: '/academic-record', label: 'Academic record', icon: GraduationCap },
];

import { CREDITS_UPDATED_EVENT } from '@/src/lib/credits-events';

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(user.credits ?? null);

  useEffect(() => {
    setCredits(user.credits ?? null);
  }, [user.credits]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/credits/balance?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const { balance } = await res.json();
        setCredits(balance);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent<{ balance: number }>) => {
      setCredits(e.detail.balance);
      fetchBalance(); // Re-fetch to stay in sync with server
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, handler as EventListener);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, handler as EventListener);
  }, [fetchBalance]);

  // Fetch on navigation (e.g. after publish from editor, user lands here with fresh data)
  useEffect(() => {
    if (pathname) fetchBalance();
  }, [pathname, fetchBalance]);

  // Poll balance when tab is visible (catches external changes e.g. upvotes on your reply)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchBalance();
    }, 5000);
    if (document.visibilityState === 'visible') fetchBalance();
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const displayCredits = credits ?? user.credits ?? 0;

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-full flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Logo size="sm" showText />
        <ThemeToggle className="h-8 w-8 shrink-0" />
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
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Signed in as
        </p>
        <HoverCard openDelay={10} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50">
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
                <p className="truncate text-[10px] text-muted-foreground">
                  {displayCredits != null ? (
                    <span className="font-medium text-primary">
                      {Number(displayCredits).toFixed(2)} credits
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" align="start" className="w-56">
            <div className="flex flex-col gap-3">
              <p className="truncate text-xs font-medium text-muted-foreground">{user.email}</p>
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </HoverCardContent>
        </HoverCard>
        <form action="/api/auth/logout" method="POST" className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
