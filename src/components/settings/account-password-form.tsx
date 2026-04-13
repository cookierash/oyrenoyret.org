'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { formatErrorToast } from '@/src/lib/error-toast';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

type PasswordInputValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function AccountPasswordForm({
  canWrite,
  hasPassword,
}: {
  canWrite: boolean;
  hasPassword: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.settings.myAccount.password;
  const validation = messages.auth.validation;

  const schema = useMemo(() => {
    return z
      .object({
        currentPassword: z.string().min(1, validation.loginPasswordRequired).max(72, validation.passwordMax),
        newPassword: z
          .string()
          .min(8, validation.passwordMin)
          .max(72, validation.passwordMax)
          .regex(/[A-Z]/, validation.passwordUpper)
          .regex(/[a-z]/, validation.passwordLower)
          .regex(/[0-9]/, validation.passwordNumber)
          .regex(/[^A-Za-z0-9]/, validation.passwordSpecial),
        confirmPassword: z.string().min(1, validation.confirmPasswordRequired),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: validation.passwordsMismatch,
        path: ['confirmPassword'],
      });
  }, [validation]);

  const form = useForm<PasswordInputValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordInputValues) => {
    if (!hasPassword) {
      toast.error(copy.passwordNotSet);
      return;
    }
    if (!canWrite) {
      toast.error(copy.requiresVerification);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        errorKey?: string;
        error?: string;
      };
      if (!res.ok || !payload.success) {
        throw new Error(resolveAuthError(messages, t, copy.failed, payload));
      }
      toast.success(copy.updated);
      form.reset();
    } catch (error) {
      toast.error(formatErrorToast(copy.failed, error instanceof Error ? error.message : null));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {!canWrite ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          {copy.requiresVerificationHint}
        </div>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {copy.newPasswordLabel}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput className="h-10 rounded-lg bg-background/70" maxLength={72} required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {copy.confirmPasswordLabel}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput className="h-10 rounded-lg bg-background/70" maxLength={72} required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting || !form.formState.isValid || !canWrite || !hasPassword}
          >
            {submitting ? copy.saving : copy.save}
          </Button>
        </form>
      </Form>
    </div>
  );
}
