'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiTranslate as Translate, PiClock as Clock } from 'react-icons/pi';
import type { SettingsLanguage, TimeFormat } from '@/src/lib/settings-preferences';
import { useI18n } from '@/src/i18n/i18n-provider';
import { SUPPORTED_LOCALES } from '@/src/i18n';
import { Select, SelectItem } from '@/components/ui/select';

interface LanguageTimeControlsProps {
  language: SettingsLanguage;
  timeFormat: TimeFormat;
}

export function LanguageTimeControls({
  language,
  timeFormat,
}: LanguageTimeControlsProps) {
  const router = useRouter();
  const { t, messages } = useI18n();
  const [currentLanguage, setCurrentLanguage] = useState<SettingsLanguage>(language);
  const [currentTimeFormat, setCurrentTimeFormat] = useState<TimeFormat>(timeFormat);
  const [pending, startTransition] = useTransition();
  const languageOptions = SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    label: messages.settings.languageNames[locale] ?? locale,
  }));

  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  useEffect(() => {
    setCurrentTimeFormat(timeFormat);
  }, [timeFormat]);

  const updatePreferences = async (payload: Partial<{ language: SettingsLanguage; timeFormat: TimeFormat }>) => {
    await fetch('/api/settings/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  };

  const handleLanguageChange = (value: SettingsLanguage) => {
    setCurrentLanguage(value);
    startTransition(async () => {
      await updatePreferences({ language: value });
      router.refresh();
    });
  };

  const handleTimeFormatChange = (value: TimeFormat) => {
    setCurrentTimeFormat(value);
    startTransition(async () => {
      await updatePreferences({ timeFormat: value });
      router.refresh();
    });
  };

  return (
    <>
      <div className="card-frame bg-card/90 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Translate className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('settings.languageTime.languageLabel')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('settings.languageTime.languageHelp')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="settings-language"
            className="block text-xs font-medium text-muted-foreground"
          >
            {t('settings.languageTime.defaultLanguageLabel')}
          </label>
          <Select
            id="settings-language"
            value={currentLanguage}
            onChange={(event) => handleLanguageChange(event.target.value as SettingsLanguage)}
            disabled={pending}
          >
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div className="card-frame bg-card/90 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('settings.languageTime.timeFormatLabel')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('settings.languageTime.timeFormatHelp')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="settings-time-format"
            className="block text-xs font-medium text-muted-foreground"
          >
            {t('settings.languageTime.preferredDisplayLabel')}
          </label>
          <Select
            id="settings-time-format"
            value={currentTimeFormat}
            onChange={(event) => handleTimeFormatChange(event.target.value as TimeFormat)}
            disabled={pending}
          >
            <SelectItem value="auto">{t('settings.options.timeFormat.auto')}</SelectItem>
            <SelectItem value="12-hour">{t('settings.options.timeFormat.hour12')}</SelectItem>
            <SelectItem value="24-hour">{t('settings.options.timeFormat.hour24')}</SelectItem>
          </Select>
        </div>
      </div>
    </>
  );
}
