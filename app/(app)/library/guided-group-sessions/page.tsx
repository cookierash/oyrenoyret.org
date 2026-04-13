'use client';

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { useI18n } from '@/src/i18n/i18n-provider';

export default function GuidedGroupSessionsPage() {
  const { messages } = useI18n();
  const copy = messages.app.guidedGroupSessions;

  return (
    <DashboardShell>
      <PageHeader title={copy.title} description={copy.description} />
    </DashboardShell>
  );
}
