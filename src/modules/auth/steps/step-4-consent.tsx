/**
 * Step 4: Parental Consent
 * 
 * Displays consent form and requires checkbox confirmation.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createConsentSchema, type ConsentInput } from '../schemas/registration';
import { grantParentalConsent } from '../actions/registration';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PiShieldCheck as ShieldCheck } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

interface Step4Props {
  userId: string;
  onSuccess: () => void;
  onPrevious: () => void;
  initialValues?: Partial<ConsentInput>;
  onValuesChange?: (values: ConsentInput) => void;
}
const BUTTON_CLASS = 'h-10 text-sm font-medium';

export function Step4Consent({
  userId,
  onSuccess,
  onPrevious,
  initialValues,
  onValuesChange,
}: Step4Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.auth.steps.consent;
  const validation = messages.auth.validation;
  const validationSchema = useMemo(() => createConsentSchema(validation), [validation]);

  const form = useForm<ConsentInput>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      consentGranted: initialValues?.consentGranted ?? false,
    },
  });

  const consentGranted = form.watch('consentGranted');

  useEffect(() => {
    if (!onValuesChange) return;
    const subscription = form.watch((value) => {
      onValuesChange(value as ConsentInput);
    });
    return () => subscription.unsubscribe();
  }, [form, onValuesChange]);

  const onSubmit = async (data: ConsentInput) => {
    setIsSubmitting(true);
    try {
      const result = await grantParentalConsent(userId, data);

      if (result.success) {
        toast.success(copy.success);
        onSuccess();
      } else {
        toast.error(resolveAuthError(messages, t, copy.failed, result));
      }
    } catch {
      toast.error(copy.unexpected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {copy.badge}
            </p>
            <h3 className="text-lg font-medium">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{copy.summaryTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {copy.summarySubtitle}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3 sm:p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {copy.consentText}
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="consentGranted"
            render={({ field }) => (
              <FormItem
                className={cn(
                  'rounded-xl border p-4 transition',
                  consentGranted
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none flex-1">
                    <FormLabel className="cursor-pointer font-medium">
                      {copy.checkbox}
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {copy.requiredHint}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {copy.requiredBadge}
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onPrevious}
            className={`flex-1 ${BUTTON_CLASS}`}
          >
            {copy.previous}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={`flex-1 ${BUTTON_CLASS}`}
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? copy.completing : copy.complete}
          </Button>
        </div>
      </form>
    </Form>
  );
}
