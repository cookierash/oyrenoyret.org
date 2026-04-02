/**
 * Messages Page
 *
 * Lists credit transactions: usage (spending) and gain (earning).
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { MessagesClient } from '@/src/modules/messages/messages-client';

export const metadata = {
  title: 'Messages',
};

export default function MessagesPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Messages"
        description="Your notifications and credit activity."
      />

      <main className="space-y-4 pt-2">
        <MessagesClient />
      </main>
    </DashboardShell>
  );
}
