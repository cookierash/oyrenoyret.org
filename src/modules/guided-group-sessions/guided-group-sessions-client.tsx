'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectItem } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useSettings } from '@/src/components/settings/settings-provider';
import { getLocaleCode } from '@/src/i18n';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';
import { dispatchCreditsUpdated } from '@/src/lib/credits-events';

type CurriculumTopic = {
  slug: string;
  nameEn: string;
  nameAz: string;
};

type CurriculumSubject = {
  slug: string;
  nameEn: string;
  nameAz: string;
  topics: CurriculumTopic[];
};

type FacilitatorApplication = {
  id: string;
  phoneNumber: string;
  finCode: string;
  motivationLetter: string;
  status: 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
  reviewerMessage: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subjects: Array<{ subjectId: string; approvedAt: string | null }>;
  reviewedBy?: { firstName: string | null; lastName: string | null; email: string } | null;
};

type ApplicationPayload = {
  application: FacilitatorApplication | null;
  verifiedSubjectIds: string[];
};

type GuidedGroupSessionRow = {
  id: string;
  title: string;
  subjectId: string;
  topicId: string;
  scheduledAt: string;
  durationMinutes: number;
  learnerCapacity: number;
  status: string;
  facilitator: { id: string; name: string; avatarVariant: string | null };
  enrollmentStatus: string | null;
  approvedCount: number;
};

type MyGuidedGroupSessionRow = {
  id: string;
  title: string;
  subjectId: string;
  topicId: string;
  scheduledAt: string;
  durationMinutes: number;
  learnerCapacity: number;
  status: string;
  startedAt: string | null;
  cancelledAt: string | null;
  approvedCount: number;
  pendingCount: number;
  enrollments: Array<{
    id: string;
    status: string;
    createdAt: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      avatarVariant: string | null;
    };
  }>;
};

type LibraryGuidedGroupSessionRow = {
  id: string;
  title: string;
  subjectId: string;
  topicId: string;
  scheduledAt: string;
  endedAt: string | null;
  durationMinutes: number;
  learnerCapacity: number;
  status: string;
  facilitator: { id: string; name: string; avatarVariant: string | null };
  myRole: 'FACILITATOR' | 'LEARNER';
  myRating: number | null;
};

export function GuidedGroupSessionsClient({
  profile,
}: {
  profile: {
    firstName: string | null;
    lastName: string | null;
    parentFirstName: string | null;
    parentLastName: string | null;
    ageYears: number | null;
    email: string;
    parentEmail: string | null;
    grade: string | null;
  };
}) {
  const { locale, messages } = useI18n();
  const { timeFormat } = useSettings();
  const { user, canWrite, writeRestriction } = useCurrentUser();
  const copy = messages.app.guidedGroupSessions;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [sessions, setSessions] = useState<GuidedGroupSessionRow[]>([]);
  const [mySessions, setMySessions] = useState<MyGuidedGroupSessionRow[]>([]);
  const [librarySessions, setLibrarySessions] = useState<LibraryGuidedGroupSessionRow[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);
  const [application, setApplication] = useState<FacilitatorApplication | null>(null);
  const [verifiedSubjectIds, setVerifiedSubjectIds] = useState<string[]>([]);
  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [finCode, setFinCode] = useState('');
  const [motivationLetter, setMotivationLetter] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSubjectId, setSessionSubjectId] = useState('');
  const [sessionTopicId, setSessionTopicId] = useState('');
  const [sessionScheduledAt, setSessionScheduledAt] = useState('');
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [sessionCapacity, setSessionCapacity] = useState<number>(2);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(['', '', '', '', '']);

  const [browseQuery, setBrowseQuery] = useState('');
  const [browseSubjectId, setBrowseSubjectId] = useState('');
  const [browseTopicId, setBrowseTopicId] = useState('');

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      map.set(subject.slug, locale === 'az' ? subject.nameAz : subject.nameEn);
    }
    return map;
  }, [subjects, locale]);

  const topicNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      for (const topic of subject.topics ?? []) {
        map.set(
          `${subject.slug}:${topic.slug}`,
          locale === 'az' ? topic.nameAz : topic.nameEn,
        );
      }
    }
    return map;
  }, [subjects, locale]);

  const localeCode = getLocaleCode(locale);
  const hour12 =
    timeFormat === '12-hour' ? true : timeFormat === '24-hour' ? false : undefined;
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

  const isVerifiedFacilitator = verifiedSubjectIds.length > 0;

  const isPending = application?.status === 'PENDING';

  const load = async () => {
    setLoading(true);
    try {
      const [curriculumRes, appRes, sessionsRes, mineRes, libraryRes] = await Promise.all([
        fetch('/api/curriculum', { cache: 'no-store' }),
        fetch('/api/facilitator-applications', { cache: 'no-store' }),
        fetch('/api/guided-group-sessions?take=200', { cache: 'no-store' }),
        fetch('/api/guided-group-sessions/mine', { cache: 'no-store' }),
        fetch('/api/guided-group-sessions/library?take=50', { cache: 'no-store' }),
      ]);

      const curriculumData = (await curriculumRes.json().catch(() => ({}))) as {
        subjects?: Array<{
          slug?: string;
          nameEn?: string;
          nameAz?: string;
          topics?: Array<{ slug?: string; nameEn?: string; nameAz?: string }>;
        }>;
      };
      const appData = (await appRes.json().catch(() => ({}))) as ApplicationPayload;
      const sessionsData = (await sessionsRes.json().catch(() => ([]))) as unknown;
      const mineData = (await mineRes.json().catch(() => ([]))) as unknown;
      const libraryData = (await libraryRes.json().catch(() => ([]))) as unknown;

      const curriculumSubjects = Array.isArray(curriculumData?.subjects)
        ? curriculumData.subjects
            .filter((s) => s && typeof s.slug === 'string')
            .map((s) => ({
              slug: String(s.slug),
              nameEn: String(s.nameEn ?? s.slug),
              nameAz: String(s.nameAz ?? s.slug),
              topics: Array.isArray(s.topics)
                ? s.topics
                    .filter((t) => t && typeof t.slug === 'string')
                    .map((t) => ({
                      slug: String(t.slug),
                      nameEn: String(t.nameEn ?? t.slug),
                      nameAz: String(t.nameAz ?? t.slug),
                    }))
                : [],
            }))
        : [];

      const nextApplication =
        appData && typeof appData === 'object' && appData.application
          ? appData.application
          : null;

      setSubjects(curriculumSubjects);
      setSessions(Array.isArray(sessionsData) ? (sessionsData as GuidedGroupSessionRow[]) : []);
      setMySessions(Array.isArray(mineData) ? (mineData as MyGuidedGroupSessionRow[]) : []);
      setLibrarySessions(Array.isArray(libraryData) ? (libraryData as LibraryGuidedGroupSessionRow[]) : []);
      setApplication(nextApplication);
      setVerifiedSubjectIds(Array.isArray(appData?.verifiedSubjectIds) ? appData.verifiedSubjectIds : []);

      if (nextApplication) {
        setPhoneNumber(nextApplication.phoneNumber ?? '');
        setFinCode(nextApplication.finCode ?? '');
        setMotivationLetter(nextApplication.motivationLetter ?? '');
        setSelectedSubjectIds(
          Array.isArray(nextApplication.subjects)
            ? nextApplication.subjects.map((s) => s.subjectId).filter(Boolean)
            : [],
        );
      }
    } catch {
      setSubjects([]);
      setSessions([]);
      setMySessions([]);
      setLibrarySessions([]);
      setApplication(null);
      setVerifiedSubjectIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isVerifiedFacilitator) return;
    if (sessionSubjectId) return;
    const first = verifiedSubjectIds[0] ?? '';
    if (first) setSessionSubjectId(first);
  }, [isVerifiedFacilitator, verifiedSubjectIds, sessionSubjectId]);

  useEffect(() => {
    if (!sessionSubjectId) {
      if (sessionTopicId) setSessionTopicId('');
      return;
    }
    const subject = subjects.find((s) => s.slug === sessionSubjectId);
    const topicSlugs = new Set((subject?.topics ?? []).map((t) => t.slug));
    const first = subject?.topics?.[0]?.slug ?? '';
    if (!first) {
      setSessionTopicId('');
      return;
    }
    if (!sessionTopicId || !topicSlugs.has(sessionTopicId)) {
      setSessionTopicId(first);
    }
  }, [sessionSubjectId, sessionTopicId, subjects]);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      const set = new Set(prev);
      if (set.has(subjectId)) set.delete(subjectId);
      else set.add(subjectId);
      return Array.from(set).sort();
    });
  };

  const submit = async () => {
    if (submitting) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error(copy.facilitatorApplication?.toastPhoneRequired ?? 'Phone number is required.');
      return;
    }

    if (!finCode.trim()) {
      toast.error(copy.facilitatorApplication?.toastFinRequired ?? 'FIN code is required.');
      return;
    }

    if (motivationLetter.trim().length < 20) {
      toast.error(copy.facilitatorApplication?.toastMotivationRequired ?? 'Motivation letter is too short.');
      return;
    }

    if (selectedSubjectIds.length === 0) {
      toast.error(copy.facilitatorApplication?.toastSubjectsRequired ?? 'Select at least one subject.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/facilitator-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          finCode,
          motivationLetter,
          subjectIds: selectedSubjectIds,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorText =
          typeof data?.error === 'string' && data.error.trim().length > 0
            ? data.error
            : copy.facilitatorApplication?.toastSubmitFailed ?? 'Failed to submit application.';
        toast.error(errorText);
        return;
      }

      toast.success(copy.facilitatorApplication?.toastSubmitted ?? 'Application submitted.');
      await load();
    } catch {
      toast.error(copy.facilitatorApplication?.toastSubmitFailed ?? 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const createSession = async () => {
    if (creatingSession) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (!isVerifiedFacilitator) {
      toast.error('You are not verified to facilitate sessions yet.');
      return;
    }

    const title = sessionTitle.trim();
    if (title.length < 3) {
      toast.error('Session name is required.');
      return;
    }

    if (!sessionSubjectId) {
      toast.error('Select a subject.');
      return;
    }

    if (!sessionTopicId) {
      toast.error('Select a topic.');
      return;
    }

    if (!sessionScheduledAt) {
      toast.error('Select a date and time.');
      return;
    }

    const scheduled = new Date(sessionScheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error('Invalid date.');
      return;
    }

    const objectiveLines = objectiveSlots
      .map((value) => value.trim())
      .filter(Boolean);
    if (objectiveLines.length < 2) {
      toast.error('Add at least 2 objectives.');
      return;
    }

    setCreatingSession(true);
    try {
      const res = await fetch('/api/guided-group-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subjectId: sessionSubjectId,
          topicId: sessionTopicId,
          scheduledAt: scheduled.toISOString(),
          durationMinutes: sessionDuration,
          learnerCapacity: sessionCapacity,
          objectives: objectiveLines.join('\n'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to schedule session.');
        return;
      }
      toast.success('Session scheduled.');
      setSessionTitle('');
      setSessionScheduledAt('');
      setObjectiveSlots(['', '', '', '', '']);
      await load();
    } catch {
      toast.error('Failed to schedule session.');
    } finally {
      setCreatingSession(false);
    }
  };

  const requestToJoin = async (sessionId: string) => {
    if (busySessionId) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }

    setBusySessionId(sessionId);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(sessionId)}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to request.');
        return;
      }
      const nextStatus = typeof data?.status === 'string' ? data.status : 'PENDING';
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, enrollmentStatus: nextStatus } : s)),
      );
      toast.success(nextStatus === 'PENDING' ? 'Request sent.' : 'Updated.');
      await load();
    } catch {
      toast.error('Failed to request.');
    } finally {
      setBusySessionId(null);
    }
  };

  const cancelEnrollment = async (sessionId: string) => {
    if (busySessionId) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }

    setBusySessionId(sessionId);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(sessionId)}/enroll`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to cancel request.');
        return;
      }
      toast.success('Request cancelled.');
      await load();
    } catch {
      toast.error('Failed to cancel request.');
    } finally {
      setBusySessionId(null);
    }
  };

  const decideEnrollment = async (
    sessionId: string,
    enrollmentId: string,
    next: 'APPROVED' | 'REJECTED',
  ) => {
    if (busyEnrollmentId) return;
    setBusyEnrollmentId(enrollmentId);
    try {
      const res = await fetch(
        `/api/guided-group-sessions/${encodeURIComponent(sessionId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to update enrollment.');
        return;
      }
      toast.success(next === 'APPROVED' ? 'Approved.' : 'Rejected.');
      await load();
    } catch {
      toast.error('Failed to update enrollment.');
    } finally {
      setBusyEnrollmentId(null);
    }
  };

  const cancelSession = async (sessionId: string) => {
    if (busySessionId) return;
    if (!confirm('Cancel this session?')) return;
    setBusySessionId(sessionId);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to cancel session.');
        return;
      }
      if (typeof data?.balanceAfter === 'number') {
        dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success('Session cancelled.');
      await load();
    } catch {
      toast.error('Failed to cancel session.');
    } finally {
      setBusySessionId(null);
    }
  };

  const startSession = async (sessionId: string) => {
    if (busySessionId) return;
    setBusySessionId(sessionId);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(sessionId)}/start`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === 'string' && data.error ? data.error : 'Failed to start session.');
        return;
      }
      toast.success('Session started.');
      await load();
    } catch {
      toast.error('Failed to start session.');
    } finally {
      setBusySessionId(null);
    }
  };

  const verifiedSubjectLabels = useMemo(() => {
    const ids = verifiedSubjectIds ?? [];
    return ids
      .map((id) => subjectNameById.get(id) ?? id)
      .filter(Boolean);
  }, [verifiedSubjectIds, subjectNameById]);

  const verifiedSubjects = useMemo(
    () => subjects.filter((s) => verifiedSubjectIds.includes(s.slug)),
    [subjects, verifiedSubjectIds],
  );

  const browseTopics = useMemo(() => {
    if (!browseSubjectId) return [];
    const subject = subjects.find((s) => s.slug === browseSubjectId);
    return subject?.topics ?? [];
  }, [browseSubjectId, subjects]);

  useEffect(() => {
    if (!browseSubjectId) {
      setBrowseTopicId('');
      return;
    }
    if (browseTopicId && !browseTopics.some((t) => t.slug === browseTopicId)) {
      setBrowseTopicId('');
    }
  }, [browseSubjectId, browseTopicId, browseTopics]);

  const availableTopics = useMemo(() => {
    const subject = subjects.find((s) => s.slug === sessionSubjectId);
    return subject?.topics ?? [];
  }, [subjects, sessionSubjectId]);

  const myEnrollmentSessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.enrollmentStatus && s.enrollmentStatus !== 'CANCELLED' && s.facilitator?.id !== user.id,
      ),
    [sessions, user.id],
  );

  const filteredUpcomingSessions = useMemo(() => {
    const query = browseQuery.trim().toLowerCase();
    const q = query.length > 0 ? query : null;
    return sessions.filter((s) => {
      if (browseSubjectId && s.subjectId !== browseSubjectId) return false;
      if (browseTopicId && s.topicId !== browseTopicId) return false;
      if (!q) return true;
      const haystack = `${s.title} ${s.facilitator?.name ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, browseQuery, browseSubjectId, browseTopicId]);

  const shouldGroupUpcomingBySubject = useMemo(() => {
    return !browseQuery.trim() && !browseSubjectId && !browseTopicId;
  }, [browseQuery, browseSubjectId, browseTopicId]);

  const upcomingBySubject = useMemo(() => {
    if (!shouldGroupUpcomingBySubject) return [];
    const map = new Map<string, GuidedGroupSessionRow[]>();
    for (const session of filteredUpcomingSessions) {
      const list = map.get(session.subjectId) ?? [];
      list.push(session);
      map.set(session.subjectId, list);
    }
    const entries = Array.from(map.entries()).map(([subjectId, list]) => ({
      subjectId,
      label: subjectNameById.get(subjectId) ?? subjectId,
      sessions: [...list].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    }));
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return entries;
  }, [filteredUpcomingSessions, shouldGroupUpcomingBySubject, subjectNameById]);

  const renderUpcomingList = (items: GuidedGroupSessionRow[]) => {
    if (items.length === 0) return null;
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((session) => {
          const when = new Date(session.scheduledAt);
          const nowMs = Date.now();
          const startMs = when.getTime();
          const subjectLabel = subjectNameById.get(session.subjectId) ?? session.subjectId;
          const topicLabel = topicNameByKey.get(`${session.subjectId}:${session.topicId}`) ?? session.topicId;
          const approvedCount = session.approvedCount ?? 0;
          const seatsLeft = Math.max(0, session.learnerCapacity - approvedCount);
          const isOwnSession = session.facilitator?.id === user.id;
          const isBusy = busySessionId === session.id;
          const status = session.enrollmentStatus;
          const canRequest =
            session.status === 'SCHEDULED' &&
            !isOwnSession &&
            startMs > nowMs &&
            seatsLeft > 0 &&
            (!status || status === 'CANCELLED');
          const isApproved = status === 'APPROVED';
          const canJoinLive = isApproved && session.status === 'LIVE';
          return (
            <li key={session.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {subjectLabel} · {topicLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                      {dateFormatter.format(when)}
                    </span>
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                      {timeFormatter.format(when)}
                    </span>
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                      {session.durationMinutes} min
                    </span>
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                      {approvedCount}/{session.learnerCapacity} seats
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Facilitator: {session.facilitator?.name ?? '—'}</p>
                </div>

                <div className="shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isBusy || isOwnSession || (!canRequest && !canJoinLive)}
                    onClick={() => {
                      if (canJoinLive) {
                        router.push(`/library/guided-group-sessions/${session.id}`);
                        return;
                      }
                      if (canRequest) {
                        void requestToJoin(session.id);
                      }
                    }}
                  >
                    {isOwnSession
                      ? 'Your session'
                      : canJoinLive
                        ? 'Join live'
                        : status
                          ? status === 'PENDING'
                            ? 'Requested'
                            : status === 'APPROVED'
                              ? 'Approved'
                              : status === 'REJECTED'
                                ? 'Rejected'
                                : status === 'CANCELLED'
                                  ? 'Request again'
                                  : status
                          : session.status === 'LIVE'
                            ? 'Live'
                            : seatsLeft === 0
                              ? 'Full'
                              : startMs <= nowMs
                                ? 'Started'
                                : 'Request to join'}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="card-frame bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">
                {copy.facilitatorApplication?.title ?? 'Facilitator application'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {copy.facilitatorApplication?.description ??
                  'Apply to facilitate guided group sessions. Admins will review your request.'}
              </p>
            </div>
            <Button
              size="sm"
              variant={application?.status === 'CHANGES_REQUESTED' ? 'secondary-primary' : 'outline'}
              disabled={!canWrite}
              onClick={() => setApplicationDialogOpen(true)}
            >
              {isVerifiedFacilitator ? 'View' : 'Apply'}
            </Button>
          </div>

          {application?.reviewerMessage ? (
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                application.status === 'CHANGES_REQUESTED'
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200'
                  : application.status === 'REJECTED'
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-border bg-muted/30 text-foreground',
              )}
            >
              <div className="text-xs font-medium uppercase tracking-wider opacity-80">
                {application.status === 'CHANGES_REQUESTED'
                  ? copy.facilitatorApplication?.changesRequestedLabel ?? 'Changes requested'
                  : application.status === 'REJECTED'
                    ? copy.facilitatorApplication?.rejectedLabel ?? 'Rejected'
                    : copy.facilitatorApplication?.statusLabel ?? 'Update'}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{application.reviewerMessage}</p>
            </div>
          ) : null}

          {verifiedSubjectLabels.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {copy.facilitatorApplication?.verifiedSubjectsLabel ?? 'Verified subjects'}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {verifiedSubjectLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={applicationDialogOpen} onOpenChange={setApplicationDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.facilitatorApplication?.title ?? 'Facilitator application'}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.facilitatorApplication?.description ??
                'Apply to facilitate guided group sessions. Admins will review your request.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.name ?? 'Name'}
                </label>
                <Input
                  value={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.age ?? 'Age'}
                </label>
                <Input
                  value={profile.ageYears != null ? String(profile.ageYears) : '—'}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.email ?? 'Email'}
                </label>
                <Input value={profile.email} readOnly disabled />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.grade ?? 'Grade'}
                </label>
                <Input value={profile.grade ?? '—'} readOnly disabled />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.parentName ?? 'Parent name'}
                </label>
                <Input
                  value={[profile.parentFirstName, profile.parentLastName].filter(Boolean).join(' ') || '—'}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.parentEmail ?? 'Parent email'}
                </label>
                <Input value={profile.parentEmail ?? '—'} readOnly disabled />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.phoneNumber ?? 'Phone number'}
                </label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+994..."
                  disabled={loading || submitting || isPending}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.finCode ?? 'FIN code'}
                </label>
                <Input
                  value={finCode}
                  onChange={(e) => setFinCode(e.target.value)}
                  placeholder="FIN..."
                  disabled={loading || submitting || isPending}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {copy.facilitatorApplication?.labels?.motivationLetter ?? 'Motivation letter'}
              </label>
              <textarea
                value={motivationLetter}
                onChange={(e) => setMotivationLetter(e.target.value)}
                disabled={loading || submitting || isPending}
                rows={4}
                className={cn(
                  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground/80',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
                  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-input',
                )}
                placeholder={
                  copy.facilitatorApplication?.placeholders?.motivationLetter ??
                  'Why do you want to facilitate guided group sessions?'
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {copy.facilitatorApplication?.labels?.subjects ?? 'Subjects to teach'}
              </div>
              {subjects.length === 0 && loading ? (
                <p className="text-xs text-muted-foreground">
                  {copy.facilitatorApplication?.loadingSubjects ?? 'Loading subjects…'}
                </p>
              ) : subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {copy.facilitatorApplication?.noSubjects ?? 'No subjects found.'}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {subjects.map((subject) => {
                    const label = subjectNameById.get(subject.slug) ?? subject.slug;
                    const checked = selectedSubjectIds.includes(subject.slug);
                    return (
                      <label
                        key={subject.slug}
                        className={cn(
                          'flex items-start gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2',
                          'cursor-pointer transition-colors hover:bg-muted/20',
                          (loading || submitting || isPending) && 'cursor-not-allowed opacity-60 hover:bg-muted/10',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSubject(subject.slug)}
                          disabled={loading || submitting || isPending}
                          aria-label={label}
                        />
                        <span className="text-sm text-foreground">{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={submit}
                disabled={loading || submitting || isPending}
                variant="secondary-primary"
                size="sm"
              >
                {isPending
                  ? copy.facilitatorApplication?.pendingCta ?? 'Application pending'
                  : submitting
                    ? copy.facilitatorApplication?.submittingCta ?? 'Submitting…'
                    : copy.facilitatorApplication?.submitCta ?? 'Submit application'}
              </Button>
              {isPending ? (
                <span className="text-xs text-muted-foreground">
                  {copy.facilitatorApplication?.pendingHint ??
                    'Your application is under review. You will get an update in Recent activities.'}
                </span>
              ) : null}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{locale === 'az' ? 'Bağla' : 'Close'}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isVerifiedFacilitator ? (
        <Card className="card-frame bg-card">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">Schedule a session</h2>
              <p className="text-xs text-muted-foreground">
                Only subjects you are verified for are available.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Session name</label>
                <Input
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Algebra practice"
                  disabled={loading || creatingSession}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Date & time</label>
                <Input
                  type="datetime-local"
                  value={sessionScheduledAt}
                  onChange={(e) => setSessionScheduledAt(e.target.value)}
                  disabled={loading || creatingSession}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration</label>
                <Select
                  value={String(sessionDuration)}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  disabled={loading || creatingSession}
                >
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Select
                  value={sessionSubjectId}
                  onChange={(e) => setSessionSubjectId(e.target.value)}
                  disabled={loading || creatingSession || verifiedSubjects.length === 0}
                  placeholder={verifiedSubjects.length === 0 ? 'No verified subjects' : 'Select subject'}
                >
                  {verifiedSubjects.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {subjectNameById.get(s.slug) ?? s.slug}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Topic</label>
                <Select
                  value={sessionTopicId}
                  onChange={(e) => setSessionTopicId(e.target.value)}
                  disabled={loading || creatingSession || availableTopics.length === 0}
                  placeholder={availableTopics.length === 0 ? 'No topics' : 'Select topic'}
                >
                  {availableTopics.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {topicNameByKey.get(`${sessionSubjectId}:${t.slug}`) ?? t.slug}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Learners</label>
                <Select
                  value={String(sessionCapacity)}
                  onChange={(e) => setSessionCapacity(Number(e.target.value))}
                  disabled={loading || creatingSession}
                >
                  <SelectItem value="2">2 learners</SelectItem>
                  <SelectItem value="3">3 learners</SelectItem>
                  <SelectItem value="4">4 learners</SelectItem>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Objectives</p>
              <div className="grid gap-2">
                {objectiveSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-muted-foreground">{idx + 1}.</span>
                    <Input
                      value={slot}
                      onChange={(e) => {
                        const next = [...objectiveSlots];
                        next[idx] = e.target.value;
                        setObjectiveSlots(next);
                      }}
                      placeholder={`Objective ${idx + 1}`}
                      disabled={loading || creatingSession}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Add at least 2 objectives.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary-primary"
                onClick={createSession}
                disabled={loading || creatingSession || verifiedSubjects.length === 0}
              >
                {creatingSession ? 'Scheduling…' : 'Schedule session'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {myEnrollmentSessions.length > 0 ? (
        <Card className="card-frame bg-card">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">My registrations</h2>
              <p className="text-xs text-muted-foreground">
                Track your join requests and access live sessions when they start.
              </p>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border">
              {myEnrollmentSessions.map((session) => {
                const when = new Date(session.scheduledAt);
                const subjectLabel = subjectNameById.get(session.subjectId) ?? session.subjectId;
                const topicLabel =
                  topicNameByKey.get(`${session.subjectId}:${session.topicId}`) ?? session.topicId;
                const isBusy = busySessionId === session.id;
                const isApproved = session.enrollmentStatus === 'APPROVED';
                const isPendingEnrollment = session.enrollmentStatus === 'PENDING';
                const isRejected = session.enrollmentStatus === 'REJECTED';
                const canJoinLive = isApproved && session.status === 'LIVE';

                return (
                  <li key={`my-enrollment-${session.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {subjectLabel} · {topicLabel}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {dateFormatter.format(when)}
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {timeFormatter.format(when)}
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {session.durationMinutes} min
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            Status: {session.enrollmentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canJoinLive ? (
                          <Button
                            size="sm"
                            variant="secondary-primary"
                            disabled={isBusy}
                            onClick={() => router.push(`/library/guided-group-sessions/${session.id}`)}
                          >
                            Join live
                          </Button>
                        ) : isPendingEnrollment ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => cancelEnrollment(session.id)}
                          >
                            Cancel request
                          </Button>
                        ) : isApproved ? (
                          <Button size="sm" variant="secondary" disabled>
                            Approved
                          </Button>
                        ) : isRejected ? (
                          <Button size="sm" variant="outline" disabled>
                            Rejected
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isVerifiedFacilitator ? (
        <Card className="card-frame bg-card">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">Your sessions</h2>
                <p className="text-xs text-muted-foreground">
                  Approve learners, start on time, and manage your upcoming sessions.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading your sessions…</p>
            ) : mySessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 px-5 py-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">No scheduled sessions.</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Schedule a session above to start accepting learners.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {mySessions.map((session) => {
                  const when = new Date(session.scheduledAt);
                  const subjectLabel = subjectNameById.get(session.subjectId) ?? session.subjectId;
                  const topicLabel =
                    topicNameByKey.get(`${session.subjectId}:${session.topicId}`) ?? session.topicId;
                  const isBusy = busySessionId === session.id;
                  const isLive = session.status === 'LIVE';
                  const isScheduled = session.status === 'SCHEDULED';
                  const canStart = isScheduled && session.approvedCount >= 2;
                  return (
                    <div key={`my-session-${session.id}`} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {subjectLabel} · {topicLabel}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              {dateFormatter.format(when)}
                            </span>
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              {timeFormatter.format(when)}
                            </span>
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              {session.durationMinutes} min
                            </span>
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              {session.approvedCount}/{session.learnerCapacity} approved
                            </span>
                            {session.pendingCount > 0 ? (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-200">
                                {session.pendingCount} pending
                              </span>
                            ) : null}
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              {session.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isLive ? (
                            <Button
                              size="sm"
                              variant="secondary-primary"
                              disabled={isBusy}
                              onClick={() => router.push(`/library/guided-group-sessions/${session.id}`)}
                            >
                              Open room
                            </Button>
                          ) : null}
                          {isScheduled ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isBusy || !canStart}
                              onClick={() => startSession(session.id)}
                            >
                              Start
                            </Button>
                          ) : null}
                          {isScheduled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => cancelSession(session.id)}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {session.enrollments.length > 0 ? (
                        <div className="rounded-lg border border-border bg-background/60">
                          <div className="px-4 py-2 border-b border-border">
                            <p className="text-xs font-medium text-muted-foreground">Learners</p>
                          </div>
                          <ul className="divide-y divide-border">
                            {session.enrollments.map((enrollment) => {
                              const learnerName =
                                [enrollment.user.firstName, enrollment.user.lastName].filter(Boolean).join(' ') ||
                                enrollment.user.email.split('@')[0];
                              const isEnrollmentBusy = busyEnrollmentId === enrollment.id;
                              const canApprove = enrollment.status === 'PENDING' && session.approvedCount < session.learnerCapacity;
                              const canReject = enrollment.status === 'PENDING' || enrollment.status === 'APPROVED';
                              return (
                                <li key={enrollment.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{learnerName}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{enrollment.user.email}</p>
                                    <p className="text-[11px] text-muted-foreground">Status: {enrollment.status}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {canApprove ? (
                                      <Button
                                        size="sm"
                                        variant="secondary-primary"
                                        disabled={isEnrollmentBusy || isBusy}
                                        onClick={() => decideEnrollment(session.id, enrollment.id, 'APPROVED')}
                                      >
                                        Approve
                                      </Button>
                                    ) : null}
                                    {canReject ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isEnrollmentBusy || isBusy}
                                        onClick={() => decideEnrollment(session.id, enrollment.id, 'REJECTED')}
                                      >
                                        Reject
                                      </Button>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No enrollment requests yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="card-frame bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">Archived sessions</h2>
              <p className="text-xs text-muted-foreground">
                Completed sessions are saved here for facilitators and registered learners.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading archived sessions…</p>
          ) : librarySessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 px-5 py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">No archived sessions yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Completed sessions will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {librarySessions.map((session) => {
                const when = new Date(session.scheduledAt);
                const subjectLabel = subjectNameById.get(session.subjectId) ?? session.subjectId;
                const topicLabel =
                  topicNameByKey.get(`${session.subjectId}:${session.topicId}`) ?? session.topicId;
                const needsRating = session.myRole === 'LEARNER' && session.myRating == null;
                return (
                  <li key={`archived-${session.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {subjectLabel} · {topicLabel}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {dateFormatter.format(when)}
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {timeFormatter.format(when)}
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {session.durationMinutes} min
                          </span>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            {session.myRole === 'FACILITATOR' ? 'Facilitator' : 'Learner'}
                          </span>
                          {session.myRole === 'LEARNER' ? (
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                              Rating: {session.myRating ?? '—'}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Button
                          size="sm"
                          variant={needsRating ? 'secondary-primary' : 'outline'}
                          onClick={() => router.push(`/library/guided-group-sessions/${session.id}`)}
                        >
                          {needsRating ? 'Rate now' : 'View'}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="card-frame bg-card">
        <CardContent className="p-5 space-y-4">
	          <div className="flex flex-wrap items-start justify-between gap-3">
	            <div className="space-y-1">
	              <h2 className="text-sm font-medium text-foreground">Upcoming sessions</h2>
	              <p className="text-xs text-muted-foreground">
	                {copy.body ??
	                  'This space will include schedules, topics, and how to join upcoming group sessions.'}
	              </p>
	            </div>
	            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
	              Refresh
	            </Button>
	          </div>

	          <div className="grid gap-2 sm:grid-cols-3">
	            <div className="sm:col-span-3">
	              <Input
	                value={browseQuery}
	                onChange={(e) => setBrowseQuery(e.target.value)}
	                placeholder={locale === 'az' ? 'Sessiya axtar…' : 'Search sessions…'}
	                disabled={loading}
	              />
	            </div>
	            <div>
	              <label className="text-xs font-medium text-muted-foreground">
	                {locale === 'az' ? 'Fənn' : 'Subject'}
	              </label>
	              <Select
	                value={browseSubjectId}
	                onChange={(e) => setBrowseSubjectId(e.target.value)}
	                disabled={loading}
	              >
	                <SelectItem value="">{locale === 'az' ? 'Bütün fənlər' : 'All subjects'}</SelectItem>
	                {subjects.map((s) => (
	                  <SelectItem key={`browse-subject-${s.slug}`} value={s.slug}>
	                    {subjectNameById.get(s.slug) ?? s.slug}
	                  </SelectItem>
	                ))}
	              </Select>
	            </div>
	            <div>
	              <label className="text-xs font-medium text-muted-foreground">
	                {locale === 'az' ? 'Mövzu' : 'Topic'}
	              </label>
	              <Select
	                value={browseTopicId}
	                onChange={(e) => setBrowseTopicId(e.target.value)}
	                disabled={loading || !browseSubjectId || browseTopics.length === 0}
	              >
	                <SelectItem value="">{locale === 'az' ? 'Bütün mövzular' : 'All topics'}</SelectItem>
	                {browseTopics.map((t) => (
	                  <SelectItem key={`browse-topic-${t.slug}`} value={t.slug}>
	                    {topicNameByKey.get(`${browseSubjectId}:${t.slug}`) ?? t.slug}
	                  </SelectItem>
	                ))}
	              </Select>
	            </div>
	            <div className="flex items-end">
	              <Button
	                size="sm"
	                variant="outline"
	                className="w-full"
	                onClick={() => {
	                  setBrowseQuery('');
	                  setBrowseSubjectId('');
	                  setBrowseTopicId('');
	                }}
	                disabled={loading || (!browseQuery && !browseSubjectId && !browseTopicId)}
	              >
	                {locale === 'az' ? 'Sıfırla' : 'Reset'}
	              </Button>
	            </div>
	          </div>

	          {loading ? (
	            <p className="text-sm text-muted-foreground">{locale === 'az' ? 'Yüklənir…' : 'Loading sessions…'}</p>
	          ) : filteredUpcomingSessions.length === 0 ? (
	            <div className="rounded-lg border border-dashed border-border bg-muted/10 px-5 py-10 text-center">
	              <p className="text-sm font-medium text-muted-foreground">
	                {locale === 'az' ? 'Sessiya tapılmadı.' : 'No sessions found.'}
	              </p>
	              <p className="mt-1 text-xs text-muted-foreground/70">
	                {locale === 'az' ? 'Filtrləri dəyişin.' : 'Try adjusting your filters.'}
	              </p>
	            </div>
	          ) : shouldGroupUpcomingBySubject ? (
	            <div className="space-y-4">
	              {upcomingBySubject.map((section) => (
	                <div key={`upcoming-subject-${section.subjectId}`} className="space-y-2">
	                  <div className="flex flex-wrap items-center justify-between gap-2">
	                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
	                      {section.label}
	                    </p>
	                    <p className="text-[11px] text-muted-foreground">{section.sessions.length}</p>
	                  </div>
	                  {renderUpcomingList(section.sessions)}
	                </div>
	              ))}
	            </div>
	          ) : (
	            renderUpcomingList(filteredUpcomingSessions)
	          )}
	        </CardContent>
	      </Card>
	    </div>
	  );
}
