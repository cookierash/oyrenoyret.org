/**
 * Step 3: Parent Email Verification
 * 
 * Sends and validates a 6-digit verification code to the parent email.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createVerificationCodeSchema, type VerificationCodeInput } from '../schemas/registration';
import {
  sendParentVerificationCode,
  verifyParentEmail,
} from '../actions/registration';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

interface Step3Props {
  userId: string;
  parentEmail: string;
  onSuccess: () => void;
  onPrevious: () => void;
}
const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLASS = 'h-10 rounded-lg bg-background/70';

export function Step3Verification({ userId, parentEmail, onSuccess, onPrevious }: Step3Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const hasSentInitialCode = useRef(false);
  const { t, messages } = useI18n();
  const copy = messages.auth.steps.verification;
  const placeholders = messages.auth.placeholders;
  const validation = messages.auth.validation;
  const validationSchema = useMemo(() => createVerificationCodeSchema(validation), [validation]);

  const form = useForm<VerificationCodeInput>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      code: '',
    },
  });

  // Send code on mount
  useEffect(() => {
    if (hasSentInitialCode.current) return;
    hasSentInitialCode.current = true;
    handleSendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      const result = await sendParentVerificationCode(userId);

      if (result.success) {
        toast.success(t('auth.steps.verification.codeSent', { email: parentEmail }));
      } else {
        toast.error(resolveAuthError(messages, t, copy.sendFailed, result));
      }
    } catch {
      toast.error(copy.unexpected);
    } finally {
      setIsSendingCode(false);
    }
  };

  const onSubmit = async (data: VerificationCodeInput) => {
    setIsSubmitting(true);
    try {
      const result = await verifyParentEmail(userId, data);

      if (result.success) {
        toast.success(copy.verified);
        onSuccess();
      } else {
        toast.error(resolveAuthError(messages, t, copy.invalid, result));
        form.resetField('code');
      }
    } catch {
      toast.error(copy.unexpected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
            <p className="text-sm text-muted-foreground">
              {copy.bannerTitle}
            </p>
            <p className="font-semibold text-primary mt-2">
              {parentEmail}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {copy.bannerHint}
            </p>
          </div>

          <FormField
            control={form.control}
            name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>{copy.codeLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={placeholders.verificationCode}
                      maxLength={6}
                      className={`${INPUT_CLASS} text-center text-2xl tracking-widest font-sans tabular-nums`}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {copy.missingCode}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSendCode}
              disabled={isSendingCode}
              className="h-auto p-0 text-primary underline-offset-4 hover:underline bg-transparent shadow-none"
            >
              {isSendingCode ? copy.sending : copy.resend}
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onPrevious}
            className="h-10 flex-1 text-sm font-semibold"
          >
            {copy.previous}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="h-10 flex-1 text-sm font-semibold"
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? copy.verifying : copy.next}
          </Button>
        </div>
      </form>
    </Form>
  );
}
