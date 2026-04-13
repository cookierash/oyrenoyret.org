/**
 * Manage Interactive Sessions Page
 *
 * Unified management for problem sprints, announcements, and events.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { InteractiveSessionsAdminHub } from '@/src/modules/interactive-sessions/interactive-sessions-admin-hub';
import { getI18n } from '@/src/i18n/server';

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

  const { messages } = await getI18n({ locale: 'en' });
  const title = messages.pages.manageLiveActivities;
  const description = messages.admin.interactiveSessionsManageDescription;

  return (
    <DashboardShell>
      <PageHeader
        title={title}
        description={description}
      />
      <main className="space-y-4 pt-2">
        <InteractiveSessionsAdminHub />
      </main>
    </DashboardShell>
  );
}
