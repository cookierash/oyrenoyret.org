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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user?.role || !isStaff(user.role)) {
    redirect('/dashboard');
  }

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

