import { readdirSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { StickyPartnersBar } from '@/src/components/landing/sticky-partners-bar';
import { LandingThemeLock } from '@/src/components/landing/landing-theme-lock';

export const metadata = {
  title: {
    absolute: 'oyrenoyret.org',
  },
};

interface PartnerLogo {
  src: string;
  name: string;
}

function getPartnerLogos(): PartnerLogo[] {
  const publicDir = path.join(process.cwd(), 'public');
  let files: string[] = [];
  try {
    files = readdirSync(publicDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp']);

  return files
    .map((file) => {
      if (!file.toLowerCase().startsWith('partner')) return null;

      const ext = path.extname(file);
      if (ext && !allowedExtensions.has(ext.toLowerCase())) {
        return null;
      }

      const baseName = ext ? file.slice(0, -ext.length) : file;
      const match = /^partner(?:(\d+)[-_])?(.+)?$/i.exec(baseName);
      if (!match) return null;
      const order = match[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
      const rawName = (match[2] ?? '').trim();
      const name = rawName
        ? rawName
            .replace(/[-_]+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : match[1]
          ? `Partner ${order}`
          : 'Partner';

      return {
        order,
        name,
        src: `/${file}`,
        sortKey: rawName.toLowerCase(),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        order: number;
        src: string;
        name: string;
        sortKey: string;
      } => Boolean(entry),
    )
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.sortKey.localeCompare(b.sortKey) ||
        a.src.localeCompare(b.src),
    )
    .map(({ order: _order, sortKey: _sortKey, ...rest }) => rest);
}

export default async function HomePage() {
  const userId = await getCurrentSession();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      redirect('/login');
    }
    redirect(isStaff(user.role) ? '/admin/dashboard' : '/dashboard');
  }

  const partnerLogos = getPartnerLogos();

  return (
    <div className="landing-light relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <LandingThemeLock />
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader showSpacer={false} showSeparator />
        <main className="flex-1">
          <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-28 text-center sm:px-6 lg:px-8 lg:pt-36 min-h-[100svh]">
            <div className="flex w-full flex-1 flex-col items-center">
              <div className="w-full max-w-3xl space-y-4">
                <div className="mx-auto w-full max-w-[120px] sm:max-w-[150px] lg:max-w-[190px]">
                  <div className="relative aspect-[725/788] w-full [--orbit-radius:110px] sm:[--orbit-radius:140px] lg:[--orbit-radius:170px]">
                    <div className="absolute inset-0 animate-figure-float">
                      <Image
                        src="/oyrenoyret-meditating.svg"
                        alt="Illustration of mindful learning"
                        fill
                        sizes="(min-width: 1024px) 190px, (min-width: 640px) 150px, 120px"
                        className="object-contain"
                        priority
                      />
                    </div>
                    {[
                      { src: '/red-box.svg', angle: -90, rotate: '-7.5deg', duration: '8.2s' },
                      { src: '/yellow-box.svg', angle: -45, rotate: '8.5deg', duration: '7.6s' },
                      { src: '/green-box.svg', angle: 0, rotate: '-6.5deg', duration: '8.6s' },
                      { src: '/purple-box.svg', angle: 45, rotate: '7.8deg', duration: '7.9s' },
                      { src: '/blue-box.svg', angle: 90, rotate: '-8.2deg', duration: '8.1s' },
                    ].map((box, index) => (
                      <div
                        key={box.src}
                        className="box-orbit-item absolute left-1/2 top-[50%] w-[36%] sm:w-[32%] lg:w-[30%]"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${box.angle}deg) translateY(calc(-1 * var(--orbit-radius))) rotate(${-box.angle}deg)`,
                        }}
                        aria-hidden="true"
                      >
                        <div
                          className="relative aspect-square w-full animate-box-float"
                          style={{
                            animationDelay: `${index * 0.35}s`,
                            animationDuration: box.duration,
                            ['--box-rotate' as any]: box.rotate,
                          }}
                        >
                          <Image
                            src={box.src}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 60px, (min-width: 640px) 48px, 43px"
                            className="object-contain"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  Knowledge builds upon itself
                </h1>
                <p className="text-base text-muted-foreground sm:text-lg">
                  We help students layer concepts with clarity, using guided practice and
                  parent-approved learning pathways designed for confident growth.
                </p>
              </div>

              <div className="mt-4 flex w-full max-w-3xl flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="primary">
                  <Link href="/register">Get started for free</Link>
                </Button>
                <Button asChild size="lg" variant="secondary-primary">
                  <Link href="/learn-more">Learn more about us</Link>
                </Button>
              </div>

              <div className="mt-12 w-full max-w-5xl pb-16 lg:pb-24">
                <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-muted/30" />
                  <div className="relative flex aspect-[16/9] w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-3 w-24 rounded-full bg-muted/70" />
                      <span>Video preview will live here</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <StickyPartnersBar partners={partnerLogos} />
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
