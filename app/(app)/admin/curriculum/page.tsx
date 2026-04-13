/**
 * Curriculum Admin Page
 *
 * Manage subjects and topics (CRUD + renames).
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { CurriculumAdminPanel } from '@/src/modules/curriculum/admin-panel';
import { getI18n } from '@/src/i18n/server';

export default async function CurriculumAdminPage() {
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

  return (
    <DashboardShell>
      <PageHeader
        title={messages.pages.curriculum}
        description={messages.admin.curriculumDescription}
      />
      <main className="space-y-4 pt-2">
        <CurriculumAdminPanel />
      </main>
    </DashboardShell>
  );
}
