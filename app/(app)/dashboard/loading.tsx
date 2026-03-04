import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-8 animate-pulse">
            {/* Greeting */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-80" />
            </div>

            {/* Live Activities Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-14 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <div className="flex gap-3">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Materials Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-4 w-28" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-10 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-3 w-1/3" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
