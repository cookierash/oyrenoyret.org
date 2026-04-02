/**
 * HTTP cache helpers for API routes.
 */

export const PUBLIC_CACHE_SECONDS = 60;
export const PUBLIC_STALE_SECONDS = 300;

export function getPublicCacheHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Cache-Control': `public, s-maxage=${PUBLIC_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_STALE_SECONDS}`,
    ...(extra ?? {}),
  };
}

export function getPrivateNoStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store',
    ...(extra ?? {}),
  };
}
