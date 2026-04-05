import { cookies } from 'next/headers';
import {
  LANGUAGE_COOKIE,
  TIME_FORMAT_COOKIE,
  normalizeLanguage,
  normalizeTimeFormat,
} from '@/src/lib/settings-preferences';

export async function getSettingsPreferences() {
  const store = cookies();
  const cookieStore =
    typeof (store as { then?: unknown })?.then === 'function'
      ? await store
      : store;
  const getCookie =
    typeof (cookieStore as { get?: (key: string) => { value?: string } | undefined }).get ===
    'function'
      ? (cookieStore as { get: (key: string) => { value?: string } | undefined }).get.bind(
          cookieStore,
        )
      : undefined;
  return {
    language: normalizeLanguage(getCookie?.(LANGUAGE_COOKIE)?.value),
    timeFormat: normalizeTimeFormat(getCookie?.(TIME_FORMAT_COOKIE)?.value),
  };
}
