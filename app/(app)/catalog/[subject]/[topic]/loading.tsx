import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { TopicMaterialsSkeleton } from '@/src/modules/materials/topic-materials-skeleton';

export default function TopicLoading() {
  return (
    <DashboardShell>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
        <div className="h-px w-full bg-border/70" />
      </div>

      <main className="space-y-4 pt-2">
        <TopicMaterialsSkeleton />
      </main>
    </DashboardShell>
  );
}
