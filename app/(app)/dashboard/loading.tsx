import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="card-frame bg-card p-4">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="rounded-3xl bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-6 md:grid-cols-[1fr_3fr_1fr] md:items-center">
              <div className="flex items-center gap-4 md:flex-col md:items-start">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <Skeleton className="h-3 w-6 rounded-full" />
                      <Skeleton className="h-10 w-10 rounded-full sm:h-11 sm:w-11" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:text-right">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card-frame border-dashed bg-muted/20 px-4 py-3 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card-frame border-dashed bg-muted/20 px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
