/**
 * Login Page
 *
 * Renders inside auth layout's right panel.
 */

'use client';

import Link from 'next/link';
import { LoginForm } from '@/src/modules/auth/components/login-form';

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          Register here
        </Link>
      </p>
    </div>
  );
}
