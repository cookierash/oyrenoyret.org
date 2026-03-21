/**
 * Sprint Layout
 *
 * Dedicated layout for problem sprint workspace.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { AccountTitle } from '@/src/components/layout/account-title';

export default async function SprintLayout({
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
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!user) {
    redirect('/login');
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

  return (
    <div className="min-h-screen bg-background">
      <AccountTitle displayName={displayName} />
      {children}
    </div>
  );
}
