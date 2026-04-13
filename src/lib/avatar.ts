export const AVATAR_VARIANTS = [
  'regular',
  'blue',
  'green',
  'red',
  'violet',
  'yellow',
] as const;

export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

export function getAvatarSrc(variant: AvatarVariant): string {
  return `/avatar-${variant}.png`;
}

export function getRandomAvatarVariant(): AvatarVariant {
  return AVATAR_VARIANTS[Math.floor(Math.random() * AVATAR_VARIANTS.length)];
}

/**
 * Stable pseudo-random avatar variant based on an input seed (e.g. user id).
 * This gives a "randomly distributed" look without changing between renders.
 */
export function getStableAvatarVariant(seed: string): AvatarVariant {
  if (!seed) return 'regular';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_VARIANTS[Math.abs(hash) % AVATAR_VARIANTS.length];
}

export function isAvatarVariant(value: unknown): value is AvatarVariant {
  return typeof value === 'string' && (AVATAR_VARIANTS as readonly string[]).includes(value);
}

export function coerceAvatarVariant(value: unknown): AvatarVariant {
  return isAvatarVariant(value) ? value : 'regular';
}
