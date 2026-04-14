/**
 * Public Academic Record Page
 *
 * View academic record details by public ID.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AcademicRecord } from '@prisma/client';
import { getI18n } from '@/src/i18n/server';
import { getLocaleCode } from '@/src/i18n';
import { getAcademicProgressSummary } from '@/src/modules/academic-record/progress';
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

interface PublicRecordPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicRecordPage({ params }: PublicRecordPageProps) {
  const { id } = await params;
  const publicId = id.trim().toLowerCase();
  const { locale, messages } = await getI18n();
  const copy = messages.record.publicRecord;
  const recordCopy = messages.app.academicRecord;

  let user:
    | { id: string; firstName: string | null; lastName: string | null; publicId: string | null }
    | null = null;
  try {
    user = await prisma.user.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, publicId: true },
    });
  } catch (error) {
    if (isDbSchemaMismatch(error)) return notFound();
    throw error;
  }

  if (!user) return notFound();

  let records: AcademicRecord[] = [];
  const progress = await getAcademicProgressSummary(user.id);
  try {
    records = await prisma.academicRecord.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  const numberFmt = new Intl.NumberFormat(getLocaleCode(locale), { maximumFractionDigits: 1 });
  const hoursFmt = new Intl.NumberFormat(getLocaleCode(locale), { maximumFractionDigits: 1 });
  const teachingHours = progress.guidedGroupTeachingMinutes / 60;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <PageHeader title={copy.title} description={copy.description} />

      <div className="mt-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{copy.ownerTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">{copy.ownerLabel}</span>{' '}
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {copy.publicIdLabel} {user.publicId}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.credits}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.lifetimeCreditsEarned}
                value={numberFmt.format(progress.lifetimeCreditsEarned)}
                icon={Sparkles}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <UsersThree className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.guidedSessions}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.guidedGroupSessionsFacilitated}
                value={progress.guidedGroupSessionsFacilitated}
                icon={UsersThree}
              />
              <MetricTile
                label={recordCopy.metrics.totalTeachingTime}
                value={`${hoursFmt.format(teachingHours)} ${recordCopy.units.hoursShort}`}
                icon={UsersThree}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Books className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.publishing}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.materialsPublishedTextual}
                value={progress.materialsPublishedTextual}
                icon={Books}
              />
              <MetricTile
                label={recordCopy.metrics.materialsPublishedPracticeTests}
                value={progress.materialsPublishedPracticeTests}
                icon={Books}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <ChatCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.discussions}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.discussionsStarted}
                value={progress.discussionsStarted}
                icon={ChatCircle}
              />
              <MetricTile
                label={recordCopy.metrics.discussionsReplied}
                value={progress.discussionsReplied}
                icon={ChatCircle}
              />
              <MetricTile
                label={recordCopy.metrics.replyReplies}
                value={progress.replyReplies}
                icon={ChatCircle}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.problemSprints}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.problemSprintsRegistered}
                value={progress.problemSprintsRegistered}
                icon={Trophy}
              />
              <MetricTile
                label={recordCopy.metrics.sprintFirstPlaces}
                value={progress.sprintFirstPlaces}
                icon={Trophy}
              />
              <MetricTile
                label={recordCopy.metrics.sprintSecondPlaces}
                value={progress.sprintSecondPlaces}
                icon={Trophy}
              />
              <MetricTile
                label={recordCopy.metrics.sprintThirdPlaces}
                value={progress.sprintThirdPlaces}
                icon={Trophy}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{recordCopy.progressSections.liveEvents}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label={recordCopy.metrics.liveEventsRegistered}
                value={progress.liveEventsRegistered}
                icon={CalendarDays}
              />
            </div>
          </section>
        </div>

        {records.length === 0 ? null : (
          <div className="space-y-4">
            {records.map((r: AcademicRecord) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {r.subject ?? recordCopy.subjectFallback}{' '}
                    {r.grade ? `· ${recordCopy.gradeLabel} ${r.grade}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {r.score != null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{recordCopy.scoreLabel}</span> {r.score}
                    </p>
                  )}
                  {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
