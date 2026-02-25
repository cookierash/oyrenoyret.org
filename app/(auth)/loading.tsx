/**
 * Auth Loading
 *
 * Shown while auth pages (login, register) are loading.
 */

import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <div className="w-full max-w-md animate-fade-up space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
