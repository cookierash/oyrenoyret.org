/**
 * Step 1: Student Information
 * 
 * Collects student's basic information including name, email, password, and grade.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentInfoSchema, type StudentInfoInput } from '../schemas/registration';
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
import { useState } from 'react';
import { toast } from 'sonner';

interface Step1Props {
  onSuccess: (userId: string, firstName: string) => void;
}

const GRADES = ['5', '6', '7', '8', '9', '10', '11'] as const;

export function Step1StudentInfo({ onSuccess }: Step1Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<StudentInfoInput>({
    resolver: zodResolver(studentInfoSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      grade: undefined,
    },
  });

  const onSubmit = async (data: StudentInfoInput) => {
    setIsSubmitting(true);
    try {
      const result = await registerStudentInfo(data);

      if (result.success && result.userId) {
        toast.success('Student information saved successfully');
        onSuccess(result.userId, data.firstName);
      } else {
        toast.error(result.error || 'Failed to save student information');
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
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
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
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john.doe@example.com" {...field} />
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
                <FormLabel>Grade</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <input
                      type="hidden"
                      {...field}
                      value={field.value ?? ''}
                      ref={field.ref}
                    />
                    <div
                      className="flex w-full rounded-md border border-input overflow-hidden"
                      role="group"
                      aria-label="Select grade"
                    >
                      {GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          role="radio"
                          aria-checked={field.value === grade}
                          aria-label={`Grade ${grade}`}
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" variant="primary" size="md" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
          {isSubmitting ? 'Saving...' : 'Next: Parent Information'}
        </Button>
      </form>
    </Form>
  );
}
