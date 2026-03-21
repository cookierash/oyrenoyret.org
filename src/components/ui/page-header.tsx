/**
 * PageHeader
 *
 * Shared header for pages and dashboards.
 * Inspired by brilliant.org: strong title, calm subheading, optional actions.
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <header
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
      >
        <div className="space-y-1.5">
          {badge && <div className="text-xs text-muted-foreground">{badge}</div>}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="h-px w-full bg-border/70" />
    </div>
  );
}
