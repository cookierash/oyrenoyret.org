'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';

export function EmailVerificationBanner() {
  const [sending, setSending] = useState(false);
  const { messages } = useI18n();
  const copy = messages.auth.verifyEmail;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{copy.bannerTitle}</p>
          <p className="text-xs text-muted-foreground">{copy.bannerBody}</p>
        </div>
        <Button
          variant="secondary-primary"
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              const res = await fetch('/api/auth/send-email-verification', { method: 'POST', credentials: 'include' });
              const payload = (await res.json().catch(() => ({}))) as {
                success?: boolean;
                alreadyVerified?: boolean;
                error?: string;
              };
              if (!res.ok || payload.success === false) {
                throw new Error(payload.error || copy.resendFailed);
              }
              if (payload.alreadyVerified) {
                toast.success(copy.verified);
              } else {
                toast.success(copy.resendSuccess);
              }
            } catch (error) {
              toast.error(error instanceof Error ? error.message : copy.resendFailed);
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? copy.sending : copy.cta}
        </Button>
      </div>
    </div>
  );
}
