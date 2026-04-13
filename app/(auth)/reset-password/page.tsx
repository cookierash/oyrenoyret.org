/**
 * Reset Password Page
 *
 * Sets a new password using a token from the reset email.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

type ResetPasswordInput = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.auth.resetPassword;
  const validation = messages.auth.validation;

  const schema = useMemo(() => {
    return z
      .object({
        password: z
          .string()
          .min(8, validation.passwordMin)
          .regex(/[A-Z]/, validation.passwordUpper)
          .regex(/[a-z]/, validation.passwordLower)
          .regex(/[0-9]/, validation.passwordNumber)
          .regex(/[^A-Za-z0-9]/, validation.passwordSpecial),
        confirmPassword: z.string().min(1, validation.confirmPasswordRequired),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: validation.passwordsMismatch,
        path: ['confirmPassword'],
      });
  }, [validation]);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      toast.error(copy.invalidToken);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });

      const payload = (await res.json().catch(() => ({}))) as { success?: boolean; errorKey?: string; error?: string };

      if (!res.ok || !payload.success) {
        toast.error(resolveAuthError(messages, t, copy.error, payload));
        return;
      }

      toast.success(copy.success);
      router.push('/login');
      router.refresh();
    } catch {
      toast.error(copy.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 animate-fade-up">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.passwordLabel}
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="h-10 w-full text-sm"
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
        </form>
      </Form>

      <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline font-medium">
          {copy.backToLogin}
        </Link>
      </div>
    </div>
  );
}
