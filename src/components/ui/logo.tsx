'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/src/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md';
  showText?: boolean;
  /** Font size for text: 'sm' (sidebar), 'lg' (header) */
  textSize?: 'sm' | 'lg';
  /** Preload logo for above-the-fold usage (header/sidebar). */
  priority?: boolean;
}

const sizeMap = {
  sm: { w: 32, h: 32 },
  md: { w: 40, h: 40 },
};

export function Logo({ className, size = 'sm', showText = false, textSize = 'sm', priority = false }: LogoProps) {
  const { w, h } = sizeMap[size];

  if (showText) {
    return (
      <Link
        href="/"
        className={cn(
          'inline-flex items-center gap-2',
          textSize === 'sm' && 'text-sm',
          textSize === 'lg' && 'text-lg',
          className
        )}
        aria-label="oyrenoyret home"
      >
        <Image
          src="/oyrenoyretlogo.svg"
          alt="oyrenoyret"
          width={w}
          height={h}
          className="logo-mark h-[1.5em] w-[1.5em] shrink-0"
          priority={priority}
        />
        <span className="brand-font">oyrenoyret</span>
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2', className)}
      aria-label="oyrenoyret home"
    >
      <Image
        src="/oyrenoyretlogo.svg"
        alt="oyrenoyret"
        width={w}
        height={h}
        className="logo-mark shrink-0"
        priority={priority}
      />
    </Link>
  );
}
