'use client';

import { useTheme } from 'next-themes';
import { PiMoon as Moon, PiSun as Sun } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const getCurrentTheme = () => {
    if (resolvedTheme) return resolvedTheme;
    if (theme && theme !== 'system') return theme;
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => {
        const currentTheme = getCurrentTheme();
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
      }}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
