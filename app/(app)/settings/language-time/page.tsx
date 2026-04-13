import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { LanguageTimeControls } from '@/src/components/settings/language-time-controls';
import { getI18n } from '@/src/i18n/server';
import { PageHeader } from '@/src/components/ui/page-header';

export default async function LanguageTimeSettingsPage() {
  const { language, timeFormat } = await getSettingsPreferences();
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <PageHeader
        badge={t('settings.languageTime.sectionLabel')}
        title={t('settings.languageTime.title')}
        description={t('settings.languageTime.subtitle')}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <LanguageTimeControls
          language={language}
          timeFormat={timeFormat}
        />
      </section>
    </div>
  );
}
