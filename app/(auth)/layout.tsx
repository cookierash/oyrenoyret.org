/**
 * Authentication Layout
 *
 * Split-screen: left panel (hidden on mobile) and right panel.
 * Uses grid to keep spacing consistent across screen sizes.
 * Login page handles redirect when user is already logged in.
 */

import Link from 'next/link';
import Image from 'next/image';
import { LandingThemeLock } from '@/src/components/landing/landing-theme-lock';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-light min-h-[100dvh] bg-background text-foreground">
      <LandingThemeLock />
      {/* Left panel (lg+ only) */}
      <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-2">
        <aside className="relative hidden lg:flex lg:sticky lg:top-0 lg:h-[100dvh] items-center justify-center border-r border-border overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted/40">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -top-24 right-8 h-64 w-64 rounded-full bg-primary/20 blur-3xl opacity-70" />
            <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-primary/10 blur-3xl opacity-70" />
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          </div>
          <div className="relative z-10 flex w-full flex-col items-center justify-center gap-4 px-12 text-center xl:px-16 scale-[1.2] origin-center">
            <Image
              src="/auth-pages-image.svg"
              alt="oyrenoyret illustration"
              width={240}
              height={240}
              className="h-auto w-full max-w-[220px] animate-figure-drift motion-reduce:animate-none"
              priority
            />
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl font-comfortaa lowercase">
              oyrenoyret
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              Secure learning for students with guided practice and parent-approved pathways.
            </p>
          </div>
        </aside>

        {/* Right panel */}
        <main className="relative min-h-[100dvh] flex flex-col justify-center px-6 py-6 sm:px-8 lg:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background to-muted/40"
            aria-hidden="true"
          />
          <div className="relative z-10 w-full">
            <div className="lg:hidden mb-5 flex flex-col items-center text-center max-w-md mx-auto">
              <Link href="/" className="flex items-center gap-2 justify-center">
                <Image
                  src="/oyrenoyretlogo.svg"
                  alt="oyrenoyret"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
                <span className="text-xl font-semibold tracking-tight font-comfortaa lowercase">
                  oyrenoyret.org
                </span>
              </Link>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
