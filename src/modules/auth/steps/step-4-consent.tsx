/**
 * Step 4: Parental Consent
 * 
 * Displays consent form and requires checkbox confirmation.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { consentSchema, type ConsentInput } from '../schemas/registration';
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PiShieldCheck as ShieldCheck } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';

interface Step4Props {
  userId: string;
  onSuccess: () => void;
  onPrevious: () => void;
  initialValues?: Partial<ConsentInput>;
  onValuesChange?: (values: ConsentInput) => void;
}
const BUTTON_CLASS = 'h-10 text-sm font-semibold';

const CONSENT_TEXT = `
By checking the box below, I confirm that:

1. I am the parent or legal guardian of the student registering for OyrenOyret.

2. I give permission for my child to:
   - Create and use an account on OyrenOyret
   - Participate in online learning and teaching activities
   - Interact with other students on the platform

3. I understand the platform may collect:
   - Basic personal information (name, email address, grade level)
   - Learning activity data (lessons attended or taught, progress)
   - Usage and interaction data

4. I consent to the collection and use of this data for educational and platform-related purposes.

5. I understand that OyrenOyret provides a moderated environment, but cannot guarantee complete supervision.
   - My child is responsible for their behavior and interactions
   - I will guide my child to use the platform responsibly

6. I understand that the platform uses a credit system only and that no real money transactions are involved.

7. I may request deletion of my child's account and withdraw consent at any time by contacting the platform.

This consent is required for students under 18 years of age to use the platform.
`;

export function Step4Consent({
  userId,
  onSuccess,
  onPrevious,
  initialValues,
  onValuesChange,
}: Step4Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ConsentInput>({
    resolver: zodResolver(consentSchema),
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
        toast.success('Registration completed successfully!');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to grant consent');
      }
    } catch {
      toast.error('An unexpected error occurred');
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
              Consent required
            </p>
            <h3 className="text-lg font-semibold">Parental Consent Required</h3>
            <p className="text-sm text-muted-foreground">
              As required by law, we need parental or legal guardian consent for students under 18 years of age.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Consent summary</p>
                <p className="text-xs text-muted-foreground">
                  Please review the statements below before granting consent.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3 sm:p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {CONSENT_TEXT}
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
                      I agree to the parental consent terms
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Required to activate the student account
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Required
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
            Previous
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={`flex-1 ${BUTTON_CLASS}`}
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? 'Completing...' : 'Complete Registration'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
