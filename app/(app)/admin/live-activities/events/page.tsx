/**
 * Events Admin Page
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { EventsAdminPanel } from '@/src/modules/live-activities/admin-panel';

export default async function EventsAdminPage() {
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
        title="Events"
        description="Schedule and manage live events."
      />
      <main className="flex-1 min-h-0 overflow-auto space-y-4 pt-2">
        <EventsAdminPanel />
      </main>
    </DashboardShell>
  );
}
