'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PiArrowRight as ArrowRight, PiCaretDown as ChevronDown, PiList as Menu, PiX as X } from 'react-icons/pi';

import { Button } from '@/components/ui/button';
import { Logo } from '@/src/components/ui/logo';
import { ProfileAvatar } from '@/src/components/layout/profile-avatar';
import { useI18n } from '@/src/i18n/i18n-provider';
import { cn } from '@/src/lib/utils';
import { useAnchoredOverlayStyle } from '@/src/lib/anchored-overlay';

interface CurrentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarVariant?: string | null;
}

interface HoverDropdownProps {
  label: string;
  items: Array<{ label: string; href: string; description?: string }>;
}

function HoverDropdown({ label, items }: HoverDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useAnchoredOverlayStyle({
    open,
    triggerRef,
    overlayRef: menuRef,
    align: 'center',
    sideOffset: 10,
    collisionPadding: 12,
    zIndex: 100,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'flex touch-manipulation items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground transition-colors',
          open ? 'bg-muted/70' : 'hover:bg-muted/70',
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5', open && 'rotate-180')} />
      </button>
      <div
        ref={menuRef}
        style={menuStyle}
        className={cn(
          'pointer-events-none invisible fixed z-[100] w-56 origin-top scale-[0.98] opacity-0 transition-all duration-150 ease-out',
          open && 'visible pointer-events-auto scale-100 opacity-100',
        )}
      >
        <div className="pt-3" aria-hidden />
        <div className="card-frame bg-background px-2 py-2">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted/70"
                onClick={() => setOpen(false)}
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
    </div>
  );
}

interface SiteHeaderProps {
  showSpacer?: boolean;
  showSeparator?: boolean;
}

export function SiteHeader({ showSpacer = true, showSeparator = false }: SiteHeaderProps) {
  const { t } = useI18n();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    };

    if (mediaQuery.matches) {
      setMenuOpen(false);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <>
      {showSpacer ? <div className="h-14" aria-hidden="true" /> : null}
      <header
        className={cn(
          'fixed top-0 z-40 w-full border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300 will-change-[backdrop-filter,background-color] md:backdrop-blur-0 relative',
          showSeparator ? 'border-transparent' : 'border-border',
          showSeparator
            ? hasScrolled
              ? 'md:bg-background/70 md:backdrop-blur'
              : 'md:bg-transparent md:backdrop-blur-0'
            : hasScrolled
              ? 'md:border-border/40 md:bg-background/70 md:backdrop-blur'
              : 'md:border-transparent md:bg-transparent md:backdrop-blur-0',
        )}
      >
        <div className="flex w-full items-center justify-between bg-background px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/70"
            aria-expanded={menuOpen}
            aria-controls="landing-sidebar"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">{t('header.toggleMenu')}</span>
          </button>
          <Logo size="sm" showText textSize="lg" />
          <span className="h-9 w-9" aria-hidden />
        </div>
        <div className="hidden w-full grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 py-2 sm:px-6 md:grid">
          {/* 1. Logo Section */}
          <div className="flex min-w-0 items-center justify-self-start">
            <Logo size="sm" showText textSize="lg" priority />
          </div>

          {/* 2. Directives Section - Core Navigation (centered) */}
          <nav className="hidden items-center justify-center gap-3 md:flex">
            <HoverDropdown
              label={t('header.resources')}
              items={[
                {
                  label: t('header.documentation'),
                  href: '/resources/docs',
                  description: t('header.documentationDesc'),
                },
                {
                  label: t('header.helpCenter'),
                  href: '/resources/help',
                  description: t('header.helpCenterDesc'),
                },
                {
                  label: t('header.changelog'),
                  href: '/resources/changelog',
                  description: t('header.changelogDesc'),
                },
                {
                  label: t('header.blog'),
                  href: '/resources/blog',
                  description: t('header.blogDesc'),
                },
              ]}
            />
            <HoverDropdown
              label={t('header.legals')}
              items={[
                {
                  label: t('header.privacy'),
                  href: '/legals/privacy-policy',
                  description: t('header.privacyDesc'),
                },
                {
                  label: t('header.terms'),
                  href: '/legals/terms-of-service',
                  description: t('header.termsDesc'),
                },
                {
                  label: t('header.cookies'),
                  href: '/legals/cookie-policy',
                  description: t('header.cookiesDesc'),
                },
                {
                  label: t('header.gdpr'),
                  href: '/legals/gdpr',
                  description: t('header.gdprDesc'),
                },
              ]}
            />
            <Link
              href="/contact"
              className="rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/70"
            >
              {t('header.contact')}
            </Link>
          </nav>

          {/* 3. Interactive Buttons Section */}
          <div className="flex items-center justify-end gap-3">
            <div className="flex items-center gap-3">
              {user ? (
                <ProfileAvatar
                  userId={user.id}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  avatarVariant={user.avatarVariant}
                  size="sm"
                />
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/70"
                  >
                    {t('header.logIn')}
                  </Link>
                  <Button asChild size="sm" variant="primary">
                    <Link
                      href="/register"
                      className="group/btn inline-flex items-center gap-1"
                    >
                      {t('header.getStarted')}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        {showSeparator ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent"
            aria-hidden="true"
          />
        ) : null}
      </header>
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden transition-opacity duration-300 ease-in-out',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        role="dialog"
        aria-modal={menuOpen}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-black/40 transition-opacity duration-300 ease-in-out',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
          aria-label={t('header.closeNavigation')}
          tabIndex={menuOpen ? 0 : -1}
        />
        <aside
          id="landing-sidebar"
          className={cn(
            'absolute inset-y-0 left-0 w-72 border-r border-border bg-background shadow-xl transition-transform duration-350 ease-in-out will-change-transform',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Logo size="sm" showText />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={t('header.closeNavigation')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                {t('header.resources')}
              </span>
              <Link
                href="/resources/docs"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.documentation')}
              </Link>
              <Link
                href="/resources/help"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.helpCenter')}
              </Link>
              <Link
                href="/resources/changelog"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.changelog')}
              </Link>
              <Link
                href="/resources/blog"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.blog')}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                {t('header.legals')}
              </span>
              <Link
                href="/legals/privacy-policy"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.privacy')}
              </Link>
              <Link
                href="/legals/terms-of-service"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.terms')}
              </Link>
              <Link
                href="/legals/cookie-policy"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.cookies')}
              </Link>
              <Link
                href="/legals/gdpr"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {t('header.gdpr')}
              </Link>
            </div>
            <Link
              href="/contact"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {t('header.contact')}
            </Link>
          </nav>
          <div className="border-t border-border px-4 py-4">
            {user ? (
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  userId={user.id}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  avatarVariant={user.avatarVariant}
                  size="sm"
                />
                <span className="text-xs text-muted-foreground">
                  {t('header.signedIn')}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('header.logIn')}
                </Link>
                <Button asChild size="sm" variant="primary">
                  <Link
                    href="/register"
                    className="group/btn inline-flex items-center gap-1"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('header.getStarted')}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
