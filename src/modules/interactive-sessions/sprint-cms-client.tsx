'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
};

function formatDisplayName(user: SubmissionRow['user']) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.email.split('@')[0] || 'User';
}

export function SprintCmsClient(props: {
  liveEventId: string;
  startsAt: string;
  durationMinutes: number;
  initialPrompt: string | null;
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

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(props.initialHasSubmitted);
  const [submittedAt, setSubmittedAt] = useState<string | null>(props.initialSubmittedAt);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>(props.initialSubmissions);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [payoutForm, setPayoutForm] = useState({ first: '', second: '', third: '' });
  const [payingOut, setPayingOut] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  return (
    <div className="space-y-6">
      <section className="card-frame bg-card p-6">
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
        <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-4 py-4">
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
        <section className="card-frame bg-card p-6">
          <h2 className="text-sm font-medium text-foreground">{copy.submitTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.submitHint}</p>

          {hasSubmitted ? (
            <div className="mt-4 rounded-md border border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm text-foreground">{copy.submittedBanner}</p>
              {submittedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.submittedAtLabel.replace('{{date}}', new Date(submittedAt).toLocaleString())}
                </p>
              ) : null}
            </div>
          ) : !hasStarted ? (
            <div className="mt-4 rounded-md border border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm text-muted-foreground">{copy.waitForStart}</p>
            </div>
          ) : isOver ? (
            <div className="mt-4 rounded-md border border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm text-muted-foreground">{copy.windowClosed}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <textarea
                className="min-h-[160px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={copy.answerPlaceholder}
              />
              <Button onClick={submitAnswer} disabled={submitting}>
                {submitting ? copy.submitting : copy.submitOnce}
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section className="card-frame bg-card p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-foreground">{copy.adminTitle}</h2>
            <Button variant="outline" size="sm" onClick={reloadSubmissions} disabled={loadingSubmissions}>
              {copy.refresh}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
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
            <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {copy.promptEditorLabel}
            </label>
            <textarea
              className="min-h-[180px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.promptEditorPlaceholder}
            />
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
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                      {row.answer}
                    </pre>
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
