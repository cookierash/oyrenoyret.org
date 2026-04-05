import { normalizeLocale, type Locale } from '@/src/i18n';

export const LANGUAGE_COOKIE = 'oy_lang';
export const TIME_FORMAT_COOKIE = 'oy_time_format';

export type SettingsLanguage = Locale;

export const TIME_FORMATS = ['auto', '12-hour', '24-hour'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export function normalizeLanguage(value?: string): SettingsLanguage {
  return normalizeLocale(value);
}

export function normalizeTimeFormat(value?: string): TimeFormat {
  if (value === '12-hour' || value === '24-hour') return value;
  return 'auto';
}
