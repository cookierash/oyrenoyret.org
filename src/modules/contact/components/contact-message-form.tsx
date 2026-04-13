'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { contactMessageSchema, type ContactMessageInput } from '@/src/modules/contact/schemas/contact-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function ContactMessageForm() {
  const { messages } = useI18n();
  const copy = messages.main.contact;
  const [pending, setPending] = useState(false);

  const resolver = useMemo(() => zodResolver(contactMessageSchema), []);

  const form = useForm<ContactMessageInput>({
    resolver,
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactMessageInput) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/contact/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        toast.error(copy.formFailed);
        return;
      }

      toast.success(copy.formSuccess);
      form.reset();
    } catch {
      toast.error(copy.formFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          {copy.formTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.formSubtitle}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {copy.nameLabel}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-10 rounded-lg bg-background/70" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {copy.emailLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      className="h-10 rounded-lg bg-background/70"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.subjectLabel}
                </FormLabel>
                <FormControl>
                  <Input className="h-10 rounded-lg bg-background/70" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {copy.messageLabel}
                </FormLabel>
                <FormControl>
                  <textarea
                    className="min-h-[140px] max-h-[280px] w-full overflow-y-auto rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-end">
            <Button type="submit" variant="primary" className="h-10" disabled={pending}>
              {pending ? copy.formSending : copy.formSend}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
