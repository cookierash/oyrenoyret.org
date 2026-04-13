'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/src/lib/utils';
import { getAvatarSrc, getStableAvatarVariant, isAvatarVariant } from '@/src/lib/avatar';
import { useOptionalCurrentUser } from '@/src/modules/auth/components/current-user-context';

type PublicUser = {
  id: string;
  publicId: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarVariant: string | null;
  role: string | null;
};

const userCache = new Map<string, PublicUser>();

function getDisplayName(user: { firstName?: string | null; lastName?: string | null }, fallback: string) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

export function UserHoverCard({
  lookupId,
  fallbackName,
  avatarVariant,
  href,
  children,
  className,
}: {
  lookupId?: string | null;
  fallbackName: string;
  avatarVariant?: string | null;
  href?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const currentUserCtx = useOptionalCurrentUser();
  const currentUser = currentUserCtx?.user;

  const initialUser = useMemo<PublicUser | null>(() => {
    if (!lookupId) return null;
    if (currentUser && (lookupId === currentUser.id || (currentUser.publicId && lookupId === currentUser.publicId))) {
      return {
        id: currentUser.id,
        publicId: currentUser.publicId ?? null,
        firstName: currentUser.firstName ?? null,
        lastName: currentUser.lastName ?? null,
        avatarVariant: currentUser.avatarVariant ?? null,
        role: currentUser.role ?? null,
      };
    }
    return userCache.get(lookupId) ?? null;
  }, [lookupId, currentUser]);

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lookupId) return;
    if (!initialUser) return;
    setUser(initialUser);
  }, [lookupId, initialUser]);

  const resolvedHref = href ?? (lookupId ? `/u/${lookupId}` : null);
  const resolvedName = getDisplayName(user ?? {}, fallbackName);
  const resolvedAvatarVariant = avatarVariant ?? user?.avatarVariant ?? null;
  const finalVariant = isAvatarVariant(resolvedAvatarVariant)
    ? resolvedAvatarVariant
    : getStableAvatarVariant(lookupId ?? resolvedName);
  const avatarSrc = getAvatarSrc(finalVariant);

  const maybeFetch = async () => {
    if (!lookupId) return;
    if (loading) return;
    const cached = userCache.get(lookupId);
    if (cached) {
      setUser(cached);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/public/${encodeURIComponent(lookupId)}`, { credentials: 'include' });
      const payload = (await res.json().catch(() => ({}))) as { success?: boolean; user?: PublicUser };
      if (res.ok && payload.success && payload.user) {
        userCache.set(lookupId, payload.user);
        setUser(payload.user);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <HoverCard
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void maybeFetch();
      }}
    >
      <HoverCardTrigger asChild>
        <span className={cn('inline-flex', className)}>{children}</span>
      </HoverCardTrigger>
      <HoverCardContent sideOffset={8} className="w-72">
        <div className="flex items-start gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt=""
              className="h-full w-full object-cover"
              decoding="async"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{resolvedName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {loading ? 'Loading profile…' : user?.role ? user.role : 'User'}
                </p>
              </div>
              {resolvedHref ? (
                <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
                  <Link href={resolvedHref}>View</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
