import { NextResponse } from 'next/server';
import {
  LANGUAGE_COOKIE,
  TIME_FORMAT_COOKIE,
  normalizeLanguage,
  normalizeTimeFormat,
  type SettingsLanguage,
  type TimeFormat,
} from '@/src/lib/settings-preferences';

interface PreferencesPayload {
  language?: SettingsLanguage;
  timeFormat?: TimeFormat;
}

export async function POST(request: Request) {
  const body = (await request.json()) as PreferencesPayload;
  const response = NextResponse.json({ ok: true });

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

  return response;
}
