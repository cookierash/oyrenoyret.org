import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getI18n } from '@/src/i18n/server';
import { GuidedGroupSessionsClient } from '@/src/modules/guided-group-sessions/guided-group-sessions-client';

function getAgeYears(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;
  const now = new Date();
  let years = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    years -= 1;
  }
  return Number.isFinite(years) && years >= 0 ? years : null;
}

export default async function GuidedGroupSessionsPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const { messages } = await getI18n();
  const copy = messages.app.guidedGroupSessions;

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        parentFirstName: true,
        parentLastName: true,
        parentEmail: true,
        dateOfBirth: true,
        email: true,
        grade: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        grade: true,
      },
    });
  }

  return (
    <DashboardShell>
      <PageHeader title={copy.title} description={copy.description} />
      <main className="space-y-4 pt-2">
        <GuidedGroupSessionsClient
          profile={{
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            parentFirstName: user?.parentFirstName ?? null,
            parentLastName: user?.parentLastName ?? null,
            ageYears: getAgeYears(user?.dateOfBirth ?? null),
            email: user?.email ?? '',
            parentEmail: user?.parentEmail ?? null,
            grade: user?.grade ?? null,
          }}
        />
      </main>
    </DashboardShell>
  );
}
