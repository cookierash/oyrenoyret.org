import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { NotificationsControls } from '@/src/components/settings/notifications-controls';
import { getI18n } from '@/src/i18n/server';
import { PageHeader } from '@/src/components/ui/page-header';

export default async function NotificationsSettingsPage() {
  const { notifications } = await getSettingsPreferences();
  const { t } = await getI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        badge={t('settings.notifications.sectionLabel')}
        title={t('settings.notifications.title')}
        description={t('settings.notifications.subtitle')}
      />

      <section>
        <NotificationsControls notifications={notifications} />
      </section>
    </div>
  );
}
