/**
 * Live Activities Page
 *
 * Problem sprint listings + enrollment flow.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { LiveEventsBoard } from '@/src/modules/live-activities/live-events-board';

export default function LiveActivitiesPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Live Activities"
        description="Register for problem sprints and track your enrolled events."
      />

      <main className="space-y-4 pt-2">
        <LiveEventsBoard />
      </main>
    </DashboardShell>
  );
}
