import { PiPalette as Palette } from 'react-icons/pi';
import { AppearanceModePicker } from '@/src/components/settings/appearance-mode-picker';
import { getI18n } from '@/src/i18n/server';

export default async function AppearanceSettingsPage() {
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <section className="card-frame overflow-hidden bg-card/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('settings.appearance.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.appearance.subtitle')}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {t('settings.appearance.sectionLabel')}
          </span>
        </div>
      </section>

      <section className="card-frame bg-card/90 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Palette className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('settings.appearance.themeTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.appearance.themeDescription')}
            </p>
          </div>
        </div>
        <AppearanceModePicker />
      </section>
    </div>
  );
}
