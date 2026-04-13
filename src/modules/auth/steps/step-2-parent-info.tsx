/**
 * Step 2: Parent/Guardian Information
 * 
 * Collects parent or legal guardian's information.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createParentInfoSchema, type ParentInfoInput } from '../schemas/registration';
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
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

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
  const { t, messages } = useI18n();
  const copy = messages.auth.steps.parentInfo;
  const placeholders = messages.auth.placeholders;
  const validation = messages.auth.validation;
  const validationSchema = useMemo(() => createParentInfoSchema(validation), [validation]);

  const form = useForm<ParentInfoInput>({
    resolver: zodResolver(validationSchema),
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
        toast.success(copy.success);
        onSuccess(data.parentEmail);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {copy.intro}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="parentFirstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>{copy.firstName}</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholders.parentFirstName} className={INPUT_CLASS} maxLength={50} required {...field} />
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
                  <FormLabel className={FIELD_LABEL_CLASS}>{copy.lastName}</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholders.parentLastName} className={INPUT_CLASS} maxLength={50} required {...field} />
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
              <FormLabel className={FIELD_LABEL_CLASS}>{copy.email}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={placeholders.parentEmail} className={INPUT_CLASS} maxLength={254} required {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground mt-1">
                {copy.emailHint}
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
            className="h-10 flex-1 text-sm font-medium"
          >
            {copy.previous}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="h-10 flex-1 text-sm font-medium"
            disabled={isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? copy.saving : copy.next}
          </Button>
        </div>
      </form>
    </Form>
  );
}
