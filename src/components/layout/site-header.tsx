'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo } from '@/src/components/ui/logo';
import { ProfileAvatar } from '@/src/components/layout/profile-avatar';
import { cn } from '@/src/lib/utils';

interface CurrentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface HoverDropdownProps {
  label: string;
  items: Array<{ label: string; href: string; description?: string }>;
}

function HoverDropdown({ label, items }: HoverDropdownProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground transition-colors group-hover:bg-muted/70"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 group-hover:rotate-180" />
      </button>
      <div className="pointer-events-none invisible absolute left-1/2 top-full z-[100] w-56 -translate-x-1/2 origin-top scale-[0.98] opacity-0 transition-all duration-150 ease-out group-hover:visible group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100">
        <div className="pt-3" aria-hidden />
        <div className="card-frame bg-background py-1 px-1.5 backdrop-blur-sm">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/70"
            >
              <div className="font-medium">{item.label}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground">
                  {item.description}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 4);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full bg-background/70 backdrop-blur transition-colors duration-200',
        hasScrolled ? 'border-b border-border/40' : 'border-b border-transparent',
      )}
    >
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 py-2 sm:px-6">
        {/* 1. Logo Section */}
        <div className="flex min-w-0 items-center justify-self-start">
          <Logo size="sm" showText textSize="lg" />
        </div>

        {/* 2. Directives Section - Core Navigation (centered) */}
        <nav className="hidden items-center justify-center gap-3 md:flex">
          <HoverDropdown
            label="Resources"
            items={[
              {
                label: 'Documentation',
                href: '/docs',
                description: 'Platform guides and API docs',
              },
              {
                label: 'Help Center',
                href: '/help',
                description: 'FAQs and support articles',
              },
              {
                label: 'Community',
                href: '/community',
                description: 'Join our community forum',
              },
              {
                label: 'Blog',
                href: '/blog',
                description: 'Latest updates and insights',
              },
            ]}
          />
          <HoverDropdown
            label="Legals"
            items={[
              {
                label: 'Privacy Policy',
                href: '/privacy',
                description: 'How we protect your data',
              },
              {
                label: 'Terms of Service',
                href: '/terms',
                description: 'Platform usage terms',
              },
              {
                label: 'Cookie Policy',
                href: '/cookies',
                description: 'Cookie usage information',
              },
              {
                label: 'GDPR Compliance',
                href: '/gdpr',
                description: 'EU data protection compliance',
              },
            ]}
          />
          <Link
            href="/contact"
            className="rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/70"
          >
            Contact
          </Link>
        </nav>

        {/* 3. Interactive Buttons Section */}
        <div className="flex items-center justify-end gap-3">
          {user ? (
            <ProfileAvatar
              userId={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              size="sm"
            />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/70"
              >
                Log in
              </Link>
              <Button asChild size="sm" variant="primary">
                <Link
                  href="/register"
                  className="group/btn inline-flex items-center gap-1"
                >
                  Get started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
