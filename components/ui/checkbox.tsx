'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary',
            'bg-background transition-all duration-200',
            'peer-focus-visible:ring-0',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground',
            className
          )}
        >
          <Check
            className={cn(
              'h-2.5 w-2.5 stroke-[3] transition-opacity',
              checked ? 'opacity-100' : 'opacity-0'
            )}
          />
        </span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
