'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  createdAt: string | null;
  durationMinutes: number;
  learnerCapacity: number;
  status: string;
  ratingAvg: number;
  ratingCount: number;
  facilitator: { id: string; name: string; avatarVariant: string | null };
  enrollmentStatus: string | null;
  approvedCount: number;
};

function parseSubjectFromBrowseQuery(
  rawQuery: string,
  subjects: CurriculumSubject[],
): { subjectId: string; textQuery: string } {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { subjectId: '', textQuery: '' };
  if (!trimmed.startsWith('#')) return { subjectId: '', textQuery: trimmed };

  const [token, ...rest] = trimmed.split(/\s+/);
  const slug = token.slice(1).trim().toLowerCase();
  if (!slug) return { subjectId: '', textQuery: trimmed };
  if (!subjects.some((s) => s.slug === slug)) return { subjectId: '', textQuery: trimmed };

  return { subjectId: slug, textQuery: rest.join(' ').trim() };
}

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
  const copy = messages.app.guidedGroupSessions;
  const { timeFormat } = useSettings();
  const { user, canWrite, writeRestriction } = useCurrentUser();
  const router = useRouter();

  const guideStudentLabel = locale === 'az' ? 'Bələdçi şagird' : 'Facilitator';
  const scheduleLabel = locale === 'az' ? 'Sessiya planla' : 'Schedule a session';
  const applyLabel = locale === 'az' ? 'Bələdçi şagird ol' : 'Become a facilitator';

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [sessions, setSessions] = useState<GuidedGroupSessionRow[]>([]);

  const [application, setApplication] = useState<FacilitatorApplication | null>(null);
  const [verifiedSubjectIds, setVerifiedSubjectIds] = useState<string[]>([]);

  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const [busySessionId, setBusySessionId] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [finCode, setFinCode] = useState('');
  const [motivationLetter, setMotivationLetter] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [submittingApplication, setSubmittingApplication] = useState(false);

  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSubjectId, setSessionSubjectId] = useState('');
  const [sessionTopicId, setSessionTopicId] = useState('');
  const [sessionScheduledAt, setSessionScheduledAt] = useState('');
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [sessionCapacity, setSessionCapacity] = useState<number>(2);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(['', '', '', '', '']);
  const [creatingSession, setCreatingSession] = useState(false);

  const [browseQuery, setBrowseQuery] = useState('');
  const [browseTopicId, setBrowseTopicId] = useState('');
  const parsedBrowse = useMemo(
    () => parseSubjectFromBrowseQuery(browseQuery, subjects),
    [browseQuery, subjects],
  );
  const browseSubjectId = parsedBrowse.subjectId;
  const browseTextQuery = parsedBrowse.textQuery;

  const [sessionSubjectSearch, setSessionSubjectSearch] = useState('');

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

  const verifiedSubjectSet = useMemo(() => new Set(verifiedSubjectIds), [verifiedSubjectIds]);
  const isVerifiedGuideStudent = verifiedSubjectIds.length > 0;
  const isPendingApplication = application?.status === 'PENDING';

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
        map.set(`${subject.slug}:${topic.slug}`, locale === 'az' ? topic.nameAz : topic.nameEn);
      }
    }
    return map;
  }, [subjects, locale]);

  const availableTopics = useMemo(() => {
    const subject = subjects.find((s) => s.slug === sessionSubjectId);
    return subject?.topics ?? [];
  }, [subjects, sessionSubjectId]);

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

  useEffect(() => {
    if (!scheduleDialogOpen) return;
    if (sessionSubjectId && subjects.some((s) => s.slug === sessionSubjectId)) return;
    const firstVerified = verifiedSubjectIds.find((id) => subjects.some((s) => s.slug === id)) ?? '';
    setSessionSubjectId(firstVerified);
    setSessionSubjectSearch(firstVerified);
  }, [scheduleDialogOpen, sessionSubjectId, subjects, verifiedSubjectIds]);

  useEffect(() => {
    if (!scheduleDialogOpen) return;
    if (sessionSubjectId && sessionSubjectSearch !== sessionSubjectId) {
      setSessionSubjectSearch(sessionSubjectId);
    }
  }, [scheduleDialogOpen, sessionSubjectId, sessionSubjectSearch]);

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

  const filteredSessions = useMemo(() => {
    const query = browseTextQuery.trim().toLowerCase();
    const q = query.length > 0 ? query : null;
    return sessions.filter((s) => {
      if (browseSubjectId && s.subjectId !== browseSubjectId) return false;
      if (browseTopicId && s.topicId !== browseTopicId) return false;
      if (!q) return true;
      const haystack = `${s.title} ${s.facilitator?.name ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, browseTextQuery, browseSubjectId, browseTopicId]);

  const liveNowSessions = useMemo(() => {
    return [...filteredSessions]
      .filter((s) => s.status === 'LIVE')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [filteredSessions]);

  const mostRecentSessions = useMemo(() => {
    return [...filteredSessions]
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      })
      .slice(0, 12);
  }, [filteredSessions]);

  const topRatedGuideSessions = useMemo(() => {
    return [...filteredSessions]
      .filter((s) => (s.ratingCount ?? 0) > 0)
      .sort((a, b) => {
        const ratingDiff = (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
        if (Math.abs(ratingDiff) > 1e-6) return ratingDiff > 0 ? 1 : -1;
        return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      })
      .slice(0, 12);
  }, [filteredSessions]);

  const startingSoonSessions = useMemo(() => {
    return [...filteredSessions]
      .filter((s) => s.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 12);
  }, [filteredSessions]);

  const load = async () => {
    setLoading(true);
    try {
      const [curriculumRes, appRes, sessionsRes] = await Promise.all([
        fetch('/api/curriculum', { cache: 'no-store' }),
        fetch('/api/facilitator-applications', { cache: 'no-store' }),
        fetch('/api/guided-group-sessions?take=200', { cache: 'no-store' }),
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
        appData && typeof appData === 'object' && appData.application ? appData.application : null;

      setSubjects(curriculumSubjects);
      setSessions(Array.isArray(sessionsData) ? (sessionsData as GuidedGroupSessionRow[]) : []);
      setApplication(nextApplication);
      setVerifiedSubjectIds(Array.isArray(appData?.verifiedSubjectIds) ? appData.verifiedSubjectIds : []);

      if (nextApplication) {
        setPhoneNumber(nextApplication.phoneNumber ?? '');
        setFinCode(nextApplication.finCode ?? '');
        setMotivationLetter(nextApplication.motivationLetter ?? '');
        setSelectedSubjectIds(
          Array.isArray(nextApplication.subjects) ? nextApplication.subjects.map((s) => s.subjectId).filter(Boolean) : [],
        );
      }
    } catch {
      setSubjects([]);
      setSessions([]);
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

  const openSchedule = () => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    setScheduleDialogOpen(true);
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      const set = new Set(prev);
      if (set.has(subjectId)) set.delete(subjectId);
      else set.add(subjectId);
      return Array.from(set).sort();
    });
  };

  const submitApplication = async () => {
    if (submittingApplication) return;
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

    setSubmittingApplication(true);
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
          typeof data?.error === 'string' && data.error.trim().length > 0 ? data.error.trim() : null;
        toast.error(errorText ?? copy.facilitatorApplication?.toastSubmitFailed ?? 'Failed to submit application.');
        return;
      }
      toast.success(copy.facilitatorApplication?.toastSubmitted ?? 'Application submitted.');
      await load();
    } catch {
      toast.error(copy.facilitatorApplication?.toastSubmitFailed ?? 'Failed to submit application.');
    } finally {
      setSubmittingApplication(false);
    }
  };

  const createSession = async () => {
    if (creatingSession) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }

    const title = sessionTitle.trim();
    if (title.length < 3) {
      toast.error(locale === 'az' ? 'Sessiya adı tələb olunur.' : 'Session name is required.');
      return;
    }

    if (!sessionSubjectId) {
      toast.error(locale === 'az' ? 'Fənn seçin.' : 'Select a subject.');
      return;
    }

    if (!verifiedSubjectSet.has(sessionSubjectId)) {
      toast.error(
        locale === 'az'
          ? 'Bu fənn üçün bələdçi şagird kimi təsdiqlənməmisiniz.'
          : 'You are not verified to facilitate this subject.',
      );
      setApplicationDialogOpen(true);
      return;
    }

    if (!sessionTopicId) {
      toast.error(locale === 'az' ? 'Mövzu seçin.' : 'Select a topic.');
      return;
    }

    if (!sessionScheduledAt) {
      toast.error(locale === 'az' ? 'Tarix və vaxt seçin.' : 'Select a date and time.');
      return;
    }

    const scheduled = new Date(sessionScheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error(locale === 'az' ? 'Yanlış tarix.' : 'Invalid date.');
      return;
    }

    const objectiveLines = objectiveSlots
      .map((value) => value.trim())
      .filter(Boolean);
    if (objectiveLines.length < 2) {
      toast.error(locale === 'az' ? 'Ən azı 2 məqsəd əlavə edin.' : 'Add at least 2 objectives.');
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
        toast.error(typeof data?.error === 'string' && data.error ? data.error : (locale === 'az' ? 'Sessiyanı planlamaq mümkün olmadı.' : 'Failed to schedule session.'));
        return;
      }
      toast.success(locale === 'az' ? 'Sessiya planlandı.' : 'Session scheduled.');
      setSessionTitle('');
      setSessionScheduledAt('');
      setObjectiveSlots(['', '', '', '', '']);
      await load();
    } catch {
      toast.error(locale === 'az' ? 'Sessiyanı planlamaq mümkün olmadı.' : 'Failed to schedule session.');
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
        toast.error(typeof data?.error === 'string' && data.error ? data.error : (locale === 'az' ? 'İstək göndərmək mümkün olmadı.' : 'Failed to request.'));
        return;
      }
      const nextStatus = typeof data?.status === 'string' ? data.status : 'PENDING';
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, enrollmentStatus: nextStatus } : s)));
      toast.success(nextStatus === 'PENDING' ? (locale === 'az' ? 'İstək göndərildi.' : 'Request sent.') : (locale === 'az' ? 'Yeniləndi.' : 'Updated.'));
      await load();
    } catch {
      toast.error(locale === 'az' ? 'İstək göndərmək mümkün olmadı.' : 'Failed to request.');
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
        toast.error(typeof data?.error === 'string' && data.error ? data.error : (locale === 'az' ? 'İstəyi ləğv etmək mümkün olmadı.' : 'Failed to cancel request.'));
        return;
      }
      toast.success(locale === 'az' ? 'İstək ləğv edildi.' : 'Request cancelled.');
      await load();
    } catch {
      toast.error(locale === 'az' ? 'İstəyi ləğv etmək mümkün olmadı.' : 'Failed to cancel request.');
    } finally {
      setBusySessionId(null);
    }
  };

  const renderSessionList = (items: GuidedGroupSessionRow[]) => {
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
                      {approvedCount}/{session.learnerCapacity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {guideStudentLabel}: {session.facilitator?.name ?? '—'}
                  </p>
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
                      ? locale === 'az'
                        ? 'Sizin sessiya'
                        : 'Your session'
                      : canJoinLive
                        ? locale === 'az'
                          ? 'Canlıya qoşul'
                          : 'Join live'
                        : status
                          ? status === 'PENDING'
                            ? locale === 'az'
                              ? 'İstək göndərildi'
                              : 'Requested'
                            : status === 'APPROVED'
                              ? locale === 'az'
                                ? 'Təsdiq'
                                : 'Approved'
                              : status === 'REJECTED'
                                ? locale === 'az'
                                  ? 'Rədd'
                                  : 'Rejected'
                                : status === 'CANCELLED'
                                  ? locale === 'az'
                                    ? 'Yenidən istə'
                                    : 'Request again'
                                  : status
                          : session.status === 'LIVE'
                            ? locale === 'az'
                              ? 'Canlı'
                              : 'Live'
                            : seatsLeft === 0
                              ? locale === 'az'
                                ? 'Doludur'
                                : 'Full'
                              : startMs <= nowMs
                                ? locale === 'az'
                                  ? 'Başlayıb'
                                  : 'Started'
                                : locale === 'az'
                                  ? 'Qoşulma istəyi'
                                  : 'Request to join'}
                  </Button>
                  {status === 'PENDING' ? (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={isBusy}
                        onClick={() => void cancelEnrollment(session.id)}
                      >
                        {locale === 'az' ? 'İstəyi ləğv et' : 'Cancel request'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder={
                locale === 'az'
                  ? 'Sessiya axtar… (fənn üçün: #fənn-slug)'
                  : 'Search sessions… (subject: #subject-slug)'
              }
              disabled={loading}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary-primary" disabled={loading} onClick={openSchedule}>
              {scheduleLabel}
            </Button>
            <Button
              size="sm"
              variant={application?.status === 'CHANGES_REQUESTED' ? 'secondary-primary' : 'outline'}
              disabled={loading || !canWrite}
              onClick={() => setApplicationDialogOpen(true)}
            >
              {applyLabel}
            </Button>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {locale === 'az' ? 'Yenilə' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Mövzu' : 'Topic'}</label>
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
                setBrowseTopicId('');
              }}
              disabled={loading || (!browseQuery && !browseSubjectId && !browseTopicId)}
            >
              {locale === 'az' ? 'Sıfırla' : 'Reset'}
            </Button>
          </div>
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
      </div>

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
                <Input value={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'} readOnly disabled />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {copy.facilitatorApplication?.labels?.age ?? 'Age'}
                </label>
                <Input value={profile.ageYears != null ? String(profile.ageYears) : '—'} readOnly disabled />
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
                  disabled={loading || submittingApplication || isPendingApplication}
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
                  disabled={loading || submittingApplication || isPendingApplication}
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
                disabled={loading || submittingApplication || isPendingApplication}
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
                          (loading || submittingApplication || isPendingApplication) &&
                            'cursor-not-allowed opacity-60 hover:bg-muted/10',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSubject(subject.slug)}
                          disabled={loading || submittingApplication || isPendingApplication}
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
                onClick={submitApplication}
                disabled={loading || submittingApplication || isPendingApplication}
                variant="secondary-primary"
                size="sm"
              >
                {isPendingApplication
                  ? copy.facilitatorApplication?.pendingCta ?? 'Application pending'
                  : submittingApplication
                    ? copy.facilitatorApplication?.submittingCta ?? 'Submitting…'
                    : copy.facilitatorApplication?.submitCta ?? 'Submit application'}
              </Button>
              {isPendingApplication ? (
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

      <AlertDialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{scheduleLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'az'
                ? 'Yalnız təsdiqlənmiş fənlər üçün sessiya planlaya bilərsiniz.'
                : 'Only subjects you are verified for are available.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {locale === 'az' ? 'Sessiya adı' : 'Session name'}
                </label>
                <Input
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder={locale === 'az' ? 'məs. Cəbr məşqi' : 'e.g. Algebra practice'}
                  disabled={loading || creatingSession}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {locale === 'az' ? 'Tarix və vaxt' : 'Date & time'}
                </label>
                <Input
                  type="datetime-local"
                  value={sessionScheduledAt}
                  onChange={(e) => setSessionScheduledAt(e.target.value)}
                  disabled={loading || creatingSession}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Müddət' : 'Duration'}</label>
                <Select value={String(sessionDuration)} onChange={(e) => setSessionDuration(Number(e.target.value))} disabled={loading || creatingSession}>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="45">45</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                </Select>
              </div>

	              <div>
	                <label className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Fənn' : 'Subject'}</label>
	                <Input
	                  value={sessionSubjectSearch}
	                  onChange={(e) => {
	                    const next = e.target.value.trim().toLowerCase();
	                    setSessionSubjectSearch(next);
	                    if (subjects.some((s) => s.slug === next)) {
	                      setSessionSubjectId(next);
	                    } else if (!next) {
	                      setSessionSubjectId('');
	                    }
	                  }}
	                  placeholder={locale === 'az' ? 'məs. mathematics' : 'e.g. mathematics'}
	                  disabled={loading || creatingSession}
	                />
	                <div className="mt-2 grid gap-1">
	                  {(sessionSubjectSearch ? subjects : subjects.slice(0, 8))
	                    .filter((s) => {
	                      if (!sessionSubjectSearch) return true;
	                      const needle = sessionSubjectSearch.toLowerCase();
	                      return (
	                        s.slug.toLowerCase().includes(needle) ||
	                        (subjectNameById.get(s.slug) ?? s.slug).toLowerCase().includes(needle)
	                      );
	                    })
	                    .slice(0, 8)
	                    .map((s) => {
	                      const isVerified = verifiedSubjectSet.has(s.slug);
	                      const label = subjectNameById.get(s.slug) ?? s.slug;
	                      return (
	                        <button
	                          key={`schedule-subject-${s.slug}`}
	                          type="button"
	                          disabled={loading || creatingSession || !isVerified}
	                          onClick={() => {
	                            setSessionSubjectId(s.slug);
	                            setSessionSubjectSearch(s.slug);
	                          }}
	                          className={cn(
	                            'flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors',
	                            isVerified
	                              ? 'border-border bg-card hover:bg-muted/30'
	                              : 'border-border/60 bg-muted/10 opacity-60',
	                          )}
	                        >
	                          <span className="truncate">{label}</span>
	                          <span className="ml-3 shrink-0 text-[11px] text-muted-foreground">{s.slug}</span>
	                        </button>
	                      );
	                    })}
	                </div>
	                {!isVerifiedGuideStudent ? (
	                  <p className="mt-2 text-xs text-muted-foreground">
	                    {locale === 'az'
	                      ? 'Sessiya planlamaq üçün ən azı bir fənn üzrə təsdiqlənməlisiniz.'
                      : 'To schedule, you must be verified for at least one subject.'}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Mövzu' : 'Topic'}</label>
                <Select
                  value={sessionTopicId}
                  onChange={(e) => setSessionTopicId(e.target.value)}
                  disabled={loading || creatingSession || availableTopics.length === 0}
                >
                  {availableTopics.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {topicNameByKey.get(`${sessionSubjectId}:${t.slug}`) ?? t.slug}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Şagird sayı' : 'Learners'}</label>
                <Select value={String(sessionCapacity)} onChange={(e) => setSessionCapacity(Number(e.target.value))} disabled={loading || creatingSession}>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{locale === 'az' ? 'Məqsədlər' : 'Objectives'}</p>
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
                      placeholder={locale === 'az' ? `Məqsəd ${idx + 1}` : `Objective ${idx + 1}`}
                      disabled={loading || creatingSession}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{locale === 'az' ? 'Ən azı 2 məqsəd əlavə edin.' : 'Add at least 2 objectives.'}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary-primary"
                onClick={async () => {
                  await createSession();
                  setScheduleDialogOpen(false);
                }}
                disabled={
                  loading ||
                  creatingSession ||
                  !sessionSubjectId ||
                  !verifiedSubjectSet.has(sessionSubjectId)
                }
              >
                {creatingSession ? (locale === 'az' ? 'Planlanır…' : 'Scheduling…') : scheduleLabel}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{locale === 'az' ? 'Bağla' : 'Close'}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">{locale === 'az' ? 'Yüklənir…' : 'Loading…'}</p>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 px-5 py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">{locale === 'az' ? 'Sessiya tapılmadı.' : 'No sessions found.'}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">{locale === 'az' ? 'Filtrləri dəyişin.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <>
            {liveNowSessions.length > 0 ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">{locale === 'az' ? 'İndi canlı' : 'Live now'}</h2>
                  <p className="text-[11px] text-muted-foreground">{liveNowSessions.length}</p>
                </div>
                {renderSessionList(liveNowSessions)}
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">{locale === 'az' ? 'Ən yeni əlavə olunanlar' : 'Most recently added'}</h2>
                <p className="text-[11px] text-muted-foreground">{mostRecentSessions.length}</p>
              </div>
              {renderSessionList(mostRecentSessions)}
            </section>

            {topRatedGuideSessions.length > 0 ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">
                    {locale === 'az' ? `Ən yüksək reytinqli ${guideStudentLabel}lər` : 'Top rated facilitators'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">{topRatedGuideSessions.length}</p>
                </div>
                {renderSessionList(topRatedGuideSessions)}
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">{locale === 'az' ? 'Tezliklə başlayır' : 'Starting soon'}</h2>
                <p className="text-[11px] text-muted-foreground">{startingSoonSessions.length}</p>
              </div>
              {renderSessionList(startingSoonSessions)}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
