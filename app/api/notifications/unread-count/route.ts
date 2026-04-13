/**
 * Notifications unread count API
 *
 * GET: returns unreadCount for the current user.
 */

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { cookies } from 'next/headers';
import {
  NOTIFY_CREDITS_DISABLED_AT_COOKIE,
  NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE,
  NOTIFY_REPLIES_DISABLED_AT_COOKIE,
  NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE,
  NOTIFY_SPRINTS_DISABLED_AT_COOKIE,
  NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE,
  parseIsoOrNull,
  parseMutedWindows,
} from '@/src/modules/notifications/mute-windows';
import { computeUnreadCount } from '@/src/modules/notifications/unread-count';
import { NOTIFICATIONS_READ_AT_COOKIE, parseNotificationsReadAt } from '@/src/modules/notifications/read-at-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getCookieValue(key: string): Promise<string | undefined> {
  const store = cookies();
  const cookieStore =
    typeof (store as { then?: unknown })?.then === 'function' ? await store : store;
  const getCookie =
    typeof (cookieStore as { get?: (key: string) => { value?: string } | undefined }).get ===
    'function'
      ? (cookieStore as { get: (key: string) => { value?: string } | undefined }).get.bind(
          cookieStore,
        )
      : undefined;
  return getCookie?.(key)?.value;
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`notifications:unread:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const headers = getPrivateNoStoreHeaders();
    const [
      repliesMutedWindowsRaw,
      creditsMutedWindowsRaw,
      sprintsMutedWindowsRaw,
      repliesDisabledAtRaw,
      creditsDisabledAtRaw,
      sprintsDisabledAtRaw,
      notificationsReadAtRaw,
    ] = await Promise.all([
      getCookieValue(NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_REPLIES_DISABLED_AT_COOKIE),
      getCookieValue(NOTIFY_CREDITS_DISABLED_AT_COOKIE),
      getCookieValue(NOTIFY_SPRINTS_DISABLED_AT_COOKIE),
      getCookieValue(NOTIFICATIONS_READ_AT_COOKIE),
    ]);

    // Read-state is browser-scoped; if missing, treat everything as unread.
    const notificationsReadAt = parseNotificationsReadAt(notificationsReadAtRaw) ?? new Date(0);

    const unreadCount = await computeUnreadCount({
      userId,
      notificationsReadAt,
      repliesMutedWindows: parseMutedWindows(repliesMutedWindowsRaw),
      creditsMutedWindows: parseMutedWindows(creditsMutedWindowsRaw),
      sprintsMutedWindows: parseMutedWindows(sprintsMutedWindowsRaw),
      repliesOpenMutedFrom: parseIsoOrNull(repliesDisabledAtRaw),
      creditsOpenMutedFrom: parseIsoOrNull(creditsDisabledAtRaw),
      sprintsOpenMutedFrom: parseIsoOrNull(sprintsDisabledAtRaw),
    });
    return NextResponse.json({ unreadCount }, { headers });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json({ unreadCount: 0 }, { headers: getPrivateNoStoreHeaders() });
    }
    console.error('Error fetching notifications unread count:', error);
    // Badge endpoint should never hard-fail the app shell.
    return NextResponse.json({ unreadCount: 0 }, { headers: getPrivateNoStoreHeaders() });
  }
}
