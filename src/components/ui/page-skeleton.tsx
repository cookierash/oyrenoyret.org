/**
 * Page Skeleton
 *
 * Reusable skeleton layout matching dashboard pages.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-6 text-foreground animate-fade-up">
      {/* Page header skeleton */}
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64 sm:h-9 sm:w-80" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0" />
      </header>

      {/* Main content skeleton - dashboard-style grid */}
      <main className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        <section className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </section>
        <aside className="space-y-4">
          <CardSkeleton compact />
          <CardSkeleton compact />
        </aside>
      </main>
    </div>
  );
}

function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        {!compact && (
          <>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-9 w-32" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
