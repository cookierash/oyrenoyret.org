/**
 * Verify Email Page
 *
 * Verifies the user email using a token.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';
import { PiSpinnerGap as Spinner } from 'react-icons/pi';
import { PiArrowLeft as ArrowLeft } from 'react-icons/pi';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<{
    id: string;
    role: string;
    emailVerifiedAt: string | null;
  } | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.auth.verifyEmail;

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setSessionUser(data.user ?? null))
      .catch(() => setSessionUser(null))
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      setStatus('verifying');
      setStatusMessage(null);
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = (await res.json().catch(() => ({}))) as { success?: boolean; alreadyVerified?: boolean; errorKey?: string; error?: string };
        if (!res.ok || !payload.success) {
          const msg = resolveAuthError(messages, t, copy.failed, payload);
          throw new Error(msg);
        }
        if (cancelled) return;
        setStatus('success');
        setStatusMessage(payload.alreadyVerified ? copy.verified : copy.success);
        toast.success(payload.alreadyVerified ? copy.verified : copy.success);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        const message = error instanceof Error ? error.message : copy.failed;
        setStatusMessage(message);
        toast.error(message);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, copy.failed, copy.success, messages, t]);

  const isSessionVerified = sessionUser
    ? Boolean(sessionUser.emailVerifiedAt)
    : false;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 animate-fade-up">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </header>

      {!token ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          {sessionLoaded && isSessionVerified
            ? copy.verified
            : sessionLoaded && sessionUser
              ? messages.auth.errors.emailNotVerified
              : copy.missingToken}
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          {status === 'verifying' ? (
            <div className="flex items-center gap-2">
              <Spinner className="h-4 w-4 animate-spin text-primary" aria-hidden />
              <span>{copy.verifying}</span>
            </div>
          ) : null}
          {status === 'success' && (statusMessage ?? copy.success)}
          {status === 'error' && (statusMessage ?? copy.failed)}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 flex-1 text-sm font-medium gap-1"
          onClick={() => router.push(sessionUser ? '/dashboard' : '/')}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {copy.backHome}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-10 flex-1 text-sm font-medium"
          onClick={async () => {
            try {
              const res = await fetch('/api/auth/send-email-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(token ? { token } : {}),
              });
              const payload = (await res.json().catch(() => ({}))) as {
                success?: boolean;
                alreadyVerified?: boolean;
                errorKey?: string;
                error?: string;
              };
              if (!res.ok || !payload.success) {
                throw new Error(resolveAuthError(messages, t, copy.resendFailed, payload));
              }
              toast.success(payload.alreadyVerified ? copy.verified : copy.resendSuccess);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : copy.resendFailed);
            }
          }}
        >
          {copy.resend}
        </Button>
      </div>
    </div>
  );
}
