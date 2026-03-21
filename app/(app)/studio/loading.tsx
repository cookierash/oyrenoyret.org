import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudioLoading() {
  return (
    <DashboardShell className="min-h-[calc(100vh-6rem)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="h-px w-full bg-border/70" />
      </div>

      <main className="flex-1 min-h-0 overflow-auto space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex-1">
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="card-frame bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-7 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
