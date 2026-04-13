import 'server-only';

import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { createTranslator, getMessages, normalizeLocale, type Locale } from '@/src/i18n';

export async function getI18n(options?: { locale?: Locale | string }) {
  const { language } = await getSettingsPreferences();
  const locale: Locale = normalizeLocale(options?.locale ?? language);
  return {
    locale,
    messages: getMessages(locale),
    t: createTranslator(locale),
  };
}
