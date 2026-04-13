import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesSkeleton } from '@/src/modules/messages/messages-skeleton';

export default function NotificationsLoading() {
  return (
    <DashboardShell>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <div className="h-px w-full bg-border/70" />
      </div>

      <main className="space-y-4 pt-2">
        <MessagesSkeleton />
      </main>
    </DashboardShell>
  );
}
