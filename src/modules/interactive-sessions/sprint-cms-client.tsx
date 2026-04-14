'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER, MAX_SPRINT_SUBMISSION_IMAGES_TOTAL } from '@/src/config/uploads';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';

type SubmissionRow = {
  id: string;
  answer: string;
  createdAt: string;
  user: {
    id: string;
    publicId: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  answers?: Array<{
    id: string;
    problemId: string;
    type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
    textAnswer: string | null;
    selectedOptionId: string | null;
    selectedOption?: { id: string; text: string } | null;
    images?: Array<{ id: string; order: number; key: string }>;
  }>;
};

type LiveEventProblem = {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  prompt: string;
  options: Array<{ id: string; order: number; text: string; isCorrect?: boolean }>;
};

type UploadedImage = { key: string; proxyUrl: string };

function formatDisplayName(user: SubmissionRow['user']) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.email.split('@')[0] || 'User';
}

export function SprintCmsClient(props: {
  liveEventId: string;
  startsAt: string;
  durationMinutes: number;
  initialPrompt: string | null;
  initialProblems: LiveEventProblem[] | null;
  initialProblemsLocked: boolean;
  initialMaxParticipants: number | null;
  isStaff: boolean;
  initialHasSubmitted: boolean;
  initialSubmittedAt: string | null;
  initialSubmissions: SubmissionRow[];
}) {
  const { messages } = useI18n();
  const copy = messages.liveActivities.cms;
  const [now, setNow] = useState(() => Date.now());

  const startsAtMs = useMemo(() => new Date(props.startsAt).getTime(), [props.startsAt]);
  const endsAtMs = useMemo(
    () => startsAtMs + props.durationMinutes * 60_000,
    [props.durationMinutes, startsAtMs],
  );

  const hasStarted = now >= startsAtMs;
  const isOver = now > endsAtMs;

  const [prompt, setPrompt] = useState(props.initialPrompt ?? '');
  const [maxParticipants, setMaxParticipants] = useState<string>(
    props.initialMaxParticipants ? String(props.initialMaxParticipants) : '',
  );
  const [saving, setSaving] = useState(false);

  const [problems, setProblems] = useState<LiveEventProblem[]>(props.initialProblems ?? []);
  const [problemsLocked, setProblemsLocked] = useState(props.initialProblemsLocked);
  const [savingProblems, setSavingProblems] = useState(false);

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(props.initialHasSubmitted);
  const [submittedAt, setSubmittedAt] = useState<string | null>(props.initialSubmittedAt);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>(props.initialSubmissions);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [payoutForm, setPayoutForm] = useState({ first: '', second: '', third: '' });
  const [payingOut, setPayingOut] = useState(false);

  const problemNumberById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of problems) map[p.id] = p.order;
    return map;
  }, [problems]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const reloadSubmissions = async () => {
    if (!props.isStaff) return;
    setLoadingSubmissions(true);
    try {
      const res = await fetch(
        `/api/live-events/${encodeURIComponent(props.liveEventId)}/submissions`,
        { cache: 'no-store' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.loadSubmissionsFailed, extractErrorMessage(data)));
        return;
      }
      setSubmissions(Array.isArray(data) ? (data as SubmissionRow[]) : []);
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toasts.loadSubmissionsFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setLoadingSubmissions(false);
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

  const saveAdminChanges = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        prompt,
        maxParticipants: maxParticipants.trim() ? Number(maxParticipants) : null,
      };
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
      toast.success(copy.toasts.saved);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.saveFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSaving(false);
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
      if (props.isStaff) {
        await reloadSubmissions();
      }
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
            imageKeys: row.images.map((img) => img.key),
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
      if (props.isStaff) await reloadSubmissions();
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.submitFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const payWinners = async () => {
    setPayingOut(true);
    try {
      const res = await fetch(`/api/live-events/${encodeURIComponent(props.liveEventId)}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first: payoutForm.first.trim(),
          second: payoutForm.second.trim(),
          third: payoutForm.third.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.payoutFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(copy.toasts.payoutSuccess);
      setPayoutForm({ first: '', second: '', third: '' });
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.payoutFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setPayingOut(false);
    }
  };

  const showPrompt = props.isStaff || hasStarted;
  const displayPrompt = showPrompt && prompt.trim().length > 0 ? prompt : null;
  const showProblems = props.isStaff || hasStarted;
  const displayProblems = showProblems && problems.length > 0 ? problems : null;

  return (
    <div className="space-y-5">
      <section className="card-frame bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-foreground">{copy.promptTitle}</h2>
          {!hasStarted ? (
            <span className="text-xs text-muted-foreground">{copy.notStarted}</span>
          ) : isOver ? (
            <span className="text-xs text-muted-foreground">{copy.ended}</span>
          ) : (
            <span className="text-xs text-emerald-600">{copy.inProgress}</span>
          )}
        </div>
        <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
          {displayPrompt ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
              {displayPrompt}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {showPrompt ? copy.noPrompt : copy.promptLocked}
            </p>
          )}
        </div>
      </section>

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
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {copy.problemLabel.replace('{{n}}', String(problem.order))}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                          {problem.prompt}
                        </p>

                        {problem.type === 'MULTIPLE_CHOICE' ? (
                          <div className="mt-3 space-y-2">
                            {problem.options.map((opt) => (
                              <label key={opt.id} className="flex items-start gap-2 text-sm text-foreground/90">
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
                                  className="mt-1"
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
                              <div key={img.key} className="relative overflow-hidden rounded-md border border-border/70 bg-background">
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

              <Button onClick={displayProblems ? submitStructuredAnswers : submitAnswer} disabled={submitting}>
                {submitting ? copy.submitting : copy.submitOnce}
              </Button>
              {displayProblems ? (
                <p className="text-[11px] text-muted-foreground">
                  {copy.imagesTotalCount
                    .replace('{{n}}', String(totalImagesCount))
                    .replace('{{max}}', String(MAX_SPRINT_SUBMISSION_IMAGES_TOTAL))}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <section className="card-frame bg-card p-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-foreground">{copy.adminTitle}</h2>
            <Button variant="outline" size="sm" onClick={reloadSubmissions} disabled={loadingSubmissions}>
              {copy.refresh}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                {copy.maxParticipantsLabel}
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                step={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder={copy.maxParticipantsPlaceholder}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={saveAdminChanges} disabled={saving} className="w-full md:w-auto">
                {saving ? copy.saving : copy.save}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">
              {copy.promptEditorLabel}
            </label>
            <textarea
              className="min-h-[180px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.promptEditorPlaceholder}
            />
          </div>

          <div className="space-y-3">
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
                          setProblems((prev) => prev.filter((p) => p.id !== problem.id).map((p, idx2) => ({ ...p, order: idx2 + 1 })))
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
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {copy.submissionsTitle.replace('{{count}}', String(submissions.length))}
            </h3>
            {loadingSubmissions ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{copy.noSubmissions}</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((row) => (
                  <div key={row.id} className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {formatDisplayName(row.user)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.user.email}
                          {row.user.publicId ? ` • ${row.user.publicId}` : ''}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {Array.isArray(row.answers) && row.answers.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {row.answers.map((ans) => (
                          <div key={ans.id} className="rounded-md border border-border/70 bg-background px-3 py-3">
                            <p className="text-xs font-medium text-foreground">
                              {copy.problemLabel.replace(
                                '{{n}}',
                                String(problemNumberById[ans.problemId] ?? ans.problemId),
                              )}
                            </p>
                            {ans.type === 'MULTIPLE_CHOICE' ? (
                              <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                                {ans.selectedOption?.text ?? copy.noSelection}
                              </p>
                            ) : (
                              <pre className="mt-1 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                                {ans.textAnswer ?? ''}
                              </pre>
                            )}
                            {Array.isArray(ans.images) && ans.images.length > 0 ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {ans.images.map((img) => (
                                  <img
                                    key={img.id}
                                    src={`/api/uploads/sprint-submissions/file?key=${encodeURIComponent(img.key)}`}
                                    alt=""
                                    className="h-28 w-full rounded-md border border-border/70 object-cover"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="mt-3 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                        {row.answer}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-border/70 bg-background px-4 py-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">{copy.payoutTitle}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={payoutForm.first}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, first: e.target.value }))}
                placeholder={copy.winnerFirst}
              />
              <Input
                value={payoutForm.second}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, second: e.target.value }))}
                placeholder={copy.winnerSecond}
              />
              <Input
                value={payoutForm.third}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, third: e.target.value }))}
                placeholder={copy.winnerThird}
              />
            </div>
            <Button onClick={payWinners} disabled={payingOut}>
              {payingOut ? copy.paying : copy.payWinners}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
