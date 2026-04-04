'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Logo } from '@/src/components/ui/logo';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const [cookieOpen, setCookieOpen] = useState(false);

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
                Cookie settings
              </button>
              <p>© {year} oyrenoyret.org</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/dashboard" className="transition-colors hover:text-foreground">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/catalog" className="transition-colors hover:text-foreground">
                    Catalog
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="transition-colors hover:text-foreground">
                    Library
                  </Link>
                </li>
                <li>
                  <Link href="/live-activities" className="transition-colors hover:text-foreground">
                    Live activities
                  </Link>
                </li>
                <li>
                  <Link href="/discussions" className="transition-colors hover:text-foreground">
                    Discussions
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Learning</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/studio" className="transition-colors hover:text-foreground">
                    Studio
                  </Link>
                </li>
                <li>
                  <Link href="/my-materials" className="transition-colors hover:text-foreground">
                    My materials
                  </Link>
                </li>
                <li>
                  <Link href="/recent-activities" className="transition-colors hover:text-foreground">
                    Recent Activities
                  </Link>
                </li>
                <li>
                  <Link href="/academic-record" className="transition-colors hover:text-foreground">
                    Academic record
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="transition-colors hover:text-foreground">
                    Settings
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Account</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login" className="transition-colors hover:text-foreground">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="transition-colors hover:text-foreground">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/forgot-password"
                    className="transition-colors hover:text-foreground"
                  >
                    Reset password
                  </Link>
                </li>
                <li>
                  <Link href="/record/verify" className="transition-colors hover:text-foreground">
                    Verify record
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/resources/help" className="transition-colors hover:text-foreground">
                    Help center
                  </Link>
                </li>
                <li>
                  <Link href="/resources/blog" className="transition-colors hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/resources/changelog" className="transition-colors hover:text-foreground">
                    Changelog
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Social</h3>
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
            <AlertDialogTitle>Cookie settings</AlertDialogTitle>
            <AlertDialogDescription>
              We only use strictly necessary cookies for authentication and security. There
              are no analytics or marketing cookies to opt out of.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-input px-3 py-3">
              <Checkbox checked disabled />
              <div>
                <p className="text-sm font-medium text-foreground">Strictly necessary</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required for security, authentication, and core platform functions.
                </p>
              </div>
            </div>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
              We do not use optional cookies for personalization, analytics, or advertising.
            </div>
            <Link
              href="/legals/cookie-policy"
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Read the full cookie policy
            </Link>
          </div>

          <AlertDialogFooter className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCookieOpen(false)}
            >
              Close
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </footer>
  );
}
