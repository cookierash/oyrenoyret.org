'use client';

import Link from 'next/link';
import { cn } from '@/src/lib/utils';

/**
 * Profile avatar for logged-in users.
 * For now: deterministic color based on userId (one of 5 preset colors).
 * Future: randomly choose one of 5 photos - use same index logic.
 */
const AVATAR_COLORS = [
  'bg-blue-500',      // 0
  'bg-emerald-500',   // 1
  'bg-violet-500',    // 2
  'bg-amber-500',     // 3
  'bg-rose-500',     // 4
] as const;

function getAvatarIndex(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

interface ProfileAvatarProps {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export function ProfileAvatar({
  userId,
  firstName,
  lastName,
  className,
  size = 'sm',
}: ProfileAvatarProps) {
  const index = getAvatarIndex(userId);
  const colorClass = AVATAR_COLORS[index];
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || '?';

  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';

  return (
    <Link
      href="/dashboard"
      className={cn(
        'flex items-center justify-center rounded-full font-semibold text-white',
        colorClass,
        sizeClass,
        'transition-opacity hover:opacity-90',
        className
      )}
      title="Go to dashboard"
    >
      {initials}
    </Link>
  );
}
