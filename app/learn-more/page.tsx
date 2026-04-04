import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { LandingThemeLock } from '@/src/components/landing/landing-theme-lock';

export const metadata = {
  title: 'Learn more about us',
};

const values = [
  {
    title: 'Layered learning',
    description:
      'We help students stack concepts in the right order, so every new skill feels like a natural next step.',
  },
  {
    title: 'Parent-guided pathways',
    description:
      'Families choose the pace and focus areas, while our platform keeps every practice session aligned.',
  },
  {
    title: 'Confidence through practice',
    description:
      'We build momentum with short, focused exercises and gentle feedback that keeps students engaged.',
  },
];

const pillars = [
  {
    title: 'Clear paths, not chaos',
    description:
      'Curated learning maps keep students on track and reduce the overwhelm of endless resources.',
  },
  {
    title: 'Visible progress',
    description:
      'Parents and teachers can see milestones, review practice history, and celebrate wins together.',
  },
  {
    title: 'Supportive coaching',
    description:
      'Guided prompts, examples, and helpful nudges keep students focused on understanding, not guessing.',
  },
  {
    title: 'Safe by design',
    description:
      'We prioritize privacy, moderation, and parent oversight so learning stays secure and age-appropriate.',
  },
];

export default function LearnMorePage() {
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
              Learn more
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              A calmer way to build real understanding.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              oyrenoyret.org is a learning companion built for families who want structure
              without pressure. We help students layer new concepts with clarity, so each
              lesson builds on the last.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/register">Get started for free</Link>
              </Button>
              <Button asChild size="lg" variant="secondary-primary">
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-muted/40" />
            <div className="relative space-y-6 rounded-3xl border border-border/70 bg-background/90 p-6 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.6)]">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Our focus
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  Guided practice that feels approachable.
                </h2>
                <p className="text-sm text-muted-foreground">
                  We blend structured lessons with gentle coaching so students can revisit
                  tough topics, master essentials, and keep moving forward with confidence.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {values.map((value) => (
                  <div key={value.title} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{value.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">{value.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Built for clarity, accountability, and care.
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                Everything on oyrenoyret.org is designed to keep learning focused and
                families in control.
              </p>
            </div>
            <div className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs text-muted-foreground">
              Parent-first learning
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
                  <h3 className="text-lg font-semibold text-foreground">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground">{pillar.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              A learning rhythm that respects real life.
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              We know families juggle school, activities, and downtime. That is why our
              platform is built for short, focused sessions that add up over time.
            </p>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">
                Parents set the learning path. Students follow guided prompts. Everyone can
                see progress in one place.
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
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/90 px-6 py-10 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.6)] sm:px-10">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-muted/40" />
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Ready to explore oyrenoyret.org?
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Join families using guided practice to build lasting understanding and
                  confident learners.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Button asChild size="lg" variant="primary">
                  <Link href="/register">Start learning</Link>
                </Button>
                <Button asChild size="lg" variant="secondary-primary">
                  <Link href="/">Back to home</Link>
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
