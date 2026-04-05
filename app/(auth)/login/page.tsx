/**
 * Login Page
 *
 * Renders inside auth layout's right panel.
 */

import Link from 'next/link';
import { LoginForm } from '@/src/modules/auth/components/login-form';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { redirect } from 'next/navigation';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Login',
};

export default async function LoginPage() {
  const userId = await getCurrentSession();
  if (userId) {
    redirect('/dashboard');
  }
  const { messages } = await getI18n();
  const copy = messages.auth.loginPage;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 animate-fade-up">
      <LoginForm />
      <div className="border-t border-border/60 pt-4 text-sm text-muted-foreground text-center">
        <span>{copy.noAccount}</span>{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          {copy.register}
        </Link>
      </div>
    </div>
  );
}
