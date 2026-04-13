'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/src/lib/utils';
import { getAvatarSrc, getStableAvatarVariant, isAvatarVariant } from '@/src/lib/avatar';
import { UserHoverCard } from '@/src/components/users/user-hover-card';

/**
 * Profile avatar for logged-in users.
 */

interface ProfileAvatarProps {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarVariant?: string | null;
  className?: string;
  size?: 'sm' | 'md';
  showHoverCard?: boolean;
}

export function ProfileAvatar({
  userId,
  firstName,
  lastName,
  avatarVariant,
  className,
  size = 'sm',
  showHoverCard = true,
}: ProfileAvatarProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
  const resolvedVariant = isAvatarVariant(avatarVariant)
    ? avatarVariant
    : getStableAvatarVariant(userId);
  const src = getAvatarSrc(resolvedVariant);

  const avatar = (
    <Link
      href={`/u/${userId}`}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full font-medium text-white ring-1 ring-black/5',
        sizeClass,
        'transition-opacity hover:opacity-90',
        className
      )}
      title="View profile"
    >
      <Image
        src={src}
        alt="Avatar"
        fill
        sizes={size === 'sm' ? '32px' : '36px'}
        className="object-cover"
      />
    </Link>
  );

  if (!showHoverCard) return avatar;

  const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';
  return (
    <UserHoverCard lookupId={userId} fallbackName={fallbackName} avatarVariant={avatarVariant} href={`/u/${userId}`}>
      {avatar}
    </UserHoverCard>
  );
}
