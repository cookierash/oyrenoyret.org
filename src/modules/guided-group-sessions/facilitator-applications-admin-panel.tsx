'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useI18n } from '@/src/i18n/i18n-provider';

type CurriculumSubject = {
  slug: string;
  nameEn: string;
  nameAz: string;
};

type UserLite = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  grade: string | null;
  dateOfBirth: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  parentEmail: string | null;
};

type StaffLite = { firstName: string | null; lastName: string | null; email: string } | null;

type ApplicationRow = {
  id: string;
  phoneNumber: string;
  finCode: string;
  motivationLetter: string;
  status: 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
  reviewerMessage: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserLite;
  reviewedBy: StaffLite;
  subjects: Array<{ subjectId: string; approvedAt: string | null }>;
};

type ReviewAction = 'approve' | 'reject' | 'request_changes';

function getAgeYears(dateOfBirthIso: string | null): number | null {
  if (!dateOfBirthIso) return null;
  const dateOfBirth = new Date(dateOfBirthIso);
  if (Number.isNaN(dateOfBirth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) years -= 1;
  return Number.isFinite(years) && years >= 0 ? years : null;
}

export function FacilitatorApplicationsAdminPanel() {
  const { messages } = useI18n();
  const copy = messages.admin?.facilitatorApplications ?? null;

  const [status, setStatus] = useState<'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<ReviewAction>('request_changes');
  const [target, setTarget] = useState<ApplicationRow | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [approvedSubjectIds, setApprovedSubjectIds] = useState<string[]>([]);

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.slug, String(s.nameEn ?? s.slug));
    return map;
  }, [subjects]);

  const loadSubjects = async () => {
    try {
      const res = await fetch('/api/curriculum', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { subjects?: CurriculumSubject[] };
      const next = Array.isArray(data?.subjects)
        ? data.subjects
            .filter((s) => s && typeof s.slug === 'string')
            .map((s) => ({ slug: String(s.slug), nameEn: String(s.nameEn ?? s.slug), nameAz: String(s.nameAz ?? s.slug) }))
        : [];
      setSubjects(next);
    } catch {
      setSubjects([]);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('take', '200');
      if (status !== 'ALL') params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/admin/facilitator-applications?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = extractErrorMessage(data);
        setLoadError(message || (copy?.toasts?.loadFailed ?? 'Failed to load applications.'));
        toast.error(formatErrorToast(copy?.toasts?.loadFailed ?? 'Failed to load applications.', message));
        setRows([]);
        return;
      }
      setLoadError(null);
      setRows(Array.isArray(data) ? (data as ApplicationRow[]) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      setLoadError(message || (copy?.toasts?.loadFailed ?? 'Failed to load applications.'));
      toast.error(formatErrorToast(copy?.toasts?.loadFailed ?? 'Failed to load applications.', error instanceof Error ? error.message : null));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubjects();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openReview = (row: ApplicationRow, action: ReviewAction) => {
    setTarget(row);
    setDialogAction(action);
    setReviewMessage('');
    setApprovedSubjectIds(action === 'approve' ? row.subjects.map((s) => s.subjectId) : []);
    setDialogOpen(true);
  };

  const toggleApproved = (subjectId: string) => {
    setApprovedSubjectIds((prev) => {
      const set = new Set(prev);
      if (set.has(subjectId)) set.delete(subjectId);
      else set.add(subjectId);
      return Array.from(set).sort();
    });
  };

  const submitReview = async () => {
    if (!target) return;
    if (busyId) return;

    const message = reviewMessage.trim();
    if (dialogAction !== 'approve' && message.length < 3) {
      toast.error(copy?.toasts?.messageRequired ?? 'Message is required.');
      return;
    }
    if (dialogAction === 'approve' && approvedSubjectIds.length === 0) {
      toast.error(copy?.toasts?.subjectsRequired ?? 'Select at least one subject to approve.');
      return;
    }

    setBusyId(target.id);
    try {
      const res = await fetch(`/api/admin/facilitator-applications/${encodeURIComponent(target.id)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: dialogAction,
          message: message || undefined,
          approvedSubjectIds: dialogAction === 'approve' ? approvedSubjectIds : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy?.toasts?.updateFailed ?? 'Failed to update application.', extractErrorMessage(data)));
        return;
      }
      toast.success(copy?.toasts?.updated ?? 'Updated.');
      setDialogOpen(false);
      setTarget(null);
      await load();
    } catch (error) {
      toast.error(formatErrorToast(copy?.toasts?.updateFailed ?? 'Failed to update application.', error instanceof Error ? error.message : null));
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'PENDING').length;
    const changes = rows.filter((r) => r.status === 'CHANGES_REQUESTED').length;
    return { pending, changes, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {copy?.statusLabel ?? 'Status'}
          </span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-[220px]">
            <SelectItem value="PENDING">{copy?.statuses?.PENDING ?? 'Pending'}</SelectItem>
            <SelectItem value="CHANGES_REQUESTED">{copy?.statuses?.CHANGES_REQUESTED ?? 'Changes requested'}</SelectItem>
            <SelectItem value="APPROVED">{copy?.statuses?.APPROVED ?? 'Approved'}</SelectItem>
            <SelectItem value="REJECTED">{copy?.statuses?.REJECTED ?? 'Rejected'}</SelectItem>
            <SelectItem value="ALL">{copy?.statusAll ?? 'All'}</SelectItem>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            {copy?.counts?.summary
              ? copy.counts.summary
                  .replace('{{pending}}', String(counts.pending))
                  .replace('{{changes}}', String(counts.changes))
                  .replace('{{total}}', String(counts.total))
              : `${counts.pending} pending · ${counts.changes} changes · ${counts.total} total`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy?.searchPlaceholder ?? 'Search by name or email'}
            className="w-full sm:w-[260px]"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {copy?.refresh ?? 'Refresh'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="card-frame bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : loadError ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-10">
          <p className="text-sm font-medium text-foreground">
            {copy?.toasts?.loadFailed ?? 'Failed to load applications.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80 whitespace-pre-wrap">
            {loadError}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {copy?.emptyTitle ?? 'No applications found.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {copy?.emptyHint ?? 'Try changing filters or search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            const applicantName = [row.user.firstName, row.user.lastName].filter(Boolean).join(' ') || row.user.email.split('@')[0];
            const ageYears = getAgeYears(row.user.dateOfBirth);
            const subjectLabels = row.subjects.map((s) => subjectNameById.get(s.subjectId) ?? s.subjectId);
            return (
              <Card key={row.id} className="card-frame bg-card">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{applicantName}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {row.user.grade ? (
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            Grade {row.user.grade}
                          </span>
                        ) : null}
                        {ageYears != null ? (
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
                            Age {ageYears}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 font-medium',
                            row.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                              : row.status === 'APPROVED'
                                ? 'bg-primary/10 text-primary'
                                : row.status === 'REJECTED'
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-muted/60 text-foreground',
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary-primary"
                        onClick={() => openReview(row, 'approve')}
                        disabled={busyId === row.id}
                      >
                        {copy?.actions?.approve ?? 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReview(row, 'request_changes')}
                        disabled={busyId === row.id}
                      >
                        {copy?.actions?.requestChanges ?? 'Request changes'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openReview(row, 'reject')}
                        disabled={busyId === row.id}
                      >
                        {copy?.actions?.reject ?? 'Reject'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">Parent</p>
                      <p className="mt-1 text-sm text-foreground">
                        {[row.user.parentFirstName, row.user.parentLastName].filter(Boolean).join(' ') || '—'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.user.parentEmail ?? '—'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">Contact</p>
                      <p className="mt-1 text-sm text-foreground">{row.phoneNumber}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">FIN: {row.finCode}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">
                      Subjects requested
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {subjectLabels.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        subjectLabels.map((label) => (
                          <span key={label} className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-foreground">
                            {label}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">
                      Motivation letter
                    </p>
                    <div className="mt-1 rounded-lg border border-border bg-muted/10 px-4 py-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {row.motivationLetter || '—'}
                      </p>
                    </div>
                  </div>

                  {row.reviewerMessage ? (
                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">
                        Reviewer message
                      </p>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{row.reviewerMessage}</p>
                    </div>
                  ) : null}

                  {row.reviewedAt || row.reviewedBy ? (
                    <p className="text-[11px] text-muted-foreground">
                      Reviewed {row.reviewedAt ? `at ${new Date(row.reviewedAt).toLocaleString()}` : ''}{' '}
                      {row.reviewedBy ? `by ${[row.reviewedBy.firstName, row.reviewedBy.lastName].filter(Boolean).join(' ') || row.reviewedBy.email}` : ''}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setTarget(null);
            setReviewMessage('');
            setApprovedSubjectIds([]);
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === 'approve'
                ? copy?.dialog?.approveTitle ?? 'Approve application'
                : dialogAction === 'reject'
                  ? copy?.dialog?.rejectTitle ?? 'Reject application'
                  : copy?.dialog?.changesTitle ?? 'Request changes'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === 'approve'
                ? copy?.dialog?.approveDescription ?? 'Select which subjects to verify and optionally add a message.'
                : dialogAction === 'reject'
                  ? copy?.dialog?.rejectDescription ?? 'Provide a message to the applicant.'
                  : copy?.dialog?.changesDescription ?? 'Provide a message describing what to change.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dialogAction === 'approve' && target ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {copy?.dialog?.subjectsLabel ?? 'Approved subjects'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {target.subjects.map((s) => {
                  const label = subjectNameById.get(s.subjectId) ?? s.subjectId;
                  const checked = approvedSubjectIds.includes(s.subjectId);
                  return (
                    <label
                      key={s.subjectId}
                      className="flex items-start gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2 cursor-pointer hover:bg-muted/20"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleApproved(s.subjectId)} aria-label={label} />
                      <span className="text-sm text-foreground">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {copy?.dialog?.messageLabel ?? 'Message'}
              {dialogAction === 'approve' ? (
                <span className="text-muted-foreground/70"> ({copy?.dialog?.optional ?? 'optional'})</span>
              ) : (
                <span className="text-destructive"> *</span>
              )}
            </p>
            <textarea
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              rows={4}
              className={cn(
                'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground/80',
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
              )}
              placeholder={copy?.dialog?.messagePlaceholder ?? 'Write a message to the applicant...'}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>{copy?.dialog?.cancel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={submitReview} disabled={!target || busyId != null}>
              {busyId != null ? (copy?.dialog?.saving ?? 'Saving...') : copy?.dialog?.confirm ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
