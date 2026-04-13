/**
 * App Layout
 *
 * Sidebar layout for authenticated pages. No header.
 * Redirects to /login if not authenticated.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { roundCredits } from '@/src/modules/credits';
import { AppShell } from '@/src/components/layout/app-shell';
import { AVATAR_VARIANTS, type AvatarVariant } from '@/src/lib/avatar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentSession();
  if (!userId) {
    redirect('/login');
  }

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        email: true,
        credits: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        tutorialCompletedAt: true,
        suspensionUntil: true,
        suspensionReason: true,
        bannedAt: true,
        banReason: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    // Safe rollout fallback: allow app shell to render even if moderation columns are not migrated yet.
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        email: true,
        credits: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        tutorialCompletedAt: true,
      },
    });
  }

  if (!user) {
    redirect('/login');
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
  const isStaff = user.role === 'ADMIN' || user.role === 'TEACHER';
  const showTutorial = !isStaff && !user.tutorialCompletedAt;
  const avatarVariant: AvatarVariant = AVATAR_VARIANTS.includes(user.avatarVariant as AvatarVariant)
    ? (user.avatarVariant as AvatarVariant)
    : 'regular';

  const gatedChildren =
    user.status === 'BANNED' ? (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="text-2xl font-semibold text-foreground">Access restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is banned and cannot access the platform content.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If you think it is unfair, contact support via <a className="underline underline-offset-4" href="/contact">/contact</a>.
        </p>
      </div>
    ) : (
      children
    );
  return (
    <AppShell
      displayName={displayName}
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarVariant,
        email: user.email,
        credits: user.credits != null ? roundCredits(user.credits) : undefined,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        suspensionUntil: user.suspensionUntil ? user.suspensionUntil.toISOString() : null,
        suspensionReason: user.suspensionReason ?? null,
        bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
        banReason: user.banReason ?? null,
      }}
      showTutorial={showTutorial}
    >
      {gatedChildren}
    </AppShell>
  );
}
