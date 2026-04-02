/**
 * Forgot Password Page
 *
 * Request a password reset link.
 */

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      toast.success('If an account exists for that email, a reset link has been sent.');
      setEmail('');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 animate-fade-up">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a link to create a new password.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="reset-email"
            className="text-xs font-medium text-muted-foreground"
          >
            Email address
          </label>
          <Input
            id="reset-email"
            type="email"
            placeholder="john.doe@example.com"
            className="h-10 rounded-lg bg-background/70"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="h-10 w-full text-sm font-semibold"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
        <span>Remembered your password?</span>{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}
