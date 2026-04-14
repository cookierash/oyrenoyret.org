import { cookies } from 'next/headers';
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
    notifications: {
      replies: normalizeNotifyReplies(getCookie?.(NOTIFY_REPLIES_COOKIE)?.value),
      credits: normalizeNotifyCredits(getCookie?.(NOTIFY_CREDITS_COOKIE)?.value),
      sprints: normalizeNotifySprints(getCookie?.(NOTIFY_SPRINTS_COOKIE)?.value),
      guidedGroupSessions: normalizeNotifyGuidedGroupSessions(getCookie?.(NOTIFY_GUIDED_GROUP_SESSIONS_COOKIE)?.value),
    },
  };
}
