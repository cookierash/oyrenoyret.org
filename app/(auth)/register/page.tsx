/**
 * Registration Page
 * 
 * Multi-step registration flow for new students.
 */

'use client';

import Link from 'next/link';
import { RegistrationWizard } from '@/src/modules/auth/components/registration-wizard';
import { useState } from 'react';
import { useI18n } from '@/src/i18n/i18n-provider';

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const { messages } = useI18n();
  const copy = messages.auth.registerPage;

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up space-y-6">
      <RegistrationWizard onStepChange={setCurrentStep} />
      {currentStep !== 5 && (
        <div className="border-t border-border/60 pt-4 text-sm text-muted-foreground text-center">
          <span>{copy.hasAccount}</span>{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            {copy.signIn}
          </Link>
        </div>
      )}
    </div>
  );
}
