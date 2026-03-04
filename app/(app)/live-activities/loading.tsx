import { Skeleton } from '@/components/ui/skeleton';

export default function LiveActivitiesLoading() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="space-y-2">
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                        <div className="flex gap-3 pt-1">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
