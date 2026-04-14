/**
 * User Profile Page
 *
 * Accessible inside the authenticated app shell.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getI18n } from '@/src/i18n/server';
import { getLocaleCode } from '@/src/i18n';
import { roundCredits } from '@/src/modules/credits';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { ReportUserButton } from '@/src/modules/reports/report-user-button';
import { AVATAR_VARIANTS, type AvatarVariant } from '@/src/lib/avatar';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isAdmin } from '@/src/lib/permissions';
import { AdminUserModerationPanel } from '@/src/modules/moderation/admin-user-moderation-panel';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const metadata = {
  title: 'User',
};

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

function getDisplayName(firstName?: string | null, lastName?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || 'User';
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params;
  const { locale, messages } = await getI18n();
  const copy = messages.app.userProfile;

  let user: any = null;
  try {
    user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id }, { publicId: id }],
      },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        role: true,
        status: true,
        suspensionUntil: true,
        suspensionReason: true,
        bannedAt: true,
        banReason: true,
        credits: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id }, { publicId: id }],
      },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        role: true,
        status: true,
        credits: true,
        createdAt: true,
      },
    });
  }

  if (!user) return notFound();

  const displayName = getDisplayName(user.firstName, user.lastName);
  const joined = new Date(user.createdAt).toLocaleDateString(getLocaleCode(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const avatarVariant: AvatarVariant = AVATAR_VARIANTS.includes(user.avatarVariant as AvatarVariant)
    ? (user.avatarVariant as AvatarVariant)
    : 'regular';

  const currentUserId = await getCurrentSession();
  const currentUser = currentUserId
    ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
    : null;
  const canModerate = Boolean(currentUser?.role && isAdmin(currentUser.role));

  return (
    <DashboardShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <ReportUserButton
            reportedUserId={user.id}
            reportedUserPublicId={user.publicId ?? null}
            reportedUserName={displayName}
          />
        }
      />

      <main className="space-y-4 pt-2">
        <Card className="card-frame bg-card">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <PostAvatar
                userId={user.publicId ?? user.id}
                authorName={displayName}
                avatarVariant={avatarVariant}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-xl font-semibold text-foreground truncate">{displayName}</h1>
                  <span className="text-xs text-muted-foreground">
                    {copy.joinedLabel} {joined}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">
                      {copy.roleLabel}
                    </div>
                    <div className="mt-0.5 font-medium text-foreground">{user.role}</div>
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">
                      {copy.statusLabel}
                    </div>
                    <div className="mt-0.5 font-medium text-foreground">{user.status}</div>
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">
                      {copy.creditsLabel}
                    </div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {roundCredits(user.credits ?? 0)}
                    </div>
                  </div>
                </div>

                {user.publicId ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {copy.publicIdLabel}{' '}
                    <span className="font-mono text-foreground/80">{user.publicId}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {canModerate ? (
          <AdminUserModerationPanel
            user={{
              id: user.id,
              status: user.status,
              suspensionUntil: user.suspensionUntil ? user.suspensionUntil.toISOString() : null,
              suspensionReason: user.suspensionReason ?? null,
              bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
              banReason: user.banReason ?? null,
            }}
          />
        ) : null}
      </main>
    </DashboardShell>
  );
}
