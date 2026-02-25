/**
 * Authentication Layout
 *
 * Split-screen: left panel fixed (stays on scroll), vertically centered, left-aligned.
 * Right panel scrolls with login/register card.
 * Redirects to /dashboard when user is already logged in.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentSession();
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Left: fixed, does not scroll, vertically centered, left-aligned */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-1/2 items-center justify-center bg-muted/30 border-r border-border">
        <div className="w-full max-w-sm px-12 xl:px-16 space-y-4 text-left">
          <p className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            NGO EdTech • Safe for students
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Oyrenoyret.org
          </h1>
          <p className="text-sm text-muted-foreground">
            A secure learning space designed for students, with clear parental
            oversight and consent at every step.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li>• Data used only for educational purposes</li>
            <li>• Parental email verification and consent required</li>
            <li>• Accounts tailored for learners under 18</li>
          </ul>
        </div>
      </aside>

      {/* Right: scrollable, login/register card */}
      <main className="min-h-screen lg:ml-[50%] flex flex-col items-center justify-center px-4 py-10 lg:px-8">
        <div className="lg:hidden mb-6 flex flex-col items-center text-center">
          <a href="/" className="flex items-center gap-2">
            <img src="/oyrenoyretlogo.svg" alt="Oyrenoyret" className="h-10 w-10" />
            <span className="text-xl font-semibold tracking-tight">Oyrenoyret.org</span>
          </a>
          <p className="text-xs text-muted-foreground mt-1">NGO EdTech • Safe for students</p>
        </div>
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
    </div>
  );
}
