/**
 * Notifications unread count stream (SSE)
 *
 * Sends `event: unread` updates with `{ unreadCount }` while the connection is open.
 * Client should reconnect automatically on disconnect.
 */

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const id = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(id);
          resolve();
        },
        { once: true },
      );
    }
  });
}

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = getRateLimitIdentifier(request, userId);
  const rateLimit = await checkRateLimit(`notifications:unread-stream:${identifier}`, RATE_LIMITS.GENERAL);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  // Snapshot mute windows for this stream connection (client will reconnect if prefs change).
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

  const repliesMutedWindows = parseMutedWindows(repliesMutedWindowsRaw);
  const creditsMutedWindows = parseMutedWindows(creditsMutedWindowsRaw);
  const sprintsMutedWindows = parseMutedWindows(sprintsMutedWindowsRaw);
  const repliesOpenMutedFrom = parseIsoOrNull(repliesDisabledAtRaw);
  const creditsOpenMutedFrom = parseIsoOrNull(creditsDisabledAtRaw);
  const sprintsOpenMutedFrom = parseIsoOrNull(sprintsDisabledAtRaw);
  const notificationsReadAt = parseNotificationsReadAt(notificationsReadAtRaw) ?? new Date(0);

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const sendEvent = (event: string, data: unknown) => {
        send(`event: ${event}\n`);
        send(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Tell the browser how long to wait before retrying.
      send('retry: 5000\n\n');

      let lastUnread: number | null = null;
      const startedAt = Date.now();
      let lastPingAt = 0;

      while (!signal.aborted && Date.now() - startedAt < 55_000) {
        try {
          const unreadCount = await computeUnreadCount({
            userId,
            notificationsReadAt,
            repliesMutedWindows,
            creditsMutedWindows,
            sprintsMutedWindows,
            repliesOpenMutedFrom,
            creditsOpenMutedFrom,
            sprintsOpenMutedFrom,
          });

          if (lastUnread === null || unreadCount !== lastUnread) {
            lastUnread = unreadCount;
            sendEvent('unread', { unreadCount });
          }

          const now = Date.now();
          if (now - lastPingAt > 15_000) {
            lastPingAt = now;
            send(`: ping ${now}\n\n`);
          }
        } catch (error) {
          if (isDbSchemaMismatch(error)) {
            sendEvent('unread', { unreadCount: 0 });
            break;
          }
          sendEvent('error', { message: 'STREAM_FAILED' });
          break;
        }

        await sleep(4000, signal);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
