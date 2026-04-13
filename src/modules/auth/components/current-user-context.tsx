'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

type CurrentUser = {
  id: string;
  publicId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarVariant?: string | null;
  role?: string | null;
  emailVerifiedAt?: string | null;
  status?: string | null;
  suspensionUntil?: string | null;
  bannedAt?: string | null;
};

type CurrentUserContextValue = {
  user: CurrentUser;
  requiresEmailVerification: boolean;
  canWrite: boolean;
  writeRestriction: null | 'emailNotVerified' | 'accountSuspended' | 'accountBanned';
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  const value = useMemo<CurrentUserContextValue>(() => {
    const requiresEmailVerification = !user.emailVerifiedAt;
    const status = user.status ?? null;
    const writeRestriction: CurrentUserContextValue['writeRestriction'] =
      status === 'BANNED'
        ? 'accountBanned'
        : status === 'SUSPENDED'
          ? 'accountSuspended'
          : requiresEmailVerification
            ? 'emailNotVerified'
            : null;
    return {
      user,
      requiresEmailVerification,
      canWrite: writeRestriction === null,
      writeRestriction,
    };
  }, [user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider');
  }
  return ctx;
}

export function useOptionalCurrentUser() {
  return useContext(CurrentUserContext);
}
