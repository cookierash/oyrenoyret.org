import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { LandingThemeLock } from '@/src/components/landing/landing-theme-lock';
import { BrandText } from '@/src/components/ui/brand-text';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Learn more about us',
};

export default async function LearnMorePage() {
  const { messages } = await getI18n();
  const copy = messages.learnMore;

  const values = copy.values;
  const pillars = copy.pillars;
  return (
    <div className="landing-light relative min-h-screen overflow-hidden bg-background text-foreground">
      <LandingThemeLock />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-28 top-64 h-80 w-80 rounded-full bg-muted/40 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-primary/10 blur-[120px]" />

      <SiteHeader showSpacer={false} showSeparator />
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pt-32">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {copy.pill}
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              <BrandText>{copy.title}</BrandText>
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              <BrandText>{copy.subtitle}</BrandText>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/register">{copy.ctaPrimary}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary-primary">
                <Link href="/contact">{copy.ctaSecondary}</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-muted/40" />
            <div className="relative space-y-6 rounded-3xl border border-border/70 bg-background/90 p-6 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.6)]">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  <BrandText>{copy.focusLabel}</BrandText>
                </p>
                <h2 className="text-xl font-medium text-foreground">
                  <BrandText>{copy.focusTitle}</BrandText>
                </h2>
                <p className="text-sm text-muted-foreground">
                  <BrandText>{copy.focusBody}</BrandText>
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {values.map((value) => (
                  <div key={value.title} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <h3 className="text-sm font-medium text-foreground">
                      <BrandText>{value.title}</BrandText>
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <BrandText>{value.description}</BrandText>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                <BrandText>{copy.pillarsTitle}</BrandText>
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                <BrandText>{copy.pillarsSubtitle}</BrandText>
              </p>
            </div>
            <div className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs text-muted-foreground">
              <BrandText>{copy.pillarsBadge}</BrandText>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="group relative overflow-hidden rounded-3xl border border-border/70 bg-background/80 p-6 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.55)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative space-y-3">
                  <h3 className="text-lg font-medium text-foreground">
                    <BrandText>{pillar.title}</BrandText>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <BrandText>{pillar.description}</BrandText>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
              <BrandText>{copy.rhythmTitle}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              <BrandText>{copy.rhythmSubtitle}</BrandText>
            </p>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">
                <BrandText>{copy.rhythmNote}</BrandText>
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {[
              {
                title: 'Choose the focus',
                description: 'Pick the subject and goal together before each session.',
              },
              {
                title: 'Practice with guardrails',
                description: 'Students get examples, hints, and checkpoints along the way.',
              },
              {
                title: 'Reflect and adjust',
                description: 'Review results as a family and set the next small target.',
              },
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border border-border/70 bg-background/80 p-5">
                <h3 className="text-base font-medium text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  <BrandText>{step.description}</BrandText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/90 px-6 py-10 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.6)] sm:px-10">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-muted/40" />
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                  <BrandText>{copy.ctaTitle}</BrandText>
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  <BrandText>{copy.ctaBody}</BrandText>
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Button asChild size="lg" variant="primary">
                  <Link href="/register">{copy.ctaStart}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary-primary">
                  <Link href="/">{copy.ctaBack}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
