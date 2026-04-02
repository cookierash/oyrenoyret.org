'use client';

import { cn } from '@/src/lib/utils';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
] as const;

function getAvatarIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

interface PostAvatarProps {
  userId?: string;
  authorName: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function PostAvatar({ userId, authorName, size = 'md', className }: PostAvatarProps) {
  const colorClass = AVATAR_COLORS[getAvatarIndex(userId ?? authorName)];
  const initials = authorName
    .split(/\s+/)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[9px]'
      : size === 'sm'
        ? 'h-8 w-8 text-xs'
        : 'h-10 w-10 text-sm';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        colorClass,
        sizeClass,
        className
      )}
    >
      {initials}
    </div>
  );
}
