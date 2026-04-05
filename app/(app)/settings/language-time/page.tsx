import { PiTranslate as Translate } from 'react-icons/pi';
import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { LanguageTimeControls } from '@/src/components/settings/language-time-controls';
import { getI18n } from '@/src/i18n/server';

export default async function LanguageTimeSettingsPage() {
  const { language, timeFormat } = await getSettingsPreferences();
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <section className="card-frame overflow-hidden bg-card/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Translate className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('settings.languageTime.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.languageTime.subtitle')}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {t('settings.languageTime.sectionLabel')}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <LanguageTimeControls
          language={language}
          timeFormat={timeFormat}
        />
      </section>
    </div>
  );
}
