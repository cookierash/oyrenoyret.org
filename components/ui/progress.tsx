'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          'relative h-2.5 w-full overflow-hidden rounded-full bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-primary shadow-3d-raised transition-[width] duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
