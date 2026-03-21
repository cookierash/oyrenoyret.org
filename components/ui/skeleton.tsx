'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
}

function Skeleton({
  className,
  animate = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        animate ? 'skeleton-sheen' : 'bg-muted/40',
        'rounded-md',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
