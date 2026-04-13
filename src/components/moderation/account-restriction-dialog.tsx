'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function AccountRestrictionDialog({
  status,
  suspensionUntil,
  suspensionReason,
  banReason,
}: {
  status?: string | null;
  suspensionUntil?: string | null;
  suspensionReason?: string | null;
  banReason?: string | null;
}) {
  const restricted = status === 'SUSPENDED' || status === 'BANNED';
  const [open, setOpen] = useState(restricted);

  useEffect(() => {
    if (restricted) setOpen(true);
  }, [restricted, status]);

  const title = status === 'BANNED' ? 'Account banned' : 'Account suspended';
  const reason = status === 'BANNED' ? banReason : suspensionReason;

  const untilLabel = useMemo(() => {
    if (status !== 'SUSPENDED' || !suspensionUntil) return null;
    const d = new Date(suspensionUntil);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [status, suspensionUntil]);

  if (!restricted) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              {status === 'BANNED'
                ? 'Your account has been banned by the moderators.'
                : 'Your account has been suspended by the moderators.'}
            </p>
            {untilLabel ? <p>Suspension ends: {untilLabel}</p> : null}
            <p>
              Reason: <span className="font-medium text-foreground">{reason?.trim() || '—'}</span>
            </p>
            <p>
              If you think it is unfair, contact support.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

