/**
 * Authentication Layout
 *
 * Split-screen: left panel (hidden on mobile) and right panel.
 * Uses grid to keep spacing consistent across screen sizes.
 * Login page handles redirect when user is already logged in.
 */

import Link from 'next/link';
import Image from 'next/image';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Left panel (lg+ only) */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <aside className="hidden lg:flex items-center justify-center border-r border-border overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted/40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 right-8 h-64 w-64 rounded-full bg-primary/20 blur-3xl opacity-70" />
          <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-primary/10 blur-3xl opacity-70" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        </div>
        <div className="relative z-10 w-full max-w-sm px-12 xl:px-16 space-y-3 text-left">
          <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary/70">
            NGO EdTech
          </p>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl font-comfortaa lowercase">
              oyrenoyret.org
            </h1>
            <p className="text-base text-muted-foreground">
              Secure learning for students, with parent or guardian oversight built
              into every step.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span>Data used only for educational purposes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span>Parental email verification and consent required</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span>Accounts tailored for learners under 18</span>
            </div>
          </div>
        </div>
        </aside>

        {/* Right panel */}
        <main className="relative min-h-screen flex flex-col justify-center px-6 py-6 sm:px-8 lg:px-12">
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
