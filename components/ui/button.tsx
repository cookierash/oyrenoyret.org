'use client';

import * as React from 'react';
import { cn } from '@/src/lib/utils';

/**
 * Button variants – use semantically:
 *
 * - primary:   Main CTAs (submit, sign up, continue, primary actions)
 * - secondary: Secondary actions (view more, less prominent)
 * - outline:   Tertiary/cancel/back (previous, alternative options)
 * - ghost:     Minimal/inline (inside cards, subtle, no border)
 * - danger:    Dangerous actions (delete, remove, irreversible)
 * - destructive: Alias of `danger` for compatibility
 * - success:   Success/completion (confirm, done)
 * - link:      Text-only links (resend, inline navigation)
 * - secondary-primary: Primary-tinted secondary (back/catalog nav: primary text, pastel primary bg)
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'secondary-primary';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Primary: solid blue, white text, 3D raised
  primary:
    'bg-primary text-primary-foreground border border-primary/30 btn-3d hover:bg-primary/90',
  // Secondary: light background, 3D raised
  secondary:
    'bg-secondary text-secondary-foreground border border-border btn-3d hover:bg-secondary/80',
  // Outline: bordered, 3D raised
  outline:
    'border border-input bg-background btn-3d hover:bg-accent hover:text-accent-foreground',
  // Ghost: minimal, no 3D
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  // Danger / destructive: red, 3D raised
  danger:
    'bg-destructive text-destructive-foreground border border-destructive/30 btn-3d hover:bg-destructive/90',
  destructive:
    'bg-destructive text-destructive-foreground border border-destructive/30 btn-3d hover:bg-destructive/90',
  // Secondary-primary: primary-colored text, pastel primary background (back/catalog nav)
  'secondary-primary':
    'bg-primary/15 text-primary border-0 hover:bg-primary/25 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 rounded-md px-2 py-1.5 text-xs',
  md: 'h-8 rounded-md px-2.5 py-1.5 text-sm',
  lg: 'h-9 rounded-md px-3 py-2 text-sm',
  icon: 'h-8 w-8 shrink-0 p-0',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:shrink-0';

    const styles = cn(base, variantStyles[variant], sizeStyles[size], className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(styles, child.props.className),
      });
    }

    return (
      <button
        ref={ref}
        className={styles}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
