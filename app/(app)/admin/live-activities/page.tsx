/**
 * Live Activities Admin Page
 *
 * Manage problem sprints and announcements.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { LiveActivitiesAdminPanel } from '@/src/modules/live-activities/admin-panel';

export default async function LiveActivitiesAdminPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !isStaff(user.role)) {
    redirect('/dashboard');
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Live Activities Admin"
        description="Create and manage problem sprints and announcements."
      />
      <main className="space-y-4 pt-2">
        <LiveActivitiesAdminPanel />
      </main>
    </DashboardShell>
  );
}
