/**
 * Recent Activities Page
 *
 * Lists notifications and credit activity.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { MessagesClient } from '@/src/modules/messages/messages-client';

export const metadata = {
  title: 'Recent Activities',
};

export default function RecentActivitiesPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Recent Activities"
        description="Your latest notifications and credit activity."
      />

      <main className="space-y-4 pt-2">
        <MessagesClient />
      </main>
    </DashboardShell>
  );
}
