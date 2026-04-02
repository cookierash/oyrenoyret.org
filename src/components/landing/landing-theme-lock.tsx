'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

export function LandingThemeLock() {
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (previousTheme.current === undefined) {
      previousTheme.current = theme;
    }
    if (theme !== 'light') {
      setTheme('light');
    }

    const root = document.documentElement;
    root.classList.add('light');
    root.classList.remove('dark');
  }, [setTheme, theme]);

  useEffect(() => {
    return () => {
      if (previousTheme.current) {
        setTheme(previousTheme.current);
      }
    };
  }, [setTheme]);

  return null;
}
