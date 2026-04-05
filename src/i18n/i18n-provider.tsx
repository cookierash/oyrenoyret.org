'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createTranslator, getMessages, normalizeLocale, DEFAULT_LOCALE, type Locale, type Messages, type MessageKey, type TranslateVars } from '@/src/i18n';

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: MessageKey, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  locale: Locale | string;
  children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const resolvedLocale = normalizeLocale(typeof locale === 'string' ? locale : locale);
  const value = useMemo<I18nContextValue>(() => {
    return {
      locale: resolvedLocale,
      messages: getMessages(resolvedLocale),
      t: createTranslator(resolvedLocale),
    };
  }, [resolvedLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    const locale = DEFAULT_LOCALE;
    return { locale, messages: getMessages(locale), t: createTranslator(locale) };
  }
  return context;
}
