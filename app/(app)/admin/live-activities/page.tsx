/**
 * Manage Live Activities Page
 *
 * Jump into problem sprints, announcements, and events management.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PiCalendar as CalendarDays, PiChatCircle as MessageSquare, PiSparkle as Sparkles } from 'react-icons/pi';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';

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
        title="Manage live activities"
        description="Create and manage problem sprints, announcements, and events."
      />
      <main className="flex-1 min-h-0 overflow-auto space-y-4 pt-2">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Problem Sprint
              </div>
              <p className="text-sm text-muted-foreground">
                Schedule timed competitions and manage upcoming sprint slots.
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/live-activities/problem-sprints">Manage sprints</Link>
            </Button>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Announcements
              </div>
              <p className="text-sm text-muted-foreground">
                Publish updates that appear in the live activities sidebar.
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/live-activities/announcements">Manage announcements</Link>
            </Button>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Events
              </div>
              <p className="text-sm text-muted-foreground">
                Organize one-off events and live sessions for the community.
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/live-activities/events">Manage events</Link>
            </Button>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
