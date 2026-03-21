/**
 * Loading Spinner Component
 * 
 * Reusable loading component for dynamic imports.
 */

import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
}
