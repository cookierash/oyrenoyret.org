/**
 * Settings Page
 *
 * User account and preferences.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';

export default function SettingsPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences."
      />
      <main className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Settings options will be available here.
        </p>
      </main>
    </DashboardShell>
  );
}
