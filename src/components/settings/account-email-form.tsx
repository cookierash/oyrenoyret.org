'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/src/modules/auth/components/password-input';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

type EmailInput = {
  email: string;
  currentPassword: string;
};

export function AccountEmailForm({
  currentEmail,
  hasPassword,
  requiresEmailVerification,
}: {
  currentEmail: string;
  hasPassword: boolean;
  requiresEmailVerification: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.settings.myAccount.email;
  const validation = messages.auth.validation;

  const schema = useMemo(() => {
    return z.object({
      email: z
        .string()
        .min(1, validation.emailRequired)
        .email(validation.emailInvalid)
        .max(254, validation.emailMax)
        .toLowerCase()
        .trim(),
      currentPassword: z.string().min(1, validation.loginPasswordRequired).max(72, validation.passwordMax),
    });
  }, [validation]);

  const form = useForm<EmailInput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      currentPassword: '',
    },
  });

  const onSubmit = async (data: EmailInput) => {
    if (!hasPassword) {
      toast.error(copy.passwordNotSet);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          currentPassword: data.currentPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        errorKey?: string;
        error?: string;
        unchanged?: boolean;
        verificationSent?: boolean;
      };
      if (!res.ok || !payload.success) {
        throw new Error(resolveAuthError(messages, t, copy.failed, payload));
      }
      if (payload.unchanged) {
        toast.success(copy.unchanged);
        return;
      }
      toast.success(copy.updated);
      form.reset({ email: '', currentPassword: '' });
      router.refresh();
    } catch (error) {
      toast.error(formatErrorToast(copy.failed, error instanceof Error ? error.message : null));
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/send-email-verification', { method: 'POST' });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || payload.success === false) {
        throw new Error(extractErrorMessage(payload) ?? '');
      }
      toast.success(messages.auth.verifyEmail.resendSuccess);
    } catch (error) {
      toast.error(
        formatErrorToast(messages.auth.verifyEmail.resendFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {copy.currentLabel}{' '}
            <span className="font-medium text-foreground">{currentEmail}</span>
          </span>
          {requiresEmailVerification ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resendVerification}
              disabled={resending}
            >
              {resending ? copy.resending : copy.resend}
            </Button>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {copy.verified}
            </span>
          )}
        </div>
        {requiresEmailVerification ? (
          <p className="mt-1.5">
            {copy.unverifiedHint}
          </p>
        ) : null}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.newEmailLabel}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    className="h-10 rounded-lg bg-background/70"
                    maxLength={254}
                    autoComplete="email"
                    placeholder={currentEmail}
                    required
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.currentPasswordLabel}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    className="h-10 rounded-lg bg-background/70"
                    maxLength={72}
                    autoComplete="current-password"
                    required
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting || !form.formState.isValid || !hasPassword}
          >
            {submitting ? copy.saving : copy.save}
          </Button>
        </form>
      </Form>
    </div>
  );
}
