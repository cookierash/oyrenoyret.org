import { getLocaleCode, translate, type Locale } from '@/src/i18n';

export function formatRelativeTime(dateStr: string, locale: Locale = 'en'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return translate(locale, 'discussions.relativeTime.now');
  if (diffMin < 60)
    return translate(locale, 'discussions.relativeTime.minutes', { count: diffMin });
  if (diffHour < 24)
    return translate(locale, 'discussions.relativeTime.hours', { count: diffHour });
  if (diffDay < 7)
    return translate(locale, 'discussions.relativeTime.days', { count: diffDay });
  return date.toLocaleDateString(getLocaleCode(locale), { month: 'short', day: 'numeric' });
}
