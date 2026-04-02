/**
 * Password Input with visibility toggle.
 */

'use client';

import type { ComponentProps } from 'react';
import { useState } from 'react';
import { PiEye as Eye, PiEyeSlash as EyeOff } from 'react-icons/pi';
import { Input } from '@/components/ui/input';
import { cn } from '@/src/lib/utils';

type PasswordInputProps = ComponentProps<typeof Input> & {
  containerClassName?: string;
};

export function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={cn('relative', containerClassName)}>
      <Input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2',
          'text-muted-foreground/80 transition hover:text-foreground'
        )}
        aria-pressed={isVisible}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
