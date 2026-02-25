/**
 * Main Loading
 *
 * Shown while landing page is loading.
 */

import { Skeleton } from '@/components/ui/skeleton';

export default function MainLoading() {
  return (
    <main className="min-h-screen animate-fade-up">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-96 max-w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </main>
  );
}
