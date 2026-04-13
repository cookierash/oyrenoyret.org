'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/src/lib/utils';
import { getAvatarSrc, getStableAvatarVariant, isAvatarVariant } from '@/src/lib/avatar';
import { useOptionalCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { UserHoverCard } from '@/src/components/users/user-hover-card';

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
  avatarVariant?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  /**
   * If provided, clicking the avatar navigates to `/u/${profileId}`.
   * Use this instead of `userId` when you want URL-safe identifiers (e.g. publicId).
   */
  profileId?: string;
  showHoverCard?: boolean;
}

export function PostAvatar({
  userId,
  authorName,
  avatarVariant,
  size = 'md',
  className,
  profileId,
  showHoverCard = true,
}: PostAvatarProps) {
  const router = useRouter();
  const currentUserCtx = useOptionalCurrentUser();
  const currentUser = currentUserCtx?.user;
  const lookupId = profileId ?? userId ?? null;
  const isCurrentUser =
    Boolean(lookupId) &&
    Boolean(currentUser) &&
    (lookupId === currentUser!.id || (currentUser!.publicId && lookupId === currentUser!.publicId));

  const resolvedVariant = isCurrentUser ? currentUser?.avatarVariant ?? null : avatarVariant ?? null;

  const finalVariant = isAvatarVariant(resolvedVariant)
    ? resolvedVariant
    : getStableAvatarVariant(userId ?? authorName);
  const src = getAvatarSrc(finalVariant);
  const colorClass = AVATAR_COLORS[getAvatarIndex(userId ?? authorName)];

  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[9px]'
      : size === 'sm'
        ? 'h-8 w-8 text-xs'
        : 'h-10 w-10 text-sm';

  const href = lookupId ? `/u/${lookupId}` : null;
  const isInteractive = Boolean(href);

  const avatar = (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white',
        colorClass,
        sizeClass,
        isInteractive
          ? 'cursor-pointer ring-1 ring-black/5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
          : null,
        className
      )}
      role={isInteractive ? 'link' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      title={isInteractive ? 'View profile' : undefined}
      aria-label={isInteractive ? `View profile for ${authorName}` : undefined}
      onMouseEnter={
        isInteractive && href
          ? () => {
              router.prefetch(href);
            }
          : undefined
      }
      onClick={
        isInteractive && href
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(href);
            }
          : undefined
      }
      onKeyDown={
        isInteractive && href
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              router.push(href);
            }
          : undefined
      }
    >
      <Image
        src={src}
        alt="Avatar"
        fill
        sizes={size === 'xs' ? '20px' : size === 'sm' ? '32px' : '40px'}
        className="object-cover"
      />
    </div>
  );

  if (!showHoverCard || !lookupId) return avatar;

  return (
    <UserHoverCard
      lookupId={lookupId}
      fallbackName={authorName}
      avatarVariant={resolvedVariant}
      href={href}
    >
      {avatar}
    </UserHoverCard>
  );
}
