/**
 * Announcement Detail Page
 *
 * Public within authenticated app shell.
 */

import { notFound } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getI18n } from '@/src/i18n/server';
import { getLocaleCode } from '@/src/i18n';
import { getAnnouncementImageSrc } from '@/src/lib/announcement-images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AnnouncementPageProps {
  params: Promise<{ id: string }>;
}

async function getAnnouncementById(id: string) {
  let announcement:
    | {
        id: string;
        title: string;
        body: string;
        createdAt: Date;
        imageUrl?: string | null;
      }
    | null = null;

  try {
    announcement = await prisma.liveAnnouncement.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    try {
      announcement = await prisma.liveAnnouncement.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          body: true,
          imageUrl: true,
          createdAt: true,
        },
      });
    } catch (error2) {
      if (!isDbSchemaMismatch(error2)) throw error2;
      announcement = await prisma.liveAnnouncement.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
        },
      });
    }
  }

  return announcement;
}

export default async function AnnouncementPage({ params }: AnnouncementPageProps) {
  const { id } = await params;
  const { locale } = await getI18n();
  const localeCode = getLocaleCode(locale);

  const announcement = await getAnnouncementById(id);
  if (!announcement) notFound();
  const imageSrc = getAnnouncementImageSrc(announcement.imageUrl);

  const date = new Intl.DateTimeFormat(localeCode, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(announcement.createdAt));

  return (
    <DashboardShell className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title={
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{announcement.title}</span>
            <span className="text-xs font-normal text-muted-foreground">{date}</span>
          </div>
        }
      />

      {imageSrc ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/50 bg-muted/20">
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="prose prose-sm max-w-none pt-2 dark:prose-invert">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {announcement.body}
        </p>
      </div>
    </DashboardShell>
  );
}
