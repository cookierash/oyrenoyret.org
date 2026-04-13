/**
 * Admin Home
 *
 * Groups admin tools and shortcuts.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PiCalendar as CalendarDays, PiBookOpen as BookOpen, PiWarningCircle as WarningCircle, PiChatCircle as MessageSquare, PiUsersThree as UsersThree } from 'react-icons/pi';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/src/i18n/server';

export default async function AdminPage() {
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
  const copy = messages.pages;
  const adminCopy = messages.admin;

  return (
    <DashboardShell>
      <PageHeader
        title={copy.admin}
        description={adminCopy.homeDescription}
      />
      <main className="space-y-4 pt-2">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {messages.sidebar.liveActivities}
              </div>
              <p className="text-sm text-muted-foreground">
                {adminCopy.interactiveSessionsCardDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary-primary" asChild>
                <Link href="/admin/interactive-sessions">{adminCopy.open}</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/interactive-sessions?tab=sprints">{adminCopy.sprints}</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/interactive-sessions?tab=announcements">
                  {adminCopy.announcements}
                </Link>
              </Button>
            </div>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <UsersThree className="h-4 w-4" />
                {messages.sidebar.guidedGroupSessions}
              </div>
              <p className="text-sm text-muted-foreground">
                {adminCopy.guidedGroupSessionsCardDescription ?? 'Review facilitator applications and guided sessions.'}
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/guided-group-sessions">{adminCopy.open}</Link>
            </Button>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                {messages.sidebar.curriculum}
              </div>
              <p className="text-sm text-muted-foreground">
                {adminCopy.curriculumCardDescription}
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/curriculum">{adminCopy.open}</Link>
            </Button>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <WarningCircle className="h-4 w-4" />
                {messages.sidebar.reports}
              </div>
              <p className="text-sm text-muted-foreground">
                {adminCopy.reportsCardDescription}
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/reports">{adminCopy.open}</Link>
            </Button>
          </div>

          <div className="card-frame bg-card p-5 flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {messages.sidebar.contactMessages}
              </div>
              <p className="text-sm text-muted-foreground">
                {adminCopy.messagesCardDescription}
              </p>
            </div>
            <Button size="sm" variant="secondary-primary" asChild>
              <Link href="/admin/messages">{adminCopy.open}</Link>
            </Button>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
