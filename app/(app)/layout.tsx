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
import { AppSidebar } from '@/src/components/layout/app-sidebar';
import { AccountTitle } from '@/src/components/layout/account-title';

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
    },
  });

  if (!user) {
    redirect('/login');
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

  return (
    <div className="min-h-screen bg-background">
      <AccountTitle displayName={displayName} />
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-[1fr_4fr]">
        <AppSidebar
          user={{
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            credits: user.credits != null ? roundCredits(user.credits) : undefined,
          }}
        />
        <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
