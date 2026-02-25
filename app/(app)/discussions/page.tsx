/**
 * Discussions Page
 *
 * X-like discussions: create, list, reply, vote.
 */

'use client';

import { useState } from 'react';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { CreateDiscussionDialog } from '@/src/modules/discussions/create-discussion-dialog';
import { DiscussionList } from '@/src/modules/discussions/discussion-list';

export default function DiscussionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardShell>
      <PageHeader
        title="Discussions"
        description="Ask questions and discuss with other students."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            Create new discussion
          </Button>
        }
      />

      <main className="space-y-4">
        <DiscussionList refreshKey={refreshKey} />
      </main>

      <CreateDiscussionDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </DashboardShell>
  );
}
