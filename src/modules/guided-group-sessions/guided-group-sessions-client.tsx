'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { buildTagIndex, createTagMap, normalizeTagToken, parseTaggedQuery, TAG_MATCH_REGEX } from '@/src/lib/tagging';

type CurriculumTopic = {
  slug: string;
  slugAz?: string;
  nameEn: string;
  nameAz: string;
};

type CurriculumSubject = {
  slug: string;
  slugAz?: string;
  nameEn: string;
  nameAz: string;
  topics: CurriculumTopic[];
};

type GuidedGroupSessionTagSuggestion = {
  id: string;
  tag: string;
  name: string;
  kind: 'subject' | 'topic';
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
  isOngoing?: boolean;
  ratingAvg: number;
  ratingCount: number;
  facilitator: { id: string; name: string; avatarVariant: string | null };
  enrollmentStatus: string | null;
  approvedCount: number;
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
  const copy = messages.app.guidedGroupSessions;
  const { timeFormat } = useSettings();
  const { user, canWrite, writeRestriction } = useCurrentUser();
  const router = useRouter();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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
  const [scheduleStep, setScheduleStep] = useState<1 | 2>(1);
  const [scheduleObjectiveError, setScheduleObjectiveError] = useState<string | null>(null);

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
  const [selectedBrowseTags, setSelectedBrowseTags] = useState<string[]>([]);
  const [browseFocused, setBrowseFocused] = useState(false);
  const browseInputRef = useRef<HTMLInputElement>(null);
  const browseBlurTimer = useRef<NodeJS.Timeout | null>(null);
  const autoEnrollAttemptedRef = useRef(false);

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

  const tagIndex = useMemo(() => {
    const isAz = locale === 'az';
    const options: Array<{ id: string; name: string; tag: string; aliases?: readonly string[] }> = [];

    subjects.forEach((subject) => {
      options.push({
        id: `subject:${subject.slug}`,
        name: isAz ? subject.nameAz : subject.nameEn,
        tag: isAz ? (subject.slugAz ?? subject.slug) : subject.slug,
        aliases: Array.from(new Set([subject.slug, subject.slugAz].filter((v): v is string => Boolean(v)))),
      });
    });

    subjects.forEach((subject) => {
      (subject.topics ?? []).forEach((topic) => {
        options.push({
          id: `topic:${topic.slug}`,
          name: isAz ? topic.nameAz : topic.nameEn,
          tag: isAz ? (topic.slugAz ?? topic.slug) : topic.slug,
          aliases: Array.from(new Set([topic.slug, topic.slugAz].filter((v): v is string => Boolean(v)))),
        });
      });
    });

    return buildTagIndex(options);
  }, [locale, subjects]);

  const tagMap = useMemo(() => createTagMap(tagIndex), [tagIndex]);

  const tagLookup = useMemo(() => new Map(tagIndex.map((entry) => [entry.id, entry])), [tagIndex]);

  const tagMatch = useMemo(() => {
    const matches = Array.from(browseQuery.matchAll(TAG_MATCH_REGEX));
    return matches.length ? matches[matches.length - 1] : null;
  }, [browseQuery]);
  const tagQuery = tagMatch?.[1] ? normalizeTagToken(tagMatch[1]) : '';

  const tagSuggestions: GuidedGroupSessionTagSuggestion[] = useMemo(() => {
    if (!tagMatch) return [];
    return tagIndex
      .filter((entry) => {
        if (!tagQuery) return true;
        return (
          entry.tokens.some((token) => token.includes(tagQuery)) ||
          normalizeTagToken(entry.name).includes(tagQuery)
        );
      })
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        tag: entry.tag,
        name: entry.name,
        kind: entry.id.startsWith('topic:') ? 'topic' : 'subject',
      }));
  }, [tagIndex, tagMatch, tagQuery]);

  const showTagSuggestions = browseFocused && Boolean(tagMatch) && tagSuggestions.length > 0;

  const applyTagSuggestion = (suggestion: GuidedGroupSessionTagSuggestion) => {
    if (tagMatch?.index == null) return;
    const token = tagMatch[0] ?? '';
    setSelectedBrowseTags((prev) => {
      if (suggestion.id.startsWith('topic:')) {
        const withoutTopics = prev.filter((id) => !id.startsWith('topic:'));
        return withoutTopics.includes(suggestion.id) ? withoutTopics : [...withoutTopics, suggestion.id];
      }
      return prev.includes(suggestion.id) ? prev : [...prev, suggestion.id];
    });
    const before = browseQuery.slice(0, tagMatch.index);
    const after = browseQuery.slice(tagMatch.index + token.length);
    const next = `${before}${after}`.replace(/\s{2,}/g, ' ').trimStart();
    setBrowseQuery(next);
    if (browseBlurTimer.current) clearTimeout(browseBlurTimer.current);
    requestAnimationFrame(() => browseInputRef.current?.focus());
  };

  const removeBrowseTag = (tagId: string) => {
    setSelectedBrowseTags((prev) => prev.filter((id) => id !== tagId));
    if (browseBlurTimer.current) clearTimeout(browseBlurTimer.current);
    requestAnimationFrame(() => browseInputRef.current?.focus());
  };

  const parsedBrowseQuery = useMemo(() => parseTaggedQuery(browseQuery, tagMap), [browseQuery, tagMap]);

  const effectiveBrowseTagIds = useMemo(() => {
    return Array.from(new Set([...selectedBrowseTags, ...parsedBrowseQuery.tagIds]));
  }, [parsedBrowseQuery.tagIds, selectedBrowseTags]);

  const subjectIds = useMemo(
    () =>
      effectiveBrowseTagIds
        .filter((id) => id.startsWith('subject:'))
        .map((id) => id.slice('subject:'.length))
        .filter(Boolean),
    [effectiveBrowseTagIds],
  );

  const topicId = useMemo(() => {
    const topicIds = effectiveBrowseTagIds
      .filter((id) => id.startsWith('topic:'))
      .map((id) => id.slice('topic:'.length))
      .filter(Boolean);
    return topicIds.length ? topicIds[topicIds.length - 1] : '';
  }, [effectiveBrowseTagIds]);

  const scheduleSubjects = useMemo(() => {
    return subjects.filter((s) => verifiedSubjectSet.has(s.slug));
  }, [subjects, verifiedSubjectSet]);

  const scheduleTopics = useMemo(() => {
    const subject = subjects.find((s) => s.slug === sessionSubjectId);
    return subject?.topics ?? [];
  }, [subjects, sessionSubjectId]);

  useEffect(() => {
    if (!scheduleDialogOpen) return;
    if (sessionSubjectId && subjects.some((s) => s.slug === sessionSubjectId)) return;
    const firstVerified = verifiedSubjectIds.find((id) => subjects.some((s) => s.slug === id)) ?? '';
    setSessionSubjectId(firstVerified);
    setSessionTopicId('');
  }, [scheduleDialogOpen, sessionSubjectId, subjects, verifiedSubjectIds]);

  useEffect(() => {
    if (!sessionSubjectId) {
      if (sessionTopicId) setSessionTopicId('');
      return;
    }
    const subject = subjects.find((s) => s.slug === sessionSubjectId);
    const topicSlugs = new Set((subject?.topics ?? []).map((t) => t.slug));
    if (!sessionTopicId || !topicSlugs.has(sessionTopicId)) setSessionTopicId('');
  }, [sessionSubjectId, sessionTopicId, subjects]);

  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      const startMs = new Date(s.scheduledAt).getTime();
      const endMs = startMs + (s.durationMinutes ?? 0) * 60_000;
      if (!Number.isFinite(startMs)) return false;
      return nowMs < endMs;
    });
  }, [sessions, nowMs]);

  const filteredSessions = useMemo(() => {
    const query = (showTagSuggestions ? '' : parsedBrowseQuery.textQuery).trim().toLowerCase();
    const q = query.length > 0 ? query : null;
    return visibleSessions.filter((s) => {
      if (subjectIds.length > 0 && !subjectIds.includes(s.subjectId)) return false;
      if (topicId && s.topicId !== topicId) return false;
      if (!q) return true;
      const haystack = `${s.title} ${s.facilitator?.name ?? ''} ${s.subjectId} ${s.topicId}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [parsedBrowseQuery.textQuery, showTagSuggestions, subjectIds, topicId, visibleSessions]);

  const liveNowSessions = useMemo(() => {
    return [...filteredSessions]
      .filter((s) => {
        if (s.status === 'LIVE') return true;
        const startMs = new Date(s.scheduledAt).getTime();
        const endMs = startMs + (s.durationMinutes ?? 0) * 60_000;
        return Boolean(s.isOngoing) || (nowMs >= startMs && nowMs < endMs);
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [filteredSessions, nowMs]);

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

  const myRegisteredSessions = useMemo(() => {
    return [...visibleSessions]
      .filter((s) => s.enrollmentStatus === 'APPROVED')
      .sort((a, b) => {
        const aStartMs = new Date(a.scheduledAt).getTime();
        const bStartMs = new Date(b.scheduledAt).getTime();
        const aEndMs = aStartMs + (a.durationMinutes ?? 0) * 60_000;
        const bEndMs = bStartMs + (b.durationMinutes ?? 0) * 60_000;
        const aOngoing = Boolean(a.isOngoing) || (nowMs >= aStartMs && nowMs < aEndMs);
        const bOngoing = Boolean(b.isOngoing) || (nowMs >= bStartMs && nowMs < bEndMs);
        if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;
        return aStartMs - bStartMs;
      })
      .slice(0, 6);
  }, [nowMs, visibleSessions]);

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
          slugAz?: string;
          nameEn?: string;
          nameAz?: string;
          topics?: Array<{ slug?: string; slugAz?: string; nameEn?: string; nameAz?: string }>;
        }>;
      };
      const appData = (await appRes.json().catch(() => ({}))) as ApplicationPayload;
      const sessionsData = (await sessionsRes.json().catch(() => ([]))) as unknown;

      const curriculumSubjects = Array.isArray(curriculumData?.subjects)
        ? curriculumData.subjects
            .filter((s) => s && typeof s.slug === 'string')
            .map((s) => ({
              slug: String(s.slug),
              slugAz: typeof s.slugAz === 'string' ? String(s.slugAz) : String(s.slug),
              nameEn: String(s.nameEn ?? s.slug),
              nameAz: String(s.nameAz ?? s.slug),
              topics: Array.isArray(s.topics)
                ? s.topics
                    .filter((t) => t && typeof t.slug === 'string')
                    .map((t) => ({
                      slug: String(t.slug),
                      slugAz: typeof t.slugAz === 'string' ? String(t.slugAz) : String(t.slug),
                      nameEn: String(t.nameEn ?? t.slug),
                      nameAz: String(t.nameAz ?? t.slug),
                    }))
                : [],
            }))
        : [];

      const nextApplication =
        appData && typeof appData === 'object' && appData.application ? appData.application : null;

      const nextSessions = Array.isArray(sessionsData) ? (sessionsData as GuidedGroupSessionRow[]) : [];

      setSubjects(curriculumSubjects);
      setSessions(nextSessions);
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

      // Auto-register the learner for the next available session (first-come, first-served).
      // Keep this idempotent per page view to avoid accidental loops.
      if (!autoEnrollAttemptedRef.current) {
        autoEnrollAttemptedRef.current = true;

        const isAlreadyRegistered = nextSessions.some((s) => {
          const status = s.enrollmentStatus;
          if (status !== 'APPROVED') return false;
          const startMs = new Date(s.scheduledAt).getTime();
          const endMs = startMs + (s.durationMinutes ?? 0) * 60_000;
          return Number.isFinite(startMs) && nowMs < endMs;
        });

        if (!isAlreadyRegistered && canWrite && user?.id) {
          const candidate = [...nextSessions]
            .filter((s) => {
              const startMs = new Date(s.scheduledAt).getTime();
              if (!Number.isFinite(startMs)) return false;
              const seatsLeft = Math.max(0, (s.learnerCapacity ?? 0) - (s.approvedCount ?? 0));
              const isOwnSession = s.facilitator?.id === user.id;
              const status = s.enrollmentStatus;
              return (
                s.status === 'SCHEDULED' &&
                !isOwnSession &&
                startMs > nowMs &&
                seatsLeft > 0 &&
                (!status || status === 'CANCELLED' || status === 'REJECTED')
              );
            })
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

          if (candidate?.id) {
            void requestToJoin(candidate.id, { silentToast: true });
          }
        }
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
    setScheduleStep(1);
    setScheduleObjectiveError(null);
    setScheduleDialogOpen(true);
  };

  const closeScheduleDialog = () => {
    setScheduleDialogOpen(false);
    setScheduleStep(1);
    setScheduleObjectiveError(null);
  };

  const goToScheduleObjectivesStep = () => {
    if (creatingSession) return;
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
      toast.error(locale === 'az' ? 'Mövzu tapılmadı.' : 'No topic available for this subject.');
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
    setScheduleObjectiveError(null);
    setScheduleStep(2);
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

  const createSession = async (): Promise<boolean> => {
    if (creatingSession) return false;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return false;
    }

    const title = sessionTitle.trim();
    if (title.length < 3) {
      toast.error(locale === 'az' ? 'Sessiya adı tələb olunur.' : 'Session name is required.');
      return false;
    }

    if (!sessionSubjectId) {
      toast.error(locale === 'az' ? 'Fənn seçin.' : 'Select a subject.');
      return false;
    }

    if (!verifiedSubjectSet.has(sessionSubjectId)) {
      toast.error(
        locale === 'az'
          ? 'Bu fənn üçün bələdçi şagird kimi təsdiqlənməmisiniz.'
          : 'You are not verified to facilitate this subject.',
      );
      setApplicationDialogOpen(true);
      return false;
    }

    if (!sessionTopicId) {
      toast.error(locale === 'az' ? 'Mövzu seçin.' : 'Select a topic.');
      return false;
    }

    if (!sessionScheduledAt) {
      toast.error(locale === 'az' ? 'Tarix və vaxt seçin.' : 'Select a date and time.');
      return false;
    }

    const scheduled = new Date(sessionScheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error(locale === 'az' ? 'Yanlış tarix.' : 'Invalid date.');
      return false;
    }

    const objectiveLines = objectiveSlots
      .map((value) => value.trim())
      .filter(Boolean);
    if (objectiveLines.length < 2) {
      setScheduleObjectiveError(locale === 'az' ? 'Ən azı 2 məqsəd əlavə edin.' : 'Add at least 2 objectives.');
      return false;
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
        return false;
      }
      toast.success(locale === 'az' ? 'Sessiya planlandı.' : 'Session scheduled.');
      setSessionTitle('');
      setSessionScheduledAt('');
      setObjectiveSlots(['', '', '', '', '']);
      setScheduleObjectiveError(null);
      await load();
      return true;
    } catch {
      toast.error(locale === 'az' ? 'Sessiyanı planlamaq mümkün olmadı.' : 'Failed to schedule session.');
      return false;
    } finally {
      setCreatingSession(false);
    }
  };

  const requestToJoin = async (sessionId: string, opts?: { silentToast?: boolean }) => {
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
        toast.error(
          typeof data?.error === 'string' && data.error
            ? data.error
            : locale === 'az'
              ? 'Qeydiyyatdan keçmək mümkün olmadı.'
              : 'Failed to register.',
        );
        return;
      }
      const nextStatus = typeof data?.status === 'string' ? data.status : 'APPROVED';
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, enrollmentStatus: nextStatus } : s)));
      if (!opts?.silentToast) {
        toast.success(locale === 'az' ? 'Qeydiyyat tamamlandı.' : 'Registered.');
      }
      await load();
    } catch {
      toast.error(locale === 'az' ? 'Qeydiyyatdan keçmək mümkün olmadı.' : 'Failed to register.');
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
        toast.error(
          typeof data?.error === 'string' && data.error
            ? data.error
            : locale === 'az'
              ? 'Qeydiyyatı ləğv etmək mümkün olmadı.'
              : 'Failed to cancel registration.',
        );
        return;
      }
      toast.success(locale === 'az' ? 'Qeydiyyat ləğv edildi.' : 'Registration cancelled.');
      await load();
    } catch {
      toast.error(locale === 'az' ? 'Qeydiyyatı ləğv etmək mümkün olmadı.' : 'Failed to cancel registration.');
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
          const startMs = when.getTime();
          const subjectLabel = subjectNameById.get(session.subjectId) ?? session.subjectId;
          const topicLabel = topicNameByKey.get(`${session.subjectId}:${session.topicId}`) ?? session.topicId;
          const approvedCount = session.approvedCount ?? 0;
          const seatsLeft = Math.max(0, session.learnerCapacity - approvedCount);
          const isOwnSession = session.facilitator?.id === user.id;
          const isBusy = busySessionId === session.id;
          const status = session.enrollmentStatus;
          const endMs = startMs + (session.durationMinutes ?? 0) * 60_000;
          const isOngoing = Boolean(session.isOngoing) || (nowMs >= startMs && nowMs < endMs);
          const isApproved = status === 'APPROVED';
          const canEnterRoom = isOngoing && (isOwnSession || isApproved);
          const canRegister =
            session.status === 'SCHEDULED' &&
            !isOwnSession &&
            startMs > nowMs &&
            seatsLeft > 0 &&
            (!status || status === 'CANCELLED' || status === 'REJECTED');
          const canCancelRegistration = (status === 'APPROVED' || status === 'PENDING') && startMs > nowMs;

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
                    {isOngoing ? (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-700 shadow-sm ring-1 ring-rose-500/15 dark:text-rose-300">
                        {locale === 'az' ? 'Canlı' : 'Ongoing'}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {guideStudentLabel}: {session.facilitator?.name ?? '—'}
                  </p>
                </div>

                <div className="shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isBusy || (!canRegister && !canEnterRoom)}
                    onClick={() => {
                      if (canEnterRoom) {
                        router.push(`/my-library/guided-group-sessions/${session.id}`);
                        return;
                      }
                      if (canRegister) {
                        void requestToJoin(session.id);
                      }
                    }}
                  >
                    {canEnterRoom
                      ? isOwnSession
                        ? locale === 'az'
                          ? 'Otağı aç'
                          : 'Open room'
                        : locale === 'az'
                          ? 'Qoşul'
                          : 'Join'
                      : isOwnSession
                        ? locale === 'az'
                          ? 'Sizin sessiya'
                          : 'Your session'
                        : status
                          ? status === 'APPROVED'
                            ? locale === 'az'
                              ? 'Qeydiyyat var'
                              : 'Registered'
                            : status === 'REJECTED'
                              ? locale === 'az'
                                ? 'Rədd'
                                : 'Rejected'
                              : status === 'CANCELLED'
                                ? locale === 'az'
                                  ? 'Yenidən qeydiyyat'
                                  : 'Register again'
                                : status === 'PENDING'
                                  ? locale === 'az'
                                    ? 'Gözləyir'
                                    : 'Pending'
                                  : status
                          : seatsLeft === 0
                            ? locale === 'az'
                              ? 'Doludur'
                              : 'Full'
                            : startMs <= nowMs
                              ? locale === 'az'
                                ? 'Başlayıb'
                                : 'Started'
                              : locale === 'az'
                                ? 'Qeydiyyat'
                                : 'Register'}
                  </Button>
                  {canCancelRegistration ? (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={isBusy}
                        onClick={() => void cancelEnrollment(session.id)}
                      >
                        {locale === 'az' ? 'Qeydiyyatı ləğv et' : 'Cancel registration'}
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
            <div className="relative">
              <Input
                ref={browseInputRef}
                value={browseQuery}
                onChange={(e) => setBrowseQuery(e.target.value)}
                onFocus={() => {
                  if (browseBlurTimer.current) clearTimeout(browseBlurTimer.current);
                  setBrowseFocused(true);
                }}
                onBlur={() => {
                  browseBlurTimer.current = setTimeout(() => setBrowseFocused(false), 150);
                }}
                placeholder={
                  locale === 'az'
                    ? 'Sessiya axtar… və ya #fənn / #mövzu (məs. #riyaziyyat #cəbr)'
                    : 'Search sessions… or use #subject / #topic (e.g., #mathematics #algebra)'
                }
                disabled={loading}
              />
              {showTagSuggestions ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-card p-2 shadow-sm">
                  <div className="grid gap-1">
                    {tagSuggestions.map((s) => (
                      <button
                        key={`${s.kind}:${s.id}:${s.tag}`}
                        type="button"
                        onClick={() => applyTagSuggestion(s)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/40"
                        disabled={loading}
                      >
                        <span className="truncate">
                          #{s.tag} <span className="text-muted-foreground">· {s.name}</span>
                        </span>
                        <span className="ml-3 shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {s.kind === 'subject'
                            ? locale === 'az'
                              ? 'fənn'
                              : 'subject'
                            : locale === 'az'
                              ? 'mövzu'
                              : 'topic'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {selectedBrowseTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedBrowseTags.map((tagId) => {
                  const entry = tagLookup.get(tagId);
                  const label = entry ? `#${entry.tag}` : tagId;
                  return (
                    <button
                      key={`browse-tag-${tagId}`}
                      type="button"
                      onClick={() => removeBrowseTag(tagId)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-foreground hover:bg-muted/40"
                      disabled={loading}
                      title={entry?.name ?? undefined}
                    >
                      <span className="truncate max-w-[180px]">{label}</span>
                      <span className="text-muted-foreground">×</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
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

        {/* Staff messages about facilitator applications are shown in Notifications, not on this page. */}
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
                    'Your application is under review. You will get an update in Notifications.'}
                </span>
              ) : null}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{locale === 'az' ? 'Bağla' : 'Close'}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) {
            setScheduleStep(1);
            setScheduleObjectiveError(null);
          }
        }}
      >
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
            {scheduleStep === 1 ? (
              <>
                <div className="text-xs text-muted-foreground">
                  {locale === 'az' ? 'Addım 1 / 2' : 'Step 1 / 2'}
                </div>

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
                    <label className="text-xs font-medium text-muted-foreground">
                      {locale === 'az' ? 'Müddət' : 'Duration'}
                    </label>
                    <Select
                      value={String(sessionDuration)}
                      onChange={(e) => setSessionDuration(Number(e.target.value))}
                      disabled={loading || creatingSession}
                    >
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="45">45</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {locale === 'az' ? 'Fənn' : 'Subject'}
                    </label>
                    <Select
                      value={sessionSubjectId}
                      onChange={(e) => setSessionSubjectId(e.target.value)}
                      disabled={loading || creatingSession || scheduleSubjects.length === 0}
                    >
                      <SelectItem value="">{locale === 'az' ? 'Fənn seçin' : 'Select a subject'}</SelectItem>
                      {scheduleSubjects.map((s) => (
                        <SelectItem key={`schedule-subject-${s.slug}`} value={s.slug}>
                          {subjectNameById.get(s.slug) ?? (locale === 'az' ? s.nameAz : s.nameEn) ?? s.slug}
                        </SelectItem>
                      ))}
                    </Select>
                    {!isVerifiedGuideStudent ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {locale === 'az'
                          ? 'Sessiya planlamaq üçün ən azı bir fənn üzrə təsdiqlənməlisiniz.'
                          : 'To schedule, you must be verified for at least one subject.'}
                      </p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {locale === 'az' ? 'Mövzu' : 'Topic'}
                    </label>
                    <Select
                      value={sessionTopicId}
                      onChange={(e) => setSessionTopicId(e.target.value)}
                      disabled={loading || creatingSession || !sessionSubjectId || scheduleTopics.length === 0}
                    >
                      <SelectItem value="">{locale === 'az' ? 'Mövzu seçin' : 'Select a topic'}</SelectItem>
                      {scheduleTopics.map((t) => (
                        <SelectItem key={`schedule-topic-${t.slug}`} value={t.slug}>
                          {topicNameByKey.get(`${sessionSubjectId}:${t.slug}`) ??
                            (locale === 'az' ? t.nameAz : t.nameEn) ??
                            t.slug}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {locale === 'az' ? 'Şagird sayı' : 'Learners'}
                    </label>
                    <Select
                      value={String(sessionCapacity)}
                      onChange={(e) => setSessionCapacity(Number(e.target.value))}
                      disabled={loading || creatingSession}
                    >
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeScheduleDialog}
                    disabled={creatingSession}
                  >
                    {locale === 'az' ? 'Bağla' : 'Close'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={goToScheduleObjectivesStep}
                    disabled={loading || creatingSession}
                  >
                    {locale === 'az' ? 'Növbəti' : 'Next'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {locale === 'az' ? 'Addım 2 / 2' : 'Step 2 / 2'}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {locale === 'az' ? 'Məqsədlər' : 'Objectives'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'az'
                      ? `Sessiya üçün ən azı 2 məqsəd əlavə edin.`
                      : 'Add at least 2 objectives for the session.'}
                  </p>
                </div>

                <div className="space-y-3">
                  {objectiveSlots.map((slot, idx) => (
                    <Input
                      key={idx}
                      value={slot}
                      onChange={(e) => {
                        const next = [...objectiveSlots];
                        next[idx] = e.target.value;
                        setObjectiveSlots(next);
                        if (scheduleObjectiveError) setScheduleObjectiveError(null);
                      }}
                      placeholder={locale === 'az' ? `Məqsəd ${idx + 1}` : `Objective ${idx + 1}`}
                      className="h-9 text-sm"
                      autoFocus={idx === 0}
                      disabled={loading || creatingSession}
                    />
                  ))}
                  {scheduleObjectiveError ? (
                    <p className="text-xs text-destructive">{scheduleObjectiveError}</p>
                  ) : null}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScheduleObjectiveError(null);
                        setScheduleStep(1);
                      }}
                      disabled={creatingSession}
                    >
                      {locale === 'az' ? 'Geri' : 'Back'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        const ok = await createSession();
                        if (ok) closeScheduleDialog();
                      }}
                      disabled={loading || creatingSession}
                    >
                      {creatingSession ? (locale === 'az' ? 'Planlanır…' : 'Scheduling…') : scheduleLabel}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">{locale === 'az' ? 'Yüklənir…' : 'Loading…'}</p>
        ) : (
          <>
            {myRegisteredSessions.length > 0 ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">{locale === 'az' ? 'Mənim qeydiyyat sessiyalarım' : 'My registered sessions'}</h2>
                  <p className="text-[11px] text-muted-foreground">{myRegisteredSessions.length}</p>
                </div>
                {renderSessionList(myRegisteredSessions)}
              </section>
            ) : null}

            {filteredSessions.length === 0 ? (
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
          </>
        )}
      </div>
    </div>
  );
}
