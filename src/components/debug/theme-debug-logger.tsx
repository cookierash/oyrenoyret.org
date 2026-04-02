/**
 * Theme Debug Logger
 *
 * Logs current CSS theme variables and document classes at runtime
 * to help diagnose background/foreground mismatches.
 */

'use client';

import { useEffect } from 'react';

export function ThemeDebugLogger() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_THEME_DEBUG_INGEST !== 'true') return;
    try {
      const root = document.documentElement;
      const body = document.body;
      const styles = getComputedStyle(root);
      const bodyStyles = getComputedStyle(body);

      const background = styles.getPropertyValue('--background').trim();
      const foreground = styles.getPropertyValue('--foreground').trim();
      const card = styles.getPropertyValue('--card').trim();
      const cardForeground = styles.getPropertyValue('--card-foreground').trim();

      const payload = {
        id: `log_${Date.now()}_theme`,
        timestamp: Date.now(),
        location: 'theme-debug-logger.tsx:26',
        message: 'Theme variables at runtime',
        runId: 'pre-fix',
        hypothesisId: 'theme-colors',
        data: {
          htmlClass: root.className,
          bodyClass: body.className,
          background,
          foreground,
          card,
          cardForeground,
          bodyBackgroundColor: bodyStyles.backgroundColor,
          bodyColor: bodyStyles.color,
        },
      };

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d3ba0d6d-c748-4556-86da-ecaea3aa688e', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
      // #endregion
    } catch {
      // Swallow errors: debug-only
    }
  }, []);

  return null;
}
