/**
 * Step 2: Parent/Guardian Information
 * 
 * Collects parent or legal guardian's information.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { parentInfoSchema, type ParentInfoInput } from '../schemas/registration';
import { registerParentInfo } from '../actions/registration';
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Step2Props {
  userId: string;
  onSuccess: (parentEmail: string) => void;
  onPrevious: () => void;
  initialValues?: Partial<ParentInfoInput>;
  onValuesChange?: (values: ParentInfoInput) => void;
}
const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLASS = 'h-10 rounded-lg bg-background/70';

export function Step2ParentInfo({
  userId,
  onSuccess,
  onPrevious,
  initialValues,
  onValuesChange,
}: Step2Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ParentInfoInput>({
    resolver: zodResolver(parentInfoSchema),
    mode: 'onChange',
    defaultValues: {
      parentFirstName: initialValues?.parentFirstName ?? '',
      parentLastName: initialValues?.parentLastName ?? '',
      parentEmail: initialValues?.parentEmail ?? '',
    },
  });

  useEffect(() => {
    if (!onValuesChange) return;
    const subscription = form.watch((value) => {
      onValuesChange(value as ParentInfoInput);
    });
    return () => subscription.unsubscribe();
  }, [form, onValuesChange]);

  const onSubmit = async (data: ParentInfoInput) => {
    setIsSubmitting(true);
    try {
      const result = await registerParentInfo(userId, data);

      if (result.success) {
        toast.success('Parent information saved successfully');
        onSuccess(data.parentEmail);
      } else {
        toast.error(result.error || 'Failed to save parent information');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Please provide the information of a parent or legal guardian who will verify your registration.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="parentFirstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>Parent/Guardian First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane" className={INPUT_CLASS} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentLastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>Parent/Guardian Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" className={INPUT_CLASS} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="parentEmail"
            render={({ field }) => (
              <FormItem>
              <FormLabel className={FIELD_LABEL_CLASS}>Parent/Guardian Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="jane.doe@example.com" className={INPUT_CLASS} {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground mt-1">
                This email must be different from your student email. A verification code will be sent to this address.
              </p>
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
            className="h-10 flex-1 text-sm font-semibold"
          >
            Previous
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="h-10 flex-1 text-sm font-semibold"
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? 'Saving...' : 'Next: Verify Email'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
