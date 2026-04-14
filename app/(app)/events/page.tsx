/**
 * Events Page
 *
 * Problem sprint + live event listings + enrollment flow.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { LiveEventsBoard } from '@/src/modules/events/live-events-board';
import { getI18n } from '@/src/i18n/server';

export default async function EventsPage() {
  const { messages } = await getI18n();
  const copy = messages.app.liveActivities;
  return (
    <DashboardShell>
      <PageHeader title={copy.title} description={copy.description} />
      <main className="space-y-4 pt-2">
        <LiveEventsBoard />
      </main>
    </DashboardShell>
  );
}

