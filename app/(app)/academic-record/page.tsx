/**
 * Academic Record Page
 *
 * View and manage academic records.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AcademicRecord } from '@prisma/client';
import { getI18n } from '@/src/i18n/server';
import { getAcademicProgressSummary } from '@/src/modules/academic-record/progress';
import { getLocaleCode } from '@/src/i18n';
import {
  PiSparkle as Sparkles,
  PiUsersThree as UsersThree,
  PiBooks as Books,
  PiChatCircle as ChatCircle,
  PiTrophy as Trophy,
  PiCalendar as CalendarDays,
} from 'react-icons/pi';

function MetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-frame bg-muted/10 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-medium truncate">{value}</p>
      </div>
      <Icon className="h-5 w-5 text-muted-foreground/70 shrink-0" />
    </div>
  );
}

export default async function AcademicRecordPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');
  const { locale, messages } = await getI18n();
  const copy = messages.app.academicRecord;

  let records: AcademicRecord[] = [];
  try {
    records = await prisma.academicRecord.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  const progress = await getAcademicProgressSummary(userId);
  let user: { publicId: string | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicId: true },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  const numberFmt = new Intl.NumberFormat(getLocaleCode(locale), { maximumFractionDigits: 1 });
  const hoursFmt = new Intl.NumberFormat(getLocaleCode(locale), { maximumFractionDigits: 1 });
  const teachingHours = progress.guidedGroupTeachingMinutes / 60;

  return (
    <DashboardShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <main className="space-y-4 pt-2">
        {user?.publicId ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-mono">
              {copy.idLabel} {user.publicId}
            </p>
            <p className="text-sm text-muted-foreground">
              {copy.shareHint}{' '}
              {copy.shareHintVerifyPrefix}
              <Link
                href="/record/verify"
                className="text-primary underline underline-offset-2"
              >
                {copy.shareHintVerifyLink}
              </Link>
              {copy.shareHintVerifySuffix}
            </p>
          </div>
        ) : null}

        <div className="space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.credits}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.lifetimeCreditsEarned}
                value={numberFmt.format(progress.lifetimeCreditsEarned)}
                icon={Sparkles}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <UsersThree className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.guidedSessions}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.guidedGroupSessionsFacilitated}
                value={progress.guidedGroupSessionsFacilitated}
                icon={UsersThree}
              />
              <MetricTile
                label={copy.metrics.totalTeachingTime}
                value={`${hoursFmt.format(teachingHours)} ${copy.units.hoursShort}`}
                icon={UsersThree}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Books className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.publishing}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.materialsPublishedTextual}
                value={progress.materialsPublishedTextual}
                icon={Books}
              />
              <MetricTile
                label={copy.metrics.materialsPublishedPracticeTests}
                value={progress.materialsPublishedPracticeTests}
                icon={Books}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <ChatCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.discussions}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.discussionsStarted}
                value={progress.discussionsStarted}
                icon={ChatCircle}
              />
              <MetricTile
                label={copy.metrics.discussionsReplied}
                value={progress.discussionsReplied}
                icon={ChatCircle}
              />
              <MetricTile
                label={copy.metrics.replyReplies}
                value={progress.replyReplies}
                icon={ChatCircle}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.problemSprints}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.problemSprintsRegistered}
                value={progress.problemSprintsRegistered}
                icon={Trophy}
              />
              <MetricTile
                label={copy.metrics.sprintFirstPlaces}
                value={progress.sprintFirstPlaces}
                icon={Trophy}
              />
              <MetricTile
                label={copy.metrics.sprintSecondPlaces}
                value={progress.sprintSecondPlaces}
                icon={Trophy}
              />
              <MetricTile
                label={copy.metrics.sprintThirdPlaces}
                value={progress.sprintThirdPlaces}
                icon={Trophy}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{copy.progressSections.liveEvents}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={copy.metrics.liveEventsRegistered}
                value={progress.liveEventsRegistered}
                icon={CalendarDays}
              />
            </div>
          </section>
        </div>

        {records.length === 0 ? null : (
          <div className="space-y-4">
            {records.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {r.subject ?? copy.subjectFallback}{' '}
                    {r.grade ? `· ${copy.gradeLabel} ${r.grade}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {r.score != null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{copy.scoreLabel}</span> {r.score}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-sm text-muted-foreground">{r.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
