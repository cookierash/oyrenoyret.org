import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import {
  LANGUAGE_COOKIE,
  TIME_FORMAT_COOKIE,
  normalizeLanguage,
  normalizeTimeFormat,
  NOTIFY_REPLIES_COOKIE,
  NOTIFY_CREDITS_COOKIE,
  NOTIFY_SPRINTS_COOKIE,
  NOTIFY_GUIDED_GROUP_SESSIONS_COOKIE,
  normalizeNotifyReplies,
  normalizeNotifyCredits,
  normalizeNotifySprints,
  normalizeNotifyGuidedGroupSessions,
  type SettingsLanguage,
  type TimeFormat,
} from '@/src/lib/settings-preferences';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import {
  NOTIFY_CREDITS_DISABLED_AT_COOKIE,
  NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE,
  NOTIFY_GUIDED_GROUP_SESSIONS_DISABLED_AT_COOKIE,
  NOTIFY_GUIDED_GROUP_SESSIONS_MUTED_WINDOWS_COOKIE,
  NOTIFY_REPLIES_DISABLED_AT_COOKIE,
  NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE,
  NOTIFY_SPRINTS_DISABLED_AT_COOKIE,
  NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE,
  parseIsoOrNull,
  parseMutedWindows,
} from '@/src/modules/notifications/mute-windows';

interface PreferencesPayload {
  language?: SettingsLanguage;
  timeFormat?: TimeFormat;
  notifyReplies?: boolean;
  notifyCredits?: boolean;
  notifySprints?: boolean;
  notifyGuidedGroupSessions?: boolean;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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

function normalizeIso(value: string | undefined): string | null {
  const parsed = parseIsoOrNull(value);
  return parsed ? parsed.toISOString() : null;
}

export async function POST(request: Request) {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(`settings:preferences:${identifier}`, RATE_LIMITS.GENERAL);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  const body = (await request.json().catch(() => ({}))) as PreferencesPayload;
  const response = NextResponse.json({ ok: true }, { headers: getPrivateNoStoreHeaders() });
  const nowIso = new Date().toISOString();

  if (body.language) {
    const language = normalizeLanguage(body.language);
    response.cookies.set(LANGUAGE_COOKIE, language, {
      path: '/',
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  if (body.timeFormat) {
    const timeFormat = normalizeTimeFormat(body.timeFormat);
    response.cookies.set(TIME_FORMAT_COOKIE, timeFormat, {
      path: '/',
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  if (body.notifyReplies !== undefined) {
    response.cookies.set(
      NOTIFY_REPLIES_COOKIE,
      normalizeNotifyReplies(String(body.notifyReplies)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: ONE_YEAR_SECONDS,
      },
    );

    // Muting behavior: turning off doesn't hide past notifications; it only suppresses items created while muted.
    const existingDisabledAt = normalizeIso(await getCookieValue(NOTIFY_REPLIES_DISABLED_AT_COOKIE));
    const windows = parseMutedWindows(await getCookieValue(NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE));
    if (body.notifyReplies === false) {
      if (!existingDisabledAt) {
        response.cookies.set(NOTIFY_REPLIES_DISABLED_AT_COOKIE, nowIso, {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
      }
    } else if (body.notifyReplies === true) {
      if (existingDisabledAt) {
        const next = [...windows, { from: existingDisabledAt, to: nowIso }].slice(-10);
        response.cookies.set(NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE, JSON.stringify(next), {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
        response.cookies.delete(NOTIFY_REPLIES_DISABLED_AT_COOKIE);
      }
    }
  }

  if (body.notifyCredits !== undefined) {
    response.cookies.set(
      NOTIFY_CREDITS_COOKIE,
      normalizeNotifyCredits(String(body.notifyCredits)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: ONE_YEAR_SECONDS,
      },
    );

    const existingDisabledAt = normalizeIso(await getCookieValue(NOTIFY_CREDITS_DISABLED_AT_COOKIE));
    const windows = parseMutedWindows(await getCookieValue(NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE));
    if (body.notifyCredits === false) {
      if (!existingDisabledAt) {
        response.cookies.set(NOTIFY_CREDITS_DISABLED_AT_COOKIE, nowIso, {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
      }
    } else if (body.notifyCredits === true) {
      if (existingDisabledAt) {
        const next = [...windows, { from: existingDisabledAt, to: nowIso }].slice(-10);
        response.cookies.set(NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE, JSON.stringify(next), {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
        response.cookies.delete(NOTIFY_CREDITS_DISABLED_AT_COOKIE);
      }
    }
  }

  if (body.notifySprints !== undefined) {
    response.cookies.set(
      NOTIFY_SPRINTS_COOKIE,
      normalizeNotifySprints(String(body.notifySprints)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: ONE_YEAR_SECONDS,
      },
    );

    const existingDisabledAt = normalizeIso(await getCookieValue(NOTIFY_SPRINTS_DISABLED_AT_COOKIE));
    const windows = parseMutedWindows(await getCookieValue(NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE));
    if (body.notifySprints === false) {
      if (!existingDisabledAt) {
        response.cookies.set(NOTIFY_SPRINTS_DISABLED_AT_COOKIE, nowIso, {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
      }
    } else if (body.notifySprints === true) {
      if (existingDisabledAt) {
        const next = [...windows, { from: existingDisabledAt, to: nowIso }].slice(-10);
        response.cookies.set(NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE, JSON.stringify(next), {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
        response.cookies.delete(NOTIFY_SPRINTS_DISABLED_AT_COOKIE);
      }
    }
  }

  if (body.notifyGuidedGroupSessions !== undefined) {
    response.cookies.set(
      NOTIFY_GUIDED_GROUP_SESSIONS_COOKIE,
      normalizeNotifyGuidedGroupSessions(String(body.notifyGuidedGroupSessions)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: ONE_YEAR_SECONDS,
      },
    );

    const existingDisabledAt = normalizeIso(
      await getCookieValue(NOTIFY_GUIDED_GROUP_SESSIONS_DISABLED_AT_COOKIE),
    );
    const windows = parseMutedWindows(
      await getCookieValue(NOTIFY_GUIDED_GROUP_SESSIONS_MUTED_WINDOWS_COOKIE),
    );
    if (body.notifyGuidedGroupSessions === false) {
      if (!existingDisabledAt) {
        response.cookies.set(NOTIFY_GUIDED_GROUP_SESSIONS_DISABLED_AT_COOKIE, nowIso, {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
      }
    } else if (body.notifyGuidedGroupSessions === true) {
      if (existingDisabledAt) {
        const next = [...windows, { from: existingDisabledAt, to: nowIso }].slice(-10);
        response.cookies.set(NOTIFY_GUIDED_GROUP_SESSIONS_MUTED_WINDOWS_COOKIE, JSON.stringify(next), {
          path: '/',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
        });
        response.cookies.delete(NOTIFY_GUIDED_GROUP_SESSIONS_DISABLED_AT_COOKIE);
      }
    }
  }

  return response;
}
