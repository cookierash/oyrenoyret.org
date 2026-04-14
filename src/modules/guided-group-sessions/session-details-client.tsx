'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useSettings } from '@/src/components/settings/settings-provider';
import { getLocaleCode } from '@/src/i18n';
import { splitObjectives } from '@/src/modules/materials/utils';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';

export function GuidedGroupSessionDetailsClient({
  session,
  curriculum,
  myEnrollmentStatus: myEnrollmentStatusInitial,
  isFacilitator,
  approvedLearners,
}: {
  session: {
    id: string;
    title: string;
    objectives: string | null;
    scheduledAt: string;
    durationMinutes: number;
    learnerCapacity: number;
    status: string;
    facilitator: { id: string; name: string };
  };
  curriculum: { subjectName: string; topicName: string };
  myEnrollmentStatus: string | null;
  isFacilitator: boolean;
  approvedLearners: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const { timeFormat } = useSettings();
  const { canWrite, writeRestriction } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [myEnrollmentStatus, setMyEnrollmentStatus] = useState<string | null>(myEnrollmentStatusInitial);

  const nowMs = Date.now();
  const when = useMemo(() => new Date(session.scheduledAt), [session.scheduledAt]);
  const startMs = when.getTime();
  const endMs = startMs + (session.durationMinutes ?? 0) * 60_000;
  const isOngoing = nowMs >= startMs && nowMs < endMs;

  const approvedCount = approvedLearners.length;
  const seatsLeft = Math.max(0, (session.learnerCapacity ?? 0) - approvedCount);

  const localeCode = getLocaleCode(locale);
  const hour12 = timeFormat === '12-hour' ? true : timeFormat === '24-hour' ? false : undefined;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [localeCode],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        hour: 'numeric',
        minute: '2-digit',
        ...(hour12 === undefined ? {} : { hour12 }),
      }),
    [localeCode, hour12],
  );

  const objectiveLines = useMemo(() => splitObjectives(session.objectives), [session.objectives]);

  const canEnterRoom = isOngoing && (isFacilitator || myEnrollmentStatus === 'APPROVED');
  const canRegister =
    session.status === 'SCHEDULED' &&
    !isFacilitator &&
    startMs > nowMs &&
    seatsLeft > 0 &&
    (!myEnrollmentStatus || myEnrollmentStatus === 'CANCELLED' || myEnrollmentStatus === 'REJECTED');
  const canCancelRegistration =
    !isFacilitator && (myEnrollmentStatus === 'APPROVED' || myEnrollmentStatus === 'PENDING') && startMs > nowMs;

  const register = async () => {
    if (busy) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(session.id)}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data?.error === 'string' && data.error ? data.error : locale === 'az' ? 'Qeydiyyat mümkün olmadı.' : 'Failed to register.',
        );
        return;
      }
      const next = typeof data?.status === 'string' ? data.status : 'APPROVED';
      setMyEnrollmentStatus(next);
      toast.success(locale === 'az' ? 'Qeydiyyat tamamlandı.' : 'Registered.');
      router.refresh();
    } catch {
      toast.error(locale === 'az' ? 'Qeydiyyat mümkün olmadı.' : 'Failed to register.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(session.id)}/enroll`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data?.error === 'string' && data.error ? data.error : locale === 'az' ? 'Ləğv etmək mümkün olmadı.' : 'Failed to cancel.',
        );
        return;
      }
      toast.success(locale === 'az' ? 'Qeydiyyat ləğv edildi.' : 'Registration cancelled.');
      setMyEnrollmentStatus('CANCELLED');
      router.refresh();
    } catch {
      toast.error(locale === 'az' ? 'Ləğv etmək mümkün olmadı.' : 'Failed to cancel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="card-frame bg-card">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {curriculum.topicName} · {curriculum.subjectName}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                {locale === 'az' ? 'Bələdçi' : 'Facilitator'}: {session.facilitator.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEnterRoom ? (
                <Button size="sm" variant="primary" asChild>
                  <Link href={`/my-library/guided-group-sessions/${encodeURIComponent(session.id)}/live`}>
                    {locale === 'az' ? 'Qoşul' : 'Join'}
                  </Link>
                </Button>
              ) : canRegister ? (
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void register()}>
                  {locale === 'az' ? 'Qeydiyyat' : 'Register'}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled>
                  {isFacilitator
                    ? locale === 'az'
                      ? 'Sizin sessiya'
                      : 'Your session'
                    : myEnrollmentStatus === 'APPROVED'
                      ? locale === 'az'
                        ? 'Qeydiyyat var'
                        : 'Registered'
                      : seatsLeft === 0
                        ? locale === 'az'
                          ? 'Doludur'
                          : 'Full'
                        : locale === 'az'
                          ? 'Qeydiyyat bağlıdır'
                          : 'Registration closed'}
                </Button>
              )}

              {canCancelRegistration ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void cancel()}>
                  {locale === 'az' ? 'Qeydiyyatı ləğv et' : 'Cancel'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              {dateFormatter.format(when)} · {timeFormatter.format(when)}
            </span>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              {session.durationMinutes} {locale === 'az' ? 'dəq' : 'min'}
            </span>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              {approvedCount}/{session.learnerCapacity} {locale === 'az' ? 'şagird' : 'learners'}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium shadow-sm ring-1',
                isOngoing
                  ? 'bg-rose-500/10 text-rose-700 ring-rose-500/15 dark:text-rose-300'
                  : 'bg-muted/60 text-foreground ring-border',
              )}
            >
              {isOngoing ? (locale === 'az' ? 'Canlı' : 'Live') : session.status}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="card-frame bg-card">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">{locale === 'az' ? 'Məqsədlər' : 'Objectives'}</p>
            {objectiveLines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {locale === 'az' ? 'Məqsəd əlavə edilməyib.' : 'No objectives listed.'}
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {objectiveLines.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="card-frame bg-card">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">{locale === 'az' ? 'İştirakçılar' : 'Participants'}</p>
            <p className="text-xs text-muted-foreground">
              {approvedCount}/{session.learnerCapacity} {locale === 'az' ? 'şagird' : 'learners'}
            </p>
            {approvedLearners.length === 0 ? (
              <p className="text-xs text-muted-foreground">{locale === 'az' ? 'Hələlik yoxdur.' : 'None yet.'}</p>
            ) : (
              <ul className="space-y-1">
                {approvedLearners.slice(0, 20).map((l) => (
                  <li key={l.id} className="text-xs text-muted-foreground truncate">
                    {l.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
