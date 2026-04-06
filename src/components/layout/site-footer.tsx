'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectItem } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Logo } from '@/src/components/ui/logo';
import { useSettings } from '@/src/components/settings/settings-provider';
import { SUPPORTED_LOCALES } from '@/src/i18n';
import { useI18n } from '@/src/i18n/i18n-provider';
import type { SettingsLanguage } from '@/src/lib/settings-preferences';

interface CurrentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function SiteFooter() {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [cookieOpen, setCookieOpen] = useState(false);
  const { t, messages } = useI18n();
  const { language } = useSettings();
  const [currentLanguage, setCurrentLanguage] = useState<SettingsLanguage>(language);
  const [pending, startTransition] = useTransition();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const languageOptions = SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    label: messages.settings.languageNames[locale] ?? locale,
  }));

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  const updatePreferences = async (payload: Partial<{ language: SettingsLanguage }>) => {
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

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2.4fr]">
          <div className="flex flex-col gap-6">
            <Logo size="sm" showText textSize="lg" className="text-xl" />
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="w-fit text-left transition-colors hover:text-foreground"
                onClick={() => setCookieOpen(true)}
              >
                {t('footer.cookieSettings')}
              </button>
              <p>© {year} oyrenoyret.org</p>
            </div>
            {user === null ? (
              <div className="max-w-[200px]">
                <Select
                  id="footer-language"
                  aria-label={t('settings.languageTime.defaultLanguageLabel')}
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
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('footer.platform')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/dashboard" className="transition-colors hover:text-foreground">
                    {t('footer.dashboard')}
                  </Link>
                </li>
                <li>
                  <Link href="/catalog" className="transition-colors hover:text-foreground">
                    {t('footer.catalog')}
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="transition-colors hover:text-foreground">
                    {t('footer.library')}
                  </Link>
                </li>
                <li>
                  <Link href="/live-activities" className="transition-colors hover:text-foreground">
                    {t('footer.liveActivities')}
                  </Link>
                </li>
                <li>
                  <Link href="/discussions" className="transition-colors hover:text-foreground">
                    {t('footer.discussions')}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('footer.learning')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/studio" className="transition-colors hover:text-foreground">
                    {t('footer.studio')}
                  </Link>
                </li>
                <li>
                  <Link href="/my-materials" className="transition-colors hover:text-foreground">
                    {t('footer.myMaterials')}
                  </Link>
                </li>
                <li>
                  <Link href="/recent-activities" className="transition-colors hover:text-foreground">
                    {t('footer.recentActivities')}
                  </Link>
                </li>
                <li>
                  <Link href="/academic-record" className="transition-colors hover:text-foreground">
                    {t('footer.academicRecord')}
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="transition-colors hover:text-foreground">
                    {t('footer.settings')}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('footer.account')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login" className="transition-colors hover:text-foreground">
                    {t('footer.logIn')}
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="transition-colors hover:text-foreground">
                    {t('footer.getStarted')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/forgot-password"
                    className="transition-colors hover:text-foreground"
                  >
                    {t('footer.resetPassword')}
                  </Link>
                </li>
                <li>
                  <Link href="/record/verify" className="transition-colors hover:text-foreground">
                    {t('footer.verifyRecord')}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('footer.resources')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/resources/help" className="transition-colors hover:text-foreground">
                    {t('footer.helpCenter')}
                  </Link>
                </li>
                <li>
                  <Link href="/resources/blog" className="transition-colors hover:text-foreground">
                    {t('footer.blog')}
                  </Link>
                </li>
                <li>
                  <Link href="/resources/changelog" className="transition-colors hover:text-foreground">
                    {t('footer.changelog')}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-foreground">
                    {t('footer.contact')}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('footer.social')}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="https://www.instagram.com/oyrenoyret.hzt/"
                    className="transition-colors hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Instagram
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://www.youtube.com/channel/UCMU20z2ObBxXPQf-4HHVbwA?si=bH0jtN767G6eKkhD&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQMMjU2MjgxMDQwNTU4AAGno7RDhaTQhvmLP0kaadxkCFD6R2qCye864CXGLhBGvwUlYmH0AubrlRC797k_aem__04v0gkdBHBrYU-sNtGU1A"
                    className="transition-colors hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={cookieOpen} onOpenChange={setCookieOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('footer.cookieTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('footer.cookieDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-input px-3 py-3">
                <Checkbox checked disabled />
                <div>
                <p className="text-sm font-medium text-foreground">
                  {t('footer.strictlyNecessary')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('footer.strictlyNecessaryDesc')}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
              {t('footer.noOptionalCookies')}
            </div>
            <Link
              href="/legals/cookie-policy"
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t('footer.cookiePolicy')}
            </Link>
          </div>

          <AlertDialogFooter className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCookieOpen(false)}
            >
              {t('footer.close')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </footer>
  );
}
