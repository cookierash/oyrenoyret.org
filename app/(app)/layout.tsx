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
import { roundCredits } from '@/src/modules/credits';
import { AppShell } from '@/src/components/layout/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentSession();
  if (!userId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      credits: true,
      role: true,
      tutorialCompletedAt: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
  const isStaff = user.role === 'ADMIN' || user.role === 'TEACHER';
  const showTutorial = !isStaff && !user.tutorialCompletedAt;
  return (
    <AppShell
      displayName={displayName}
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        credits: user.credits != null ? roundCredits(user.credits) : undefined,
        role: user.role,
      }}
      showTutorial={showTutorial}
    >
      {children}
    </AppShell>
  );
}
