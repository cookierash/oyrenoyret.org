/**
 * Admin contact messages page
 *
 * Shows messages submitted from /contact.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !isStaff(user.role)) {
    redirect('/dashboard');
  }

  const messages = await prisma.contactMessage.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: {
        select: {
          publicId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Contact Messages"
        description="Messages submitted from the public contact page."
      />

      <main className="pt-2">
        {messages.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">No messages yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              New messages from the contact page will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const senderName =
                message.name ||
                [message.user?.firstName, message.user?.lastName].filter(Boolean).join(' ') ||
                null;
              const senderEmail = message.email || message.user?.email || '—';
              return (
                <article key={message.id} className="card-frame bg-card p-5">
                  <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {message.subject || 'No subject'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {senderName ? `${senderName} • ` : ''}
                        {senderEmail}
                        {message.user?.publicId ? ` • ${message.user.publicId}` : ''}
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {message.createdAt.toLocaleString('en-US')}
                    </time>
                  </header>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                    {message.message}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
