'use client';

import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';

type TargetType = 'MATERIAL' | 'DISCUSSION' | 'DISCUSSION_REPLY' | 'MATERIAL_COMMENT';

export function AdminRemoveContentButton({
  targetType,
  targetId,
  label = 'Remove',
  buttonVariant = 'destructive',
  onRemoved,
}: {
  targetType: TargetType;
  targetId: string;
  label?: string;
  buttonVariant?: 'destructive' | 'outline' | 'ghost' | 'secondary-primary';
  onRemoved?: () => void;
}) {
  const { user } = useCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) return null;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Reason is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/moderation/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to remove content.', extractErrorMessage(data)));
        return;
      }
      toast.success('Removed.');
      setOpen(false);
      setReason('');
      onRemoved?.();
    } catch (error) {
      toast.error(
        formatErrorToast('Failed to remove content.', error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button size="sm" variant={buttonVariant as any} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove content</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. The user will be notified, and only the user and admins
              will be able to view the archived version.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1">
            <Label htmlFor="remove-reason">Reason</Label>
            <textarea
              id="remove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full max-h-[420px] overflow-y-auto rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Required. This will be shown to the user."
            />
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={submitting || !reason.trim()}>
              {submitting ? 'Removing…' : 'Confirm remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
