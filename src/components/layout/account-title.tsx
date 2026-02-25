'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/studio': 'Studio',
  '/catalog': 'Catalog',
  '/mistakes': 'Mistake library',
  '/discussions': 'Discussions',
  '/messages': 'Messages',
  '/academic-record': 'Academic record',
  '/settings': 'Settings',
};

function getPageLabel(pathname: string): string {
  if (pathname in PAGE_LABELS) return PAGE_LABELS[pathname];
  if (pathname.startsWith('/catalog/')) return 'Catalog';
  if (pathname.startsWith('/discussions/')) return 'Discussion';
  if (pathname.startsWith('/studio/')) return 'Editor';
  return 'Oyrenoyret';
}

interface AccountTitleProps {
  displayName: string;
}

/**
 * Sets document.title to include account identity so multi-tab,
 * multi-account usage is clear. Format: "Page · Account - Oyrenoyret.org"
 */
export function AccountTitle({ displayName }: AccountTitleProps) {
  const pathname = usePathname();

  useEffect(() => {
    const pageLabel = getPageLabel(pathname);
    document.title = `${pageLabel} · ${displayName} - Oyrenoyret.org`;
    return () => {
      document.title = 'Oyrenoyret.org - NGO EdTech Platform';
    };
  }, [pathname, displayName]);

  return null;
}
