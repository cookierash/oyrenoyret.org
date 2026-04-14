import { normalizeLocale, type Locale } from '@/src/i18n';

export const LANGUAGE_COOKIE = 'oy_lang';
export const TIME_FORMAT_COOKIE = 'oy_time_format';
export const NOTIFY_REPLIES_COOKIE = 'oy_notify_replies';
export const NOTIFY_CREDITS_COOKIE = 'oy_notify_credits';
export const NOTIFY_SPRINTS_COOKIE = 'oy_notify_sprints';
export const NOTIFY_GUIDED_GROUP_SESSIONS_COOKIE = 'oy_notify_guided_group_sessions';

export type SettingsLanguage = Locale;

export const TIME_FORMATS = ['auto', '12-hour', '24-hour'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export type NotificationPreferenceKey = 'replies' | 'credits' | 'sprints' | 'guidedGroupSessions';
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export function normalizeLanguage(value?: string): SettingsLanguage {
  return normalizeLocale(value);
}

export function normalizeTimeFormat(value?: string): TimeFormat {
  if (value === '12-hour' || value === '24-hour') return value;
  return 'auto';
}

function normalizeBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return defaultValue;
}

export function normalizeNotifyReplies(value?: string) {
  return normalizeBoolean(value, true);
}

export function normalizeNotifyCredits(value?: string) {
  return normalizeBoolean(value, true);
}

export function normalizeNotifySprints(value?: string) {
  return normalizeBoolean(value, true);
}

export function normalizeNotifyGuidedGroupSessions(value?: string) {
  return normalizeBoolean(value, true);
}
