'use client';

import { cn } from '@/src/lib/utils';
import { PiStar as Star, PiStarFill as StarFill } from 'react-icons/pi';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  sizeClass?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function StarRating({
  value,
  onChange,
  max = 5,
  sizeClass = 'h-4 w-4',
  disabled = false,
  className,
  ariaLabel,
}: StarRatingProps) {
  const interactive = typeof onChange === 'function' && !disabled;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={ariaLabel}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1;
        const filled = safeValue >= starValue;
        const Icon = filled ? StarFill : Star;
        return (
          <button
            key={starValue}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(starValue)}
            className={cn(
              'rounded-sm text-amber-500 transition-colors',
              interactive ? 'hover:text-amber-600' : 'cursor-default',
              !interactive && 'pointer-events-none',
            )}
            aria-label={interactive ? `Rate ${starValue} star${starValue === 1 ? '' : 's'}` : undefined}
          >
            <Icon className={sizeClass} />
          </button>
        );
      })}
    </div>
  );
}

