import { Skeleton } from '@/components/ui/skeleton';

export default function DiscussionsLoading() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 animate-pulse">
            {/* Main Feed */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-60" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-full" />
                </div>
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex gap-3 p-4">
                            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-full" />
                                <div className="flex gap-4 pt-1">
                                    <Skeleton className="h-3 w-12" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="hidden lg:block space-y-6">
                <div className="rounded-xl border border-border p-5 space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-3 w-full" />
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-border p-5 space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="space-y-1">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
