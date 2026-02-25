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
import { useState } from 'react';
import { toast } from 'sonner';

interface Step4Props {
  userId: string;
  onSuccess: () => void;
  onPrevious: () => void;
}

const CONSENT_TEXT = `
By checking the box below, I acknowledge that:

1. I am the parent or legal guardian of the student registering for this platform.

2. I understand that this platform collects and processes personal information including:
   - Student's name, email address, and grade level
   - Academic progress and learning data
   - Usage analytics and interaction data

3. I consent to the collection, storage, and use of this information for educational purposes.

4. I understand that the platform is designed for educational use and that student data will be:
   - Used to personalize learning experiences
   - Protected according to applicable privacy laws
   - Not shared with third parties without explicit consent

5. I have the right to revoke this consent at any time by contacting the platform administrators.

6. I understand that the student's account will remain active as long as this consent is valid.

This consent is required for students under 18 years of age to use the platform in accordance with applicable data protection regulations.
`;

export function Step4Consent({ userId, onSuccess, onPrevious }: Step4Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ConsentInput>({
    resolver: zodResolver(consentSchema),
    mode: 'onChange',
    defaultValues: {
      consentGranted: false,
    },
  });

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
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Parental Consent Required</h3>
            <p className="text-sm text-muted-foreground mb-3">
              As required by law, we need parental or legal guardian consent for students under 18 years of age.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card/80 p-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                {CONSENT_TEXT}
              </pre>
            </div>
          </div>

          <FormField
            control={form.control}
            name="consentGranted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 rounded-md bg-muted/40 p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none flex-1">
                  <FormLabel className="cursor-pointer font-medium">
                    I have read and agree to the terms above
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    You must grant consent to complete registration
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" size="md" onClick={onPrevious} className="flex-1">
            Previous
          </Button>
          <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSubmitting || !form.formState.isValid}>
            {isSubmitting ? 'Completing...' : 'Complete Registration'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
