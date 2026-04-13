'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/src/i18n/i18n-provider';
import type { MessageKey } from '@/src/i18n';

function getPageLabel(pathname: string, t: (key: MessageKey) => string): string {
  const map: Record<string, MessageKey> = {
    '/dashboard': 'pages.dashboard',
    '/studio': 'pages.studio',
    '/leaderboard': 'pages.leaderboard',
    '/catalog': 'pages.catalog',
    '/library': 'pages.library',
    '/interactive-sessions': 'pages.liveActivities',
    '/admin': 'pages.admin',
    '/admin/interactive-sessions': 'pages.manageLiveActivities',
    '/admin/messages': 'pages.contactMessages',
    '/admin/curriculum': 'pages.curriculum',
    '/admin/reports': 'pages.reports',
    '/admin/interactive-sessions/problem-sprints': 'pages.problemSprints',
    '/admin/interactive-sessions/announcements': 'pages.announcements',
    '/admin/interactive-sessions/events': 'pages.events',
    '/discussions': 'pages.discussions',
    '/recent-activities': 'pages.recentActivities',
    '/academic-record': 'pages.academicRecord',
    '/settings': 'pages.settings',
  };

  if (pathname in map) return t(map[pathname]);
  if (pathname.startsWith('/catalog/')) return t('pages.catalog');
  if (pathname.startsWith('/leaderboard')) return t('pages.leaderboard');
  if (pathname.startsWith('/preview/')) return t('pages.preview');
  if (pathname.startsWith('/library/')) return t('pages.library');
  if (pathname.startsWith('/discussions/')) return t('pages.discussion');
  if (pathname.startsWith('/recent-activities')) return t('pages.recentActivities');
  if (pathname.startsWith('/cms/sprint/')) return t('pages.problemSprint');
  if (pathname.startsWith('/sprints/')) return t('pages.problemSprint');
  if (pathname.startsWith('/admin/')) return t('pages.admin');
  if (pathname.startsWith('/studio/')) return t('pages.editor');
  if (pathname.startsWith('/settings')) return t('pages.settings');
  return 'oyrenoyret';
}

interface AccountTitleProps {
  displayName: string;
}

/**
 * Sets document.title based on the current route.
 * Format: "{pagename} - oyrenoyret.org"
 */
export function AccountTitle({ displayName: _displayName }: AccountTitleProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    const pageLabel = getPageLabel(pathname, t);
    document.title = `${pageLabel} - oyrenoyret.org`;
    return () => {
      document.title = 'oyrenoyret.org';
    };
  }, [pathname, _displayName, t]);

  return null;
}
