'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/src/lib/utils';
import { PartnersMarquee } from '@/src/components/landing/partners-marquee';

interface PartnerLogo {
  src: string;
  name: string;
}

interface StickyPartnersBarProps {
  partners: PartnerLogo[];
}

export function StickyPartnersBar({ partners }: StickyPartnersBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [isDocked, setIsDocked] = useState(true);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const updateHeight = () => {
      setBarHeight(bar.getBoundingClientRect().height);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateDocked = () => {
      if (window.innerWidth < 768) {
        setIsDocked(false);
        return;
      }
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorTop = anchor.getBoundingClientRect().top;
      const viewportBottom = window.innerHeight;
      const shouldDock = anchorTop > viewportBottom - barHeight;
      setIsDocked(shouldDock);
    };

    updateDocked();
    window.addEventListener('scroll', updateDocked, { passive: true });
    window.addEventListener('resize', updateDocked);
    return () => {
      window.removeEventListener('scroll', updateDocked);
      window.removeEventListener('resize', updateDocked);
    };
  }, [barHeight]);

  return (
    <div className="relative w-full">
      <div
        ref={anchorRef}
        aria-hidden="true"
        style={{ height: isDocked ? barHeight : 0 }}
      />
      <div
        ref={barRef}
        className={cn(
          'w-full',
          isDocked ? 'fixed inset-x-0 bottom-0 z-30' : 'relative z-20',
        )}
      >
        <div className="w-full bg-background py-4">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
            <PartnersMarquee partners={partners} />
          </div>
        </div>
      </div>
    </div>
  );
}
