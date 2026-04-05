import Link from 'next/link';
import {
  PiUserCircle as UserCircle,
  PiPalette as Palette,
  PiTranslate as Translate,
  PiArrowUpRight as ArrowUpRight,
} from 'react-icons/pi';
import { Logo } from '@/src/components/ui/logo';
import { getI18n } from '@/src/i18n/server';

export default async function SettingsPage() {
  const { t } = await getI18n();
  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute -top-20 right-0 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-52 w-52 rounded-full bg-muted/60 blur-3xl" />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/40 via-background to-muted/70 p-8">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Logo size="sm" showText />
            <span className="text-sm font-semibold text-muted-foreground">
              {t('settings.nav.settings')}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            {t('settings.overview.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('settings.overview.description')}
          </p>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-border/40 bg-background/60" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full border border-border/30 bg-background/50" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Link
          href="/settings/my-account"
          className="card-frame group flex flex-col justify-between gap-6 bg-card/90 p-6 transition-colors hover:bg-muted/20"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCircle className="h-5 w-5" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('settings.nav.myAccount')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.overview.cards.myAccount')}
            </p>
          </div>
        </Link>

        <Link
          href="/settings/appearance"
          className="card-frame group flex flex-col justify-between gap-6 bg-card/90 p-6 transition-colors hover:bg-muted/20"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('settings.nav.appearance')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.overview.cards.appearance')}
            </p>
          </div>
        </Link>

        <Link
          href="/settings/language-time"
          className="card-frame group flex flex-col justify-between gap-6 bg-card/90 p-6 transition-colors hover:bg-muted/20"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Translate className="h-5 w-5" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('settings.nav.languageTime')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.overview.cards.languageTime')}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
