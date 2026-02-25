/**
 * Editor Layout
 *
 * Full-screen layout for document editing. No sidebar.
 * Used for /studio/new and /studio/[id].
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { AccountTitle } from '@/src/components/layout/account-title';

export default async function EditorLayout({
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
    <div className="fixed inset-0 z-50 bg-background">
      <AccountTitle displayName={displayName} />
      {children}
    </div>
  );
}
