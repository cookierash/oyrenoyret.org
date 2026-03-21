/**
 * Auth Loading
 *
 * Shown while auth pages (login, register) are loading.
 */

import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-md animate-fade-up space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
