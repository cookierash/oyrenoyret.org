import { NextResponse } from 'next/server';
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
  normalizeNotifyReplies,
  normalizeNotifyCredits,
  normalizeNotifySprints,
  type SettingsLanguage,
  type TimeFormat,
} from '@/src/lib/settings-preferences';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

interface PreferencesPayload {
  language?: SettingsLanguage;
  timeFormat?: TimeFormat;
  notifyReplies?: boolean;
  notifyCredits?: boolean;
  notifySprints?: boolean;
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

  if (body.language) {
    const language = normalizeLanguage(body.language);
    response.cookies.set(LANGUAGE_COOKIE, language, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (body.timeFormat) {
    const timeFormat = normalizeTimeFormat(body.timeFormat);
    response.cookies.set(TIME_FORMAT_COOKIE, timeFormat, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (body.notifyReplies !== undefined) {
    response.cookies.set(
      NOTIFY_REPLIES_COOKIE,
      normalizeNotifyReplies(String(body.notifyReplies)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      },
    );
  }

  if (body.notifyCredits !== undefined) {
    response.cookies.set(
      NOTIFY_CREDITS_COOKIE,
      normalizeNotifyCredits(String(body.notifyCredits)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      },
    );
  }

  if (body.notifySprints !== undefined) {
    response.cookies.set(
      NOTIFY_SPRINTS_COOKIE,
      normalizeNotifySprints(String(body.notifySprints)) ? '1' : '0',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      },
    );
  }

  return response;
}
