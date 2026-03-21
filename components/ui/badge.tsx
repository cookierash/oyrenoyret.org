'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

/**
 * Badge variants – use semantically:
 *
 * - default:   Primary accent (featured tags, highlights)
 * - secondary: Neutral/info (role labels, status)
 * - success:   Success/positive (completed, verified)
 * - outline:   Subtle/neutral (optional labels)
 */
export type BadgeVariant = 'default' | 'secondary' | 'success' | 'outline';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    'bg-primary/10 text-primary font-medium border border-primary/15',
  secondary:
    'bg-secondary text-secondary-foreground border border-border/70',
  success:
    'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20',
  outline:
    'bg-transparent text-foreground border border-border/70',
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
          'transition-colors',
          badgeVariants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
