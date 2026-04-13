'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';

type ReportReason = 'SPAM' | 'HARASSMENT' | 'CHEATING' | 'IMPERSONATION' | 'OTHER';
type ReportTargetType = 'PROFILE' | 'DISCUSSION' | 'DISCUSSION_REPLY' | 'MATERIAL' | 'MATERIAL_COMMENT';

export function ReportButton(props: {
  reportedUserId: string;
  reportedUserPublicId: string | null;
  reportedUserName: string;
  targetType?: ReportTargetType;
  targetId?: string | null;
  contextUrl?: string | null;
  buttonVariant?: ButtonVariant;
  buttonClassName?: string;
}) {
  const { messages } = useI18n();
  const copy = messages.userReports;
  const { user, canWrite, writeRestriction } = useCurrentUser();
  const isSelf = user.id === props.reportedUserId;
  const target = props.reportedUserPublicId ?? props.reportedUserId;
  const targetType: ReportTargetType = props.targetType ?? 'PROFILE';

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const detailsTrimmed = details.trim();

  const close = () => {
    setOpen(false);
    setReason('SPAM');
    setDetails('');
  };

  const reasonOptions = useMemo(
    () =>
      [
        { value: 'SPAM', label: copy.reasons.SPAM },
        { value: 'HARASSMENT', label: copy.reasons.HARASSMENT },
        { value: 'CHEATING', label: copy.reasons.CHEATING },
        { value: 'IMPERSONATION', label: copy.reasons.IMPERSONATION },
        { value: 'OTHER', label: copy.reasons.OTHER },
      ] as const,
    [copy.reasons],
  );

  const submit = async () => {
    if (isSelf) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (!detailsTrimmed) {
      toast.error(copy.detailsRequired);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: target,
          targetType,
          ...(props.targetId ? { targetId: props.targetId } : {}),
          reason,
          details: detailsTrimmed,
          contextUrl:
            props.contextUrl ??
            (typeof window !== 'undefined' ? window.location.pathname : ''),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toasts.submitFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(copy.toasts.submitted);
      close();
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toasts.submitFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={props.buttonVariant ?? 'danger'}
        onClick={() => setOpen(true)}
        disabled={isSelf}
        className={props.buttonClassName}
        title={isSelf ? copy.cannotReportSelf : copy.button}
      >
        {targetType === 'PROFILE'
          ? copy.button
          : copy.targets?.[targetType] ? copy.buttonTarget.replace('{{target}}', copy.targets[targetType]) : copy.button}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetType === 'PROFILE'
                ? copy.dialogTitle.replace('{{name}}', props.reportedUserName)
                : copy.dialogTitleTarget
                  .replace('{{target}}', copy.targets?.[targetType] ?? 'content')
                  .replace('{{name}}', props.reportedUserName)}
            </AlertDialogTitle>
            <AlertDialogDescription>{copy.dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4 grid gap-4 pb-3">
            <div className="grid gap-2">
              <Label htmlFor="report-reason">{copy.reasonLabel}</Label>
              <Select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
              >
                {reasonOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-details">{copy.detailsLabel}</Label>
              <textarea
                id="report-details"
                className="min-h-[110px] max-h-[220px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={copy.detailsPlaceholder}
                maxLength={2000}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} onClick={close}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={submit} disabled={submitting || !detailsTrimmed}>
              {submitting ? copy.submitting : copy.submit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ReportUserButton(props: {
  reportedUserId: string;
  reportedUserPublicId: string | null;
  reportedUserName: string;
}) {
  return <ReportButton {...props} targetType="PROFILE" />;
}
