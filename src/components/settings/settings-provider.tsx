'use client';

import { createContext, useContext } from 'react';
import type { SettingsLanguage, TimeFormat } from '@/src/lib/settings-preferences';
import { DEFAULT_LOCALE } from '@/src/i18n';

interface SettingsContextValue {
  language: SettingsLanguage;
  timeFormat: TimeFormat;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps extends SettingsContextValue {
  children: React.ReactNode;
}

export function SettingsProvider({ children, language, timeFormat }: SettingsProviderProps) {
  return (
    <SettingsContext.Provider value={{ language, timeFormat }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return { language: DEFAULT_LOCALE, timeFormat: 'auto' as TimeFormat };
  }
  return context;
}
