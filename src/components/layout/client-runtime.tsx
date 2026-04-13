'use client';

import dynamic from 'next/dynamic';
import { Toaster } from '@/components/ui/sonner';

const ThemeDebugLogger = dynamic(
  () => import('@/src/components/debug/theme-debug-logger').then((m) => m.ThemeDebugLogger),
  { ssr: false },
);

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then((m) => m.Analytics),
  { ssr: false },
);

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights),
  { ssr: false },
);

export function ClientRuntime({
  showThemeDebugLogger,
  showVercelInsights,
}: {
  showThemeDebugLogger: boolean;
  showVercelInsights: boolean;
}) {
  return (
    <>
      {showThemeDebugLogger ? <ThemeDebugLogger /> : null}
      <Toaster />
      {showVercelInsights ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
    </>
  );
}

