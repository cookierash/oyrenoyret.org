/**
 * Dashboard Page
 *
 * Student dashboard - minimal placeholder.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';

export default function DashboardPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Dashboard"
        description="Welcome to your learning dashboard."
      />
      <main className="space-y-4" />
    </DashboardShell>
  );
}
