/**
 * Notifications Page
 *
 * Lists notifications and credit activity.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { MessagesClient } from '@/src/modules/messages/messages-client';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Notifications',
};

export default async function NotificationsPage() {
  const { messages } = await getI18n();
  const copy = messages.app.notifications;
  return (
    <DashboardShell>
      <PageHeader title={copy.title} description={copy.description} />

      <main className="space-y-4 pt-2">
        <MessagesClient />
      </main>
    </DashboardShell>
  );
}
