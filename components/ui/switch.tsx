'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          'inline-flex cursor-pointer select-none items-center',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />

        <span
          className={cn(
            // Apple-like: larger pill, bright green when on, white thumb with shadow.
            'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full',
            'bg-zinc-300/80 shadow-inner ring-1 ring-black/5',
            'transition-colors duration-300 ease-in-out motion-reduce:transition-none',
            'hover:bg-zinc-300 peer-checked:hover:bg-primary/90',
            'peer-checked:bg-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/25 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            'peer-active:brightness-95',
            // Equal padding around thumb: 1px left/right and 1px top/bottom.
            'peer-checked:[&_.switch-thumb]:translate-x-[18px]',
            className,
          )}
        >
          <span
            className={cn(
              // Smaller thumb with even 2px padding inside a 22px track.
              'switch-thumb pointer-events-none inline-block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white',
              'shadow-[0_2px_6px_rgba(0,0,0,0.18),0_1px_1px_rgba(0,0,0,0.10)]',
              'transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform motion-reduce:transition-none',
              'peer-active:scale-[0.97]',
            )}
          />
        </span>
      </label>
    );
  },
);

Switch.displayName = 'Switch';

export { Switch };
