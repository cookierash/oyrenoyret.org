import type { ReactNode } from 'react';

import { cn } from '@/src/lib/utils';

const BRAND_SOURCE = 'oyrenoyret\\.org|oyrenoyret';

interface BrandTextProps {
  children: string;
  className?: string;
  brandClassName?: string;
}

export function BrandText({ children, className, brandClassName }: BrandTextProps): ReactNode {
  const text = children;
  const matches = Array.from(text.matchAll(new RegExp(BRAND_SOURCE, 'gi')));
  if (matches.length === 0) {
    return className ? <span className={className}>{text}</span> : text;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const value = match[0] ?? '';
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    nodes.push(
      <span
        key={`${start}-${index}`}
        className={cn('brand-font', brandClassName)}
      >
        {value}
      </span>,
    );
    cursor = start + value.length;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  if (!className) {
    return <>{nodes}</>;
  }

  return <span className={className}>{nodes}</span>;
}
