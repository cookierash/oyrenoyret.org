/**
 * Step 1: Student Information
 * 
 * Collects student's basic information including name, email, password, and grade.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentInfoSchema, type StudentInfoInput } from '../schemas/registration';
import { registerStudentInfo } from '../actions/registration';
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
import { cn } from '@/src/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PasswordInput } from '@/src/modules/auth/components/password-input';
import { useI18n } from '@/src/i18n/i18n-provider';
import { resolveAuthError } from '@/src/modules/auth/utils/resolve-auth-error';

interface Step1Props {
  onSuccess: (userId: string, firstName: string) => void;
  initialValues?: Partial<StudentInfoInput>;
  onValuesChange?: (values: StudentInfoInput) => void;
}

const GRADES = ['5', '6', '7', '8', '9', '10', '11'] as const;
const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLASS = 'h-10 rounded-lg bg-background/70';

export function Step1StudentInfo({ onSuccess, initialValues, onValuesChange }: Step1Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.auth.steps.studentInfo;
  const placeholders = messages.auth.placeholders;
  const validation = messages.auth.validation;
  const validationSchema = useMemo(() => createStudentInfoSchema(validation), [validation]);

  const form = useForm<StudentInfoInput>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: initialValues?.firstName ?? '',
      lastName: initialValues?.lastName ?? '',
      email: initialValues?.email ?? '',
      password: initialValues?.password ?? '',
      confirmPassword: initialValues?.confirmPassword ?? '',
      grade: initialValues?.grade ?? undefined,
    },
  });

  useEffect(() => {
    if (!onValuesChange) return;
    const subscription = form.watch((value) => {
      onValuesChange(value as StudentInfoInput);
    });
    return () => subscription.unsubscribe();
  }, [form, onValuesChange]);

  const onSubmit = async (data: StudentInfoInput) => {
    setIsSubmitting(true);
    try {
      const result = await registerStudentInfo(data);

      if (result.success && result.userId) {
        toast.success(copy.success);
        onSuccess(result.userId, data.firstName);
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
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>{copy.firstName}</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholders.firstName} className={INPUT_CLASS} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>{copy.lastName}</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholders.lastName} className={INPUT_CLASS} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
              <FormLabel className={FIELD_LABEL_CLASS}>{copy.email}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={placeholders.email} className={INPUT_CLASS} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

          <FormField
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
              <FormLabel className={FIELD_LABEL_CLASS}>{copy.grade}</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <input
                      type="hidden"
                      {...field}
                      value={field.value ?? ''}
                      ref={field.ref}
                    />
                    <div
                      className="flex w-full rounded-lg border border-input overflow-hidden bg-background/70"
                      role="group"
                      aria-label={copy.selectGrade}
                    >
                      {GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          role="radio"
                          aria-checked={field.value === grade}
                          aria-label={t('auth.steps.studentInfo.gradeLabel', { value: grade })}
                          onClick={() => field.onChange(grade)}
                          onBlur={field.onBlur}
                          className={cn(
                            'flex-1 min-w-0 px-3 py-2 text-sm font-medium transition-colors',
                            'border-r border-input last:border-r-0',
                            'hover:bg-muted/80',
                            field.value === grade
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-background text-foreground',
                          )}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
              <FormLabel className={FIELD_LABEL_CLASS}>{copy.password}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={placeholders.password} className={INPUT_CLASS} {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground mt-1">
                {copy.passwordHint}
              </p>
            </FormItem>
          )}
        />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
              <FormLabel className={FIELD_LABEL_CLASS}>{copy.confirmPassword}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={placeholders.password} className={INPUT_CLASS} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="h-10 w-full text-sm font-semibold"
          disabled={isSubmitting || !form.formState.isValid}
        >
          {isSubmitting ? copy.saving : copy.next}
        </Button>
      </form>
    </Form>
  );
}
