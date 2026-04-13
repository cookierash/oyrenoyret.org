/**
 * oyrenoyret studio page
 *
 * Material list. Create new shows options: textual document or practice test.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { MyMaterialsList } from '@/src/modules/materials/my-materials-list';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { PiFileText as FileText, PiClipboardText as ClipboardList } from 'react-icons/pi';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';

export default function StudioPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const { messages } = useI18n();
  const copy = messages.studio.page;
  const { canWrite } = useCurrentUser();

  const refreshList = () => setRefreshKey((k) => k + 1);

  return (
    <DashboardShell className="min-h-[calc(100vh-6rem)]">
      <PageHeader
        title={
          <span className="lowercase">
            <span className="brand-font">oyrenoyret</span> {copy.titleSuffix}
          </span>
        }
        description={copy.description}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            disabled={!canWrite}
          >
            {copy.createButton}
          </Button>
        }
      />

      <main className="flex-1 min-h-0 overflow-auto space-y-4 pt-2" key={refreshKey}>
        <MyMaterialsList onRefresh={refreshList} />
      </main>

      <AlertDialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <AlertDialogContent className="overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.createDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.createDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!canWrite}
              className="group card-frame border bg-muted/30 flex flex-col items-center gap-3 p-6 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-muted/30 disabled:focus:ring-0"
              onClick={() => {
                setShowCreateModal(false);
                router.push('/studio/new');
              }}
            >
              <div className="rounded-full bg-background p-3 shadow-sm ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
                <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="space-y-0.5 text-center">
                <span className="block font-medium">{copy.optionTextTitle}</span>
                <span className="block text-xs text-muted-foreground">
                  {copy.optionTextDescription}
                </span>
              </div>
            </button>
            <button
              type="button"
              disabled={!canWrite}
              className="group card-frame border bg-muted/30 flex flex-col items-center gap-3 p-6 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-muted/30 disabled:focus:ring-0"
              onClick={() => {
                setShowCreateModal(false);
                router.push('/studio/new/practice-test');
              }}
            >
              <div className="rounded-full bg-background p-3 shadow-sm ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
                <ClipboardList className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="space-y-0.5 text-center">
                <span className="block font-medium">{copy.optionPracticeTitle}</span>
                <span className="block text-xs text-muted-foreground">
                  {copy.optionPracticeDescription}
                </span>
              </div>
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
