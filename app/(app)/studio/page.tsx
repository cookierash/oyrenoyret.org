/**
 * Oyrenoyret Studio Page
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
import { FileText, ClipboardList } from 'lucide-react';

export default function StudioPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  const refreshList = () => setRefreshKey((k) => k + 1);

  return (
    <DashboardShell>
      <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[500px]">
        <PageHeader
          title="Oyrenoyret Studio"
          description="Create and publish learning materials. Materials appear under topics in the catalog."
          actions={
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              Create new material
            </Button>
          }
        />

        <div className="flex-1 overflow-auto pt-4" key={refreshKey}>
          <MyMaterialsList onRefresh={refreshList} />
        </div>
      </div>

      <AlertDialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <AlertDialogContent className="max-w-md p-0 overflow-hidden">
          <div className="p-5 pb-2">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Create new material</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5">
                Choose the type of material you want to create. You can edit and publish it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 pt-3">
            <button
              type="button"
              className="group flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-muted/30 p-6 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              onClick={() => {
                setShowCreateModal(false);
                router.push('/studio/new');
              }}
            >
              <div className="rounded-full bg-background p-3 shadow-sm ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
                <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="space-y-0.5 text-center">
                <span className="block font-medium">Textual document</span>
                <span className="block text-xs text-muted-foreground">
                  Notes, summaries, study guides
                </span>
              </div>
            </button>
            <button
              type="button"
              className="group flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-muted/30 p-6 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              onClick={() => {
                setShowCreateModal(false);
                router.push('/studio/new/practice-test');
              }}
            >
              <div className="rounded-full bg-background p-3 shadow-sm ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
                <ClipboardList className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="space-y-0.5 text-center">
                <span className="block font-medium">Practice test</span>
                <span className="block text-xs text-muted-foreground">
                  Multiple-choice questions
                </span>
              </div>
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
