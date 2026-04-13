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
import { OnlinePresence } from '@/src/components/presence/online-presence';
import { CurrentUserProvider } from '@/src/modules/auth/components/current-user-context';
import { EmailVerificationBanner } from '@/src/modules/auth/components/email-verification-banner';

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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarVariant: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    redirect('/login');
  }
  if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
    redirect('/dashboard');
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <AccountTitle displayName={displayName} />
      <OnlinePresence />
      <CurrentUserProvider
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarVariant: user.avatarVariant,
          role: user.role,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        }}
      >
        {!user.emailVerifiedAt ? (
          <div className="mx-auto w-full max-w-4xl px-4 pt-4">
            <EmailVerificationBanner />
          </div>
        ) : null}
        {children}
      </CurrentUserProvider>
    </div>
  );
}
