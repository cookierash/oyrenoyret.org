'use client';

import { useEffect, useRef } from 'react';

export function OnlinePresence({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;

    const touch = async () => {
      if (!active) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await fetch('/api/online-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
      } catch {
        // Ignore network errors; presence is best-effort.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Initial touch + periodic heartbeat.
    touch();
    intervalRef.current = window.setInterval(touch, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') touch();
    };

    window.addEventListener('focus', touch);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      window.removeEventListener('focus', touch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return null;
}

