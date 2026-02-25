/**
 * DashboardShell
 *
 * Shared layout container for student, parent, and admin dashboards.
 * Keeps a consistent, card-based layout with a max width and generous whitespace.
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
}

export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-full flex-col gap-4 text-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

