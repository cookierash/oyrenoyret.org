/**
 * Guided Group Sessions Admin Page
 *
 * Facilitator applications review (staff only).
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { FacilitatorApplicationsAdminPanel } from '@/src/modules/guided-group-sessions/facilitator-applications-admin-panel';
import { getI18n } from '@/src/i18n/server';

export default async function AdminGuidedGroupSessionsPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  let userRole: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    userRole = user?.role ?? null;
  } catch (error) {
    console.error('Failed to load staff role for guided group sessions admin page:', error);
    const { messages } = await getI18n({ locale: 'en' }).catch(() => ({ messages: {} as any }));
    return (
      <DashboardShell>
        <PageHeader
          title={messages.pages?.guidedGroupSessions ?? 'Guided group sessions'}
          description={messages.admin?.guidedGroupSessionsDescription ?? 'Review facilitator applications.'}
        />
        <main className="space-y-4 pt-2">
          <div className="card-frame border-dashed bg-muted/20 px-5 py-10">
            <p className="text-sm font-medium text-foreground">Unable to load this page right now.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              This is usually caused by a temporary database connectivity issue. Please try again later.
            </p>
          </div>
        </main>
      </DashboardShell>
    );
  }

  if (!userRole || !isStaff(userRole as any)) redirect('/dashboard');

  const { messages } = await getI18n({ locale: 'en' });

  return (
    <DashboardShell>
      <PageHeader
        title={messages.pages.guidedGroupSessions ?? 'Guided group sessions'}
        description={messages.admin.guidedGroupSessionsDescription ?? 'Review facilitator applications.'}
      />
      <main className="space-y-4 pt-2">
        <FacilitatorApplicationsAdminPanel />
      </main>
    </DashboardShell>
  );
}
