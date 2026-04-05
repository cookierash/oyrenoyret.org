import {
  PiUserCircle as UserCircle,
  PiEnvelopeSimple as Mail,
  PiLockKey as LockKey,
  PiShieldCheck as Shield,
} from 'react-icons/pi';
import { getI18n } from '@/src/i18n/server';

export default async function MyAccountSettingsPage() {
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <section className="card-frame overflow-hidden bg-card/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('settings.myAccount.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.myAccount.subtitle')}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {t('settings.myAccount.sectionLabel')}
          </span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card-frame bg-card/90 p-5">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t('settings.myAccount.contactTitle')}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('settings.myAccount.contactDescription')}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('settings.myAccount.comingSoon')}
          </p>
        </div>
        <div className="card-frame bg-card/90 p-5">
          <div className="flex items-center gap-3">
            <LockKey className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t('settings.myAccount.passwordTitle')}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('settings.myAccount.passwordDescription')}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('settings.myAccount.comingSoon')}
          </p>
        </div>
        <div className="card-frame bg-card/90 p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t('settings.myAccount.securityTitle')}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('settings.myAccount.securityDescription')}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('settings.myAccount.comingSoon')}
          </p>
        </div>
      </section>
    </div>
  );
}
