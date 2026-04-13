'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { AVATAR_VARIANTS, coerceAvatarVariant, getAvatarSrc, type AvatarVariant } from '@/src/lib/avatar';

type ProfileInput = {
  firstName: string;
  lastName: string;
  avatarVariant: AvatarVariant;
};

export function AccountProfileForm({
  initialFirstName,
  initialLastName,
  initialAvatarVariant,
}: {
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialAvatarVariant?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { messages } = useI18n();
  const copy = messages.settings.myAccount.profile;
  const validation = messages.auth.validation;

  const schema = useMemo(() => {
    return z.object({
      firstName: z
        .string()
        .max(50, validation.firstNameMax)
        .trim(),
      lastName: z
        .string()
        .max(50, validation.lastNameMax)
        .trim(),
      avatarVariant: z.enum(AVATAR_VARIANTS),
    });
  }, [validation]);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      avatarVariant: coerceAvatarVariant(initialAvatarVariant),
    },
  });

  const [firstNameValue, lastNameValue, avatarVariantValue] = form.watch([
    'firstName',
    'lastName',
    'avatarVariant',
  ]);
  const nameChanged = Boolean(firstNameValue?.trim() || lastNameValue?.trim());
  const avatarChanged = avatarVariantValue !== coerceAvatarVariant(initialAvatarVariant);
  const canSubmit = nameChanged || avatarChanged;

  const onSubmit = async (data: ProfileInput) => {
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const avatarVariant = data.avatarVariant;
    if (!firstName && !lastName && !avatarChanged) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(avatarChanged ? { avatarVariant } : {}),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) throw new Error(extractErrorMessage(payload) ?? '');
      toast.success(copy.saved);
      form.reset({ firstName: '', lastName: '', avatarVariant });
      router.refresh();
    } catch (error) {
      toast.error(formatErrorToast(copy.failed, error instanceof Error ? error.message : null));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="avatarVariant"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-muted-foreground">
                {copy.avatarLabel}
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_VARIANTS.map((variant) => {
                    const selected = field.value === variant;
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => field.onChange(variant)}
                        className={[
                          'relative h-10 w-10 overflow-hidden rounded-full ring-1 transition-all',
                          selected
                            ? 'ring-primary ring-2'
                            : 'ring-border hover:ring-muted-foreground/40',
                        ].join(' ')}
                        aria-label={`${copy.avatarOptionLabel} ${variant}`}
                        aria-pressed={selected}
                      >
                        <img
                          src={getAvatarSrc(variant)}
                          alt=""
                          className="h-full w-full object-cover"
                          width={40}
                          height={40}
                          decoding="async"
                        />
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.firstNameLabel}
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-10 rounded-lg bg-background/70"
                    maxLength={50}
                    autoComplete="given-name"
                    placeholder={initialFirstName ?? ''}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.lastNameLabel}
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-10 rounded-lg bg-background/70"
                    maxLength={50}
                    autoComplete="family-name"
                    placeholder={initialLastName ?? ''}
                    {...field}
                  />
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
          disabled={submitting || !form.formState.isValid || !canSubmit}
        >
          {submitting ? copy.saving : copy.save}
        </Button>
      </form>
    </Form>
  );
}
