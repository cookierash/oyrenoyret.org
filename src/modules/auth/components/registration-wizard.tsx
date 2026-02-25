/**
 * Registration Wizard
 * 
 * Multi-step registration flow component that manages state and navigation
 * between all registration steps.
 */

'use client';

import { useState } from 'react';
import { Step1StudentInfo } from '../steps/step-1-student-info';
import { Step2ParentInfo } from '../steps/step-2-parent-info';
import { Step3Verification } from '../steps/step-3-verification';
import { Step4Consent } from '../steps/step-4-consent';
import { Step5Complete } from '../steps/step-5-complete';
import { cn } from '@/src/lib/utils';

const TOTAL_STEPS = 5;

export function RegistrationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);


  const handleStep1Success = (newUserId: string, firstName: string) => {
    setUserId(newUserId);
    setStudentName(firstName);
    setCurrentStep(2);
  };

  const handleStep2Success = (email: string) => {
    setParentEmail(email);
    setCurrentStep(3);
  };

  const handleStep3Success = () => {
    setCurrentStep(4);
  };

  const handleStep4Success = () => {
    setCurrentStep(5);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Create your learning profile';
      case 2:
        return 'Add a trusted adult';
      case 3:
        return 'Verify parent or guardian';
      case 4:
        return 'Review parental consent';
      case 5:
        return 'You are ready to start';
      default:
        return 'Registration';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return 'We use this to personalise your journey and keep your progress safe.';
      case 2:
        return 'We need a parent or legal guardian so everyone stays informed.';
      case 3:
        return 'We’ve sent a secure, one-time code to your parent or guardian’s email.';
      case 4:
        return 'Your parent or guardian confirms how we can use and protect your data.';
      case 5:
        return 'Your account is active. You can now explore lessons and activities.';
      default:
        return '';
    }
  };

  return (
    <div className="w-full rounded-lg border border-border bg-card text-card-foreground px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        <header className="space-y-2">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {getStepTitle()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {getStepDescription()}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const step = i + 1;
              const isCompleted = step < currentStep;
              const isCurrent = step === currentStep;
              return (
                <div
                  key={step}
                  className={cn(
                    'h-2.5 flex-1 rounded-full transition-all duration-500 ease-out',
                    isCompleted && 'bg-primary',
                    isCurrent && 'bg-primary',
                    !isCompleted && !isCurrent && 'bg-muted',
                  )}
                />
              );
            })}
          </div>
        </header>

        <section>
          {currentStep === 1 && (
            <Step1StudentInfo onSuccess={handleStep1Success} />
          )}
          {currentStep === 2 && userId && (
            <Step2ParentInfo
              userId={userId}
              onSuccess={handleStep2Success}
              onPrevious={handlePrevious}
            />
          )}
          {currentStep === 3 && userId && parentEmail && (
            <Step3Verification
              userId={userId}
              parentEmail={parentEmail}
              onSuccess={handleStep3Success}
              onPrevious={handlePrevious}
            />
          )}
          {currentStep === 4 && userId && (
            <Step4Consent
              userId={userId}
              onSuccess={handleStep4Success}
              onPrevious={handlePrevious}
            />
          )}
          {currentStep === 5 && (
            <Step5Complete studentName={studentName || undefined} />
          )}
        </section>
    </div>
  );
}
