'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-skeleton-shimmer rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
