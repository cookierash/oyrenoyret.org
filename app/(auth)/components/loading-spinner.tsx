/**
 * Loading Spinner Component
 * 
 * Reusable loading component for dynamic imports.
 */

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-neutral-600">{message}</p>
      </div>
    </div>
  );
}
