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
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useI18n } from '@/src/i18n/i18n-provider';

type UserModerationState = {
  id: string;
  status: string;
  suspensionUntil: string | null;
  suspensionReason: string | null;
  bannedAt: string | null;
  banReason: string | null;
};

type ActionKind = 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN';

export function AdminUserModerationPanel({
  user,
  onUpdated,
}: {
  user: UserModerationState;
  onUpdated?: (next: UserModerationState) => void;
}) {
  const { messages } = useI18n();
  const copy = messages.admin?.moderationPanel?.toasts;
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ActionKind>('SUSPEND');
  const [duration, setDuration] = useState<'24H' | '1W' | '1M'>('24H');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => {
    switch (action) {
      case 'SUSPEND':
        return 'Suspend user';
      case 'UNSUSPEND':
        return 'Unsuspend user';
      case 'BAN':
        return 'Ban user';
      case 'UNBAN':
        return 'Unban user';
    }
  }, [action]);

  const description = useMemo(() => {
    switch (action) {
      case 'SUSPEND':
        return 'Suspended accounts can browse but cannot create materials, post, or join events. Requires a reason.';
      case 'UNSUSPEND':
        return 'Lift the suspension early. Requires a reason.';
      case 'BAN':
        return 'Banned accounts lose access to platform content until unbanned. Requires a reason.';
      case 'UNBAN':
        return 'Restore account access. Requires a reason.';
    }
  }, [action]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error(copy?.reasonRequired ?? 'Reason is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/moderation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'SUSPEND'
            ? { action, duration, reason: trimmed }
            : { action, reason: trimmed },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(copy?.updateFailed ?? 'Failed to update user.', extractErrorMessage(data)),
        );
        return;
      }
      toast.success(copy?.updated ?? 'Updated.');
      if (onUpdated) {
        onUpdated({
          id: user.id,
          status: String(data.status ?? user.status),
          suspensionUntil: data.suspensionUntil ?? null,
          suspensionReason: data.suspensionReason ?? null,
          bannedAt: data.bannedAt ?? null,
          banReason: data.banReason ?? null,
        });
      } else if (typeof window !== 'undefined') {
        window.location.reload();
      }
      setOpen(false);
      setReason('');
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy?.updateFailed ?? 'Failed to update user.',
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusLine =
    user.status === 'SUSPENDED'
      ? `Suspended until ${user.suspensionUntil ? new Date(user.suspensionUntil).toLocaleString() : '—'}`
      : user.status === 'BANNED'
        ? 'Banned'
        : user.status;

  return (
    <div className="card-frame bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Moderation</h2>
          <p className="mt-1 text-xs text-muted-foreground">{statusLine}</p>
          {user.status === 'SUSPENDED' && user.suspensionReason ? (
            <p className="mt-1 text-xs text-muted-foreground">Reason: {user.suspensionReason}</p>
          ) : null}
          {user.status === 'BANNED' && user.banReason ? (
            <p className="mt-1 text-xs text-muted-foreground">Reason: {user.banReason}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {user.status !== 'BANNED' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAction('SUSPEND');
                setOpen(true);
              }}
            >
              Suspend
            </Button>
          ) : null}
          {user.status === 'SUSPENDED' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAction('UNSUSPEND');
                setOpen(true);
              }}
            >
              Unsuspend
            </Button>
          ) : null}
          {user.status !== 'BANNED' ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setAction('BAN');
                setOpen(true);
              }}
            >
              Ban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAction('UNBAN');
                setOpen(true);
              }}
            >
              Unban
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            {action === 'SUSPEND' ? (
              <div className="space-y-1">
                <Label htmlFor="suspension-duration">Duration</Label>
                <Select
                  id="suspension-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as any)}
                >
                  <SelectItem value="24H">24 hours</SelectItem>
                  <SelectItem value="1W">1 week</SelectItem>
                  <SelectItem value="1M">1 month</SelectItem>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="moderation-reason">Reason</Label>
              <textarea
                id="moderation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full max-h-[420px] overflow-y-auto rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Required. This will be shown to the user."
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              These actions are admin-only and require a reason.
            </p>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={submitting || !reason.trim()}>
              {submitting ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
