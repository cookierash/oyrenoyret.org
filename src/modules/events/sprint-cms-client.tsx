'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER, MAX_SPRINT_SUBMISSION_IMAGES_TOTAL } from '@/src/config/uploads';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';

type LiveEventProblem = {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  prompt: string;
  options: Array<{ id: string; order: number; text: string; isCorrect?: boolean }>;
};

type UploadedImage = { key: string; proxyUrl: string };

export function SprintCmsClient(props: {
  liveEventId: string;
  initialTopic: string;
  startsAt: string;
  durationMinutes: number;
  initialDifficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null;
  initialPrompt: string | null;
  initialProblems: LiveEventProblem[] | null;
  initialProblemsLocked: boolean;
  isStaff: boolean;
  initialHasSubmitted: boolean;
  initialSubmittedAt: string | null;
}) {
  const { messages } = useI18n();
  const copy = messages.liveActivities.cms;
  const [now, setNow] = useState(() => Date.now());

  const [startsAtIso, setStartsAtIso] = useState(props.startsAt);
  const startsAtMs = useMemo(() => new Date(startsAtIso).getTime(), [startsAtIso]);
  const endsAtMs = useMemo(
    () => startsAtMs + props.durationMinutes * 60_000,
    [props.durationMinutes, startsAtMs],
  );

  const hasStarted = now >= startsAtMs;
  const isOver = now > endsAtMs;

  const [topic, setTopic] = useState(props.initialTopic);
  const [prompt, setPrompt] = useState(props.initialPrompt ?? '');
  const [difficulty, setDifficulty] = useState(props.initialDifficulty);
  const [startsAtInput, setStartsAtInput] = useState(() => {
    const date = new Date(props.startsAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  });

  const [savingField, setSavingField] = useState<
    null | 'topic' | 'prompt' | 'startsAt' | 'difficulty'
  >(null);

  const [problems, setProblems] = useState<LiveEventProblem[]>(props.initialProblems ?? []);
  const [problemsLocked, setProblemsLocked] = useState(props.initialProblemsLocked);
  const [savingProblems, setSavingProblems] = useState(false);

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(props.initialHasSubmitted);
  const [submittedAt, setSubmittedAt] = useState<string | null>(props.initialSubmittedAt);

  // Staff can manage submissions and payouts from the admin panel; the CMS focuses on contest setup + participation.

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);
    const pad = (n: number) => String(n).padStart(2, '0');

    const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${time}` : time;
  };

  const remainingToStartMs = Math.max(0, startsAtMs - now);
  const remainingToEndMs = Math.max(0, endsAtMs - now);
  const startsInLabel =
    !hasStarted && Number.isFinite(startsAtMs)
      ? (copy.countdownStartsIn ?? 'Starts in {{time}}').replace(
          '{{time}}',
          formatCountdown(remainingToStartMs),
        )
      : null;
  const endsInLabel =
    hasStarted && !isOver && Number.isFinite(endsAtMs)
      ? (copy.countdownEndsIn ?? 'Ends in {{time}}').replace(
          '{{time}}',
          formatCountdown(remainingToEndMs),
        )
      : null;

  const reloadEvent = async () => {
    try {
      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const nextTopic = typeof (data as any)?.topic === 'string' ? String((data as any).topic) : null;
      const nextPrompt = typeof (data as any)?.prompt === 'string' ? String((data as any).prompt) : null;
      const nextDate = typeof (data as any)?.date === 'string' ? String((data as any).date) : null;

      if (nextDate) setStartsAtIso(nextDate);
      if (nextTopic !== null) setTopic(nextTopic);
      if (nextPrompt !== null) setPrompt(nextPrompt);
    } catch {
      // Silent: polling only.
    }
  };

  useEffect(() => {
    if (props.isStaff) return;
    void reloadEvent();
    const id = window.setInterval(() => void reloadEvent(), 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isStaff, props.liveEventId]);

  useEffect(() => {
    if (props.isStaff) return;
    if (!hasStarted) return;
    void reloadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, props.isStaff, props.liveEventId]);

  const reloadProblems = async () => {
    setSavingProblems(true);
    try {
      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}/problems`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.loadProblemsFailed, extractErrorMessage(data)));
        return;
      }
      const locked = Boolean((data as any)?.locked);
      const list = Array.isArray((data as any)?.problems) ? ((data as any).problems as LiveEventProblem[]) : [];
      setProblemsLocked(locked);
      setProblems(list);
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toasts.loadProblemsFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSavingProblems(false);
    }
  };

  useEffect(() => {
    if (props.isStaff) return;
    if (!hasStarted) return;
    if (problems.length > 0) return;
    if (!problemsLocked) return;
    void reloadProblems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);

  const saveField = async (field: 'topic' | 'prompt' | 'startsAt' | 'difficulty') => {
    if (!props.isStaff) return;
    setSavingField(field);
    try {
      const payload: Record<string, unknown> = {
      };
      if (field === 'topic') {
        payload.topic = topic;
      } else if (field === 'prompt') {
        payload.prompt = prompt;
      } else if (field === 'startsAt') {
        const nextDate = new Date(startsAtInput);
        if (!Number.isFinite(nextDate.getTime())) {
          toast.error(copy.toasts.invalidStartTime ?? 'Invalid start time.');
          return;
        }
        payload.date = nextDate.toISOString();
      } else if (field === 'difficulty') {
        payload.difficulty = difficulty;
      }

      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.saveFailed, extractErrorMessage(data)));
        return;
      }
      if (field === 'startsAt' && typeof (data as any)?.date === 'string') {
        setStartsAtIso((data as any).date);
        const date = new Date((data as any).date);
        const pad = (n: number) => String(n).padStart(2, '0');
        setStartsAtInput(
          `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
            date.getHours(),
          )}:${pad(date.getMinutes())}`,
        );
      }
      if (field === 'difficulty') {
        const next = (data as any)?.difficulty;
        if (next === 'BASIC' || next === 'INTERMEDIATE' || next === 'ADVANCED' || next === null) {
          setDifficulty(next);
        }
      }
      toast.success(copy.toasts.saved);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.saveFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSavingField(null);
    }
  };

  const saveProblems = async () => {
    setSavingProblems(true);
    try {
      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}/problems`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problems: problems.map((p) => ({
            type: p.type,
            prompt: p.prompt,
            options:
              p.type === 'MULTIPLE_CHOICE'
                ? (() => {
                    const cleaned = p.options
                      .map((o) => ({ text: o.text, isCorrect: Boolean(o.isCorrect) }))
                      .filter((o) => o.text.trim().length > 0);
                    const chosen = cleaned.findIndex((o) => o.isCorrect);
                    const correctIndex = chosen >= 0 ? chosen : cleaned.length ? 0 : -1;
                    return cleaned.map((o, idx) => ({ ...o, isCorrect: idx === correctIndex }));
                  })()
                : [],
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.saveProblemsFailed, extractErrorMessage(data)));
        return;
      }
      const list = Array.isArray((data as any)?.problems) ? ((data as any).problems as LiveEventProblem[]) : [];
      setProblems(list);
      toast.success(copy.toasts.problemsSaved);
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toasts.saveProblemsFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSavingProblems(false);
    }
  };

  const submitAnswer = async () => {
    const trimmed = answer.trim();
    if (trimmed.length < 10) {
      toast.error(copy.toasts.answerTooShort);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/live-events/${encodeURIComponent(props.liveEventId)}/submissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: trimmed }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.submitFailed, extractErrorMessage(data)));
        return;
      }
      setHasSubmitted(true);
      setSubmittedAt(typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString());
      toast.success(copy.toasts.submitted);
      setAnswer('');
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.submitFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const [structuredAnswers, setStructuredAnswers] = useState<
    Record<
      string,
      { textAnswer: string; selectedOptionId: string; images: UploadedImage[] }
    >
  >({});

  const totalImagesCount = useMemo(
    () =>
      Object.values(structuredAnswers).reduce((acc, row) => acc + (row.images?.length ?? 0), 0),
    [structuredAnswers],
  );

  const uploadImage = async (file: File): Promise<UploadedImage> => {
    if (!file.type || !file.type.startsWith('image/')) {
      throw new Error(copy.toasts.unsupportedImageType);
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error(copy.toasts.imageTooLarge);
    }
    const signRes = await fetch('/api/uploads/sprint-submissions/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: file.size, type: file.type, liveEventId: props.liveEventId }),
    });
    const signData = await signRes.json().catch(() => ({}));
    if (!signRes.ok) {
      throw new Error(extractErrorMessage(signData) || copy.toasts.imageUploadFailed);
    }
    if (typeof signData?.uploadUrl !== 'string' || typeof signData?.key !== 'string') {
      throw new Error(copy.toasts.imageUploadFailed);
    }
    const uploadRes = await fetch(signData.uploadUrl as string, {
      method: 'PUT',
      headers: (signData.headers as Record<string, string>) ?? { 'Content-Type': file.type },
      body: file,
    });
    if (!uploadRes.ok) throw new Error(copy.toasts.imageUploadFailed);
    const proxyUrl =
      typeof signData?.proxyUrl === 'string'
        ? (signData.proxyUrl as string)
        : `/api/uploads/sprint-submissions/file?key=${encodeURIComponent(signData.key as string)}`;
    return { key: signData.key as string, proxyUrl };
  };

  const onAttachImages = async (problemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (totalImagesCount >= MAX_SPRINT_SUBMISSION_IMAGES_TOTAL) {
      toast.error(copy.toasts.tooManyImagesTotal);
      return;
    }

    const existing = structuredAnswers[problemId]?.images ?? [];
    if (existing.length >= MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER) {
      toast.error(copy.toasts.tooManyImagesForProblem);
      return;
    }

    const remainingForProblem = Math.max(0, MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER - existing.length);
    const remainingTotal = Math.max(0, MAX_SPRINT_SUBMISSION_IMAGES_TOTAL - totalImagesCount);
    const allowed = Math.min(remainingForProblem, remainingTotal, files.length);
    const queue = Array.from(files).slice(0, allowed);
    if (queue.length === 0) return;

    setSubmitting(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of queue) {
        uploaded.push(await uploadImage(file));
      }
      setStructuredAnswers((prev) => {
        const current = prev[problemId] ?? { textAnswer: '', selectedOptionId: '', images: [] };
        return {
          ...prev,
          [problemId]: { ...current, images: [...current.images, ...uploaded] },
        };
      });
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toasts.imageUploadFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const removeAttachedImage = (problemId: string, key: string) => {
    setStructuredAnswers((prev) => {
      const current = prev[problemId];
      if (!current) return prev;
      return {
        ...prev,
        [problemId]: { ...current, images: current.images.filter((img) => img.key !== key) },
      };
    });
  };

  const submitStructuredAnswers = async () => {
    if (problems.length === 0) {
      await submitAnswer();
      return;
    }

    const missing = problems.find((p) => {
      const row = structuredAnswers[p.id];
      if (!row) return true;
      if (p.type === 'MULTIPLE_CHOICE') return !row.selectedOptionId;
      return !row.textAnswer.trim();
    });
    if (missing) {
      toast.error(copy.toasts.answerMissing);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        answers: problems.map((p) => {
          const row = structuredAnswers[p.id] ?? { textAnswer: '', selectedOptionId: '', images: [] };
          return {
            problemId: p.id,
            type: p.type,
            textAnswer: p.type === 'SHORT_ANSWER' ? row.textAnswer.trim() : null,
            selectedOptionId: p.type === 'MULTIPLE_CHOICE' ? row.selectedOptionId : null,
            imageKeys: p.type === 'SHORT_ANSWER' ? row.images.map((img) => img.key) : [],
          };
        }),
      };
      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.submitFailed, extractErrorMessage(data)));
        return;
      }
      setHasSubmitted(true);
      setSubmittedAt(typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString());
      toast.success(copy.toasts.submitted);
      setAnswer('');
      setStructuredAnswers({});
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.submitFailed, error instanceof Error ? error.message : null),
      );
      } finally {
        setSubmitting(false);
      }
    };

  const showPrompt = props.isStaff || hasStarted;
  const displayPrompt = showPrompt && prompt.trim().length > 0 ? prompt : null;
  const showProblems = props.isStaff || hasStarted;
  const displayProblems = showProblems && problems.length > 0 ? problems : null;

  const participantProgress = useMemo(() => {
    if (!displayProblems) return null;
    const answered = displayProblems.reduce((acc, p) => {
      const row = structuredAnswers[p.id];
      if (!row) return acc;
      if (p.type === 'MULTIPLE_CHOICE') return acc + (row.selectedOptionId ? 1 : 0);
      return acc + (row.textAnswer.trim() ? 1 : 0);
    }, 0);
    return { answered, total: displayProblems.length };
  }, [displayProblems, structuredAnswers]);

  const canSubmitStructured = participantProgress ? participantProgress.answered === participantProgress.total : true;

  return (
    <div className="space-y-5">
      {!props.isStaff ? (
        <>
          <section className="card-frame border border-primary/15 bg-gradient-to-r from-primary/10 to-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.countdownTitle}
                </p>
                {!hasStarted ? (
                  <p className="mt-1 text-sm text-muted-foreground">{startsInLabel ?? copy.notStarted}</p>
                ) : isOver ? (
                  <p className="mt-1 text-sm text-muted-foreground">{copy.ended}</p>
                ) : (
                  <p className="mt-1 text-sm text-emerald-700">{endsInLabel ?? copy.inProgress}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  {copy.startsAtLabel}:{' '}
                  {Number.isFinite(startsAtMs) ? new Date(startsAtMs).toLocaleString() : '—'}
                </p>
                <p>
                  {copy.endsAtLabel}:{' '}
                  {Number.isFinite(endsAtMs) ? new Date(endsAtMs).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-4">
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {!hasStarted ? formatCountdown(remainingToStartMs) : isOver ? '00:00:00' : formatCountdown(remainingToEndMs)}
              </p>
              {!hasStarted ? (
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground">
                  {copy.notStarted}
                </span>
              ) : isOver ? (
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground">
                  {copy.ended}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {copy.inProgress}
                </span>
              )}
            </div>
          </section>

          <section className="card-frame bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-foreground">{copy.contestOverviewTitle}</h2>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {copy.contestTitleEditorLabel}
                </p>
                <div className="mt-1 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{topic}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {copy.promptTitle}
                </p>
                <div className="mt-1 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                  {displayPrompt ? (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {displayPrompt}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {showPrompt ? copy.noPrompt : copy.promptLocked}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {!props.isStaff ? (
        <section className="card-frame bg-card p-5">
          <h2 className="text-sm font-medium text-foreground">{copy.submitTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.submitHint}</p>

          {hasSubmitted ? (
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-sm text-foreground">{copy.submittedBanner}</p>
              {submittedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.submittedAtLabel.replace('{{date}}', new Date(submittedAt).toLocaleString())}
                </p>
              ) : null}
            </div>
          ) : !hasStarted ? (
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">{copy.waitForStart}</p>
            </div>
          ) : isOver ? (
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">{copy.windowClosed}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {displayProblems ? (
                <div className="space-y-3">
                  {displayProblems.map((problem) => {
                    const row = structuredAnswers[problem.id] ?? { textAnswer: '', selectedOptionId: '', images: [] };
                    return (
                      <div key={problem.id} className="rounded-md border border-border/70 bg-muted/10 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                            {copy.problemLabel.replace('{{n}}', String(problem.order))}
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {problem.type === 'MULTIPLE_CHOICE' ? copy.problemTypeMultiple : copy.problemTypeShort}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                          {problem.prompt}
                        </p>

                        {problem.type === 'MULTIPLE_CHOICE' ? (
                          <div className="mt-3 space-y-2">
                            {problem.options.map((opt) => (
                              <label
                                key={opt.id}
                                className={[
                                  'flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer',
                                  row.selectedOptionId === opt.id
                                    ? 'border-primary/50 bg-primary/5'
                                    : 'border-border/60 bg-background/40 hover:bg-muted/30',
                                ].join(' ')}
                              >
                                <input
                                  type="radio"
                                  name={`mcq-${problem.id}`}
                                  value={opt.id}
                                  checked={row.selectedOptionId === opt.id}
                                  onChange={() =>
                                    setStructuredAnswers((prev) => ({
                                      ...prev,
                                      [problem.id]: {
                                        ...(prev[problem.id] ?? { textAnswer: '', selectedOptionId: '', images: [] }),
                                        selectedOptionId: opt.id,
                                      },
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                                <span className="whitespace-pre-wrap">{opt.text}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <textarea
                              className="min-h-[120px] max-h-[320px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                              value={row.textAnswer}
                              onChange={(e) =>
                                setStructuredAnswers((prev) => ({
                                  ...prev,
                                  [problem.id]: {
                                    ...(prev[problem.id] ?? { textAnswer: '', selectedOptionId: '', images: [] }),
                                    textAnswer: e.target.value,
                                  },
                                }))
                              }
                              placeholder={copy.shortAnswerPlaceholder}
                            />
                          </div>
                        )}

                        {problem.type === 'SHORT_ANSWER' ? (
                          <>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs text-muted-foreground">
                                  {copy.attachImagesLabel}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    className="sr-only"
                                    onChange={(e) => {
                                      const files = e.currentTarget.files;
                                      e.currentTarget.value = '';
                                      void onAttachImages(problem.id, files);
                                    }}
                                  />
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={submitting || totalImagesCount >= MAX_SPRINT_SUBMISSION_IMAGES_TOTAL}
                                  onClick={(e) => {
                                    const input = (e.currentTarget.parentElement?.querySelector(
                                      'input[type="file"]',
                                    ) ?? null) as HTMLInputElement | null;
                                    input?.click();
                                  }}
                                >
                                  {copy.addImage}
                                </Button>
                                <span className="text-[11px] text-muted-foreground">
                                  {copy.imagesCount
                                    .replace('{{n}}', String(row.images.length))
                                    .replace('{{max}}', String(MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER))}
                                </span>
                              </div>
                            </div>

                            {row.images.length > 0 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {row.images.map((img) => (
                                  <div
                                    key={img.key}
                                    className="relative overflow-hidden rounded-md border border-border/70 bg-background"
                                  >
                                    <img src={img.proxyUrl} alt="" className="h-28 w-full object-cover" />
                                    <button
                                      type="button"
                                      className="absolute right-1 top-1 rounded bg-background/80 px-2 py-1 text-[11px] text-foreground"
                                      onClick={() => removeAttachedImage(problem.id, img.key)}
                                    >
                                      {copy.removeImage}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    className="min-h-[160px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={copy.answerPlaceholder}
                  />
                </div>
              )}

              {displayProblems ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {copy.answeredCountLabel
                      .replace('{{n}}', String(participantProgress?.answered ?? 0))
                      .replace('{{max}}', String(participantProgress?.total ?? 0))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {copy.imagesTotalCount
                      .replace('{{n}}', String(totalImagesCount))
                      .replace('{{max}}', String(MAX_SPRINT_SUBMISSION_IMAGES_TOTAL))}
                  </p>
                </div>
              ) : null}

              <Button
                onClick={displayProblems ? submitStructuredAnswers : submitAnswer}
                disabled={submitting || (displayProblems ? !canSubmitStructured : false)}
              >
                {submitting ? copy.submitting : copy.submitOnce}
              </Button>
              {displayProblems ? (
                <p className="text-[11px] text-muted-foreground">{copy.submitHint}</p>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="card-frame bg-card p-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-foreground">{copy.adminTitle}</h2>
            </div>

            <div className="grid gap-2">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                {copy.contestTitleEditorLabel}
              </label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={copy.contestTitlePlaceholder}
                />
                <Button
                  onClick={() => saveField('topic')}
                  disabled={savingField !== null}
                  className="w-full md:w-auto"
                >
                  {savingField === 'topic' ? copy.saving : copy.save}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                {copy.promptTitle}
              </label>
              <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                <textarea
                  className="min-h-[180px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={copy.promptEditorPlaceholder}
                />
                <Button
                  onClick={() => saveField('prompt')}
                  disabled={savingField !== null}
                  className="w-full md:w-auto"
                >
                  {savingField === 'prompt' ? copy.saving : copy.save}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {copy.startsAtLabel}
                </label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Input
                    type="datetime-local"
                    value={startsAtInput}
                    onChange={(e) => setStartsAtInput(e.target.value)}
                  />
                  <Button
                    onClick={() => saveField('startsAt')}
                    disabled={savingField !== null}
                    className="w-full md:w-auto"
                  >
                    {savingField === 'startsAt' ? copy.saving : copy.save}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {copy.difficultyLabel}
                </label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={difficulty ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === 'BASIC' || raw === 'INTERMEDIATE' || raw === 'ADVANCED') {
                        setDifficulty(raw);
                      } else {
                        setDifficulty(null);
                      }
                    }}
                  >
                    <option value="">{copy.difficultyNone}</option>
                    <option value="BASIC">{copy.difficultyBasic}</option>
                    <option value="INTERMEDIATE">{copy.difficultyIntermediate}</option>
                    <option value="ADVANCED">{copy.difficultyAdvanced}</option>
                  </select>
                  <Button
                    onClick={() => saveField('difficulty')}
                    disabled={savingField !== null}
                    className="w-full md:w-auto"
                  >
                    {savingField === 'difficulty' ? copy.saving : copy.save}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="card-frame bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">{copy.problemsTitle}</h3>
                <p className="text-xs text-muted-foreground">{copy.problemsHint}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={reloadProblems} disabled={savingProblems}>
                  {savingProblems ? copy.loading : copy.refreshProblems}
                </Button>
                <Button size="sm" onClick={saveProblems} disabled={savingProblems}>
                  {savingProblems ? copy.saving : copy.saveProblems}
                </Button>
              </div>
            </div>

            {problems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{copy.noProblems}</p>
            ) : null}

            <div className="space-y-3">
              {problems.map((problem, index) => (
                <div key={problem.id} className="rounded-md border border-border/70 bg-muted/10 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {copy.problemLabel.replace('{{n}}', String(index + 1))}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setProblems((prev) =>
                            prev
                              .filter((p) => p.id !== problem.id)
                              .map((p, idx2) => ({ ...p, order: idx2 + 1 })),
                          )
                        }
                      >
                        {copy.removeProblem}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                        {copy.problemTypeLabel}
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={problem.type}
                        onChange={(e) => {
                          const nextType = e.target.value as LiveEventProblem['type'];
                          setProblems((prev) =>
                            prev.map((p) =>
                              p.id === problem.id
                                ? {
                                    ...p,
                                    type: nextType,
                                    options:
                                      nextType === 'MULTIPLE_CHOICE'
                                        ? p.options.length > 0
                                          ? p.options
                                          : [
                                              {
                                                id:
                                                  (globalThis.crypto as any)?.randomUUID?.() ??
                                                  `new-opt-${Math.random().toString(16).slice(2)}`,
                                                order: 1,
                                                text: '',
                                                isCorrect: true,
                                              },
                                              {
                                                id:
                                                  (globalThis.crypto as any)?.randomUUID?.() ??
                                                  `new-opt-${Math.random().toString(16).slice(2)}`,
                                                order: 2,
                                                text: '',
                                                isCorrect: false,
                                              },
                                            ]
                                        : [],
                                  }
                                : p,
                            ),
                          );
                        }}
                      >
                        <option value="SHORT_ANSWER">{copy.problemTypeShort}</option>
                        <option value="MULTIPLE_CHOICE">{copy.problemTypeMultiple}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {copy.problemPromptLabel}
                    </label>
                    <textarea
                      className="min-h-[120px] max-h-[320px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                      value={problem.prompt}
                      onChange={(e) =>
                        setProblems((prev) =>
                          prev.map((p) => (p.id === problem.id ? { ...p, prompt: e.target.value } : p)),
                        )
                      }
                      placeholder={copy.problemPromptPlaceholder}
                    />
                  </div>

                  {problem.type === 'MULTIPLE_CHOICE' ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{copy.optionsTitle}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setProblems((prev) =>
                              prev.map((p) =>
                                p.id === problem.id
                                  ? {
                                      ...p,
                                      options: [
                                        ...p.options,
                                        {
                                          id:
                                            (globalThis.crypto as any)?.randomUUID?.() ??
                                            `new-opt-${Math.random().toString(16).slice(2)}`,
                                          order: p.options.length + 1,
                                          text: '',
                                          isCorrect: false,
                                        },
                                      ],
                                    }
                                  : p,
                              ),
                            )
                          }
                        >
                          {copy.addOption}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {problem.options.map((opt, optIndex) => (
                          <div key={opt.id} className="flex flex-wrap items-center gap-2">
                            <Input
                              value={opt.text}
                              onChange={(e) =>
                                setProblems((prev) =>
                                  prev.map((p) =>
                                    p.id === problem.id
                                      ? {
                                          ...p,
                                          options: p.options.map((o) =>
                                            o.id === opt.id ? { ...o, text: e.target.value } : o,
                                          ),
                                        }
                                      : p,
                                  ),
                                )
                              }
                              placeholder={copy.optionPlaceholder.replace('{{n}}', String(optIndex + 1))}
                            />
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="radio"
                                name={`correct-${problem.id}`}
                                checked={Boolean(opt.isCorrect)}
                                onChange={() =>
                                  setProblems((prev) =>
                                    prev.map((p) =>
                                      p.id === problem.id
                                        ? {
                                            ...p,
                                            options: p.options.map((o) => ({
                                              ...o,
                                              isCorrect: o.id === opt.id,
                                            })),
                                          }
                                        : p,
                                    ),
                                  )
                                }
                              />
                              {copy.correctOptionLabel}
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setProblems((prev) =>
                                  prev.map((p) =>
                                    p.id === problem.id
                                      ? {
                                          ...p,
                                          options: (() => {
                                            const next = p.options.filter((o) => o.id !== opt.id);
                                            const anyCorrect = next.some((o) => o.isCorrect);
                                            const withCorrect = anyCorrect
                                              ? next
                                              : next.map((o, i) => ({ ...o, isCorrect: i === 0 }));
                                            return withCorrect.map((o, idx2) => ({ ...o, order: idx2 + 1 }));
                                          })(),
                                        }
                                      : p,
                                  ),
                                )
                              }
                            >
                              {copy.removeOption}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setProblems((prev) => [
                  ...prev,
                  {
                    id:
                      (globalThis.crypto as any)?.randomUUID?.() ??
                      `new-problem-${Math.random().toString(16).slice(2)}`,
                    order: prev.length + 1,
                    type: 'SHORT_ANSWER',
                    prompt: '',
                    options: [],
                  },
                ])
              }
            >
              {copy.addProblem}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
