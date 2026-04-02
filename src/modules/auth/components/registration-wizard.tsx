/**
 * Registration Wizard
 * 
 * Multi-step registration flow component that manages state and navigation
 * between all registration steps.
 */

'use client';

import { useEffect, useState } from 'react';
import { Step1StudentInfo } from '../steps/step-1-student-info';
import { Step2ParentInfo } from '../steps/step-2-parent-info';
import { Step4Consent } from '../steps/step-4-consent';
import { Step5Complete } from '../steps/step-5-complete';
import { cn } from '@/src/lib/utils';
import type { ConsentInput, ParentInfoInput, StudentInfoInput } from '../schemas/registration';

const TOTAL_STEPS = 4;
const REGISTRATION_STORAGE_KEY = 'oyrenoyret_registration_progress_v1';

export function RegistrationWizard({ onStepChange }: { onStepChange?: (step: number) => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [step1Values, setStep1Values] = useState<Partial<StudentInfoInput>>({});
  const [step2Values, setStep2Values] = useState<Partial<ParentInfoInput>>({});
  const [step4Values, setStep4Values] = useState<Partial<ConsentInput>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as {
        currentStep?: number;
        userId?: string | null;
        parentEmail?: string | null;
        studentName?: string | null;
      };

      if (!parsed.currentStep || parsed.currentStep < 1) return;

      let nextStep = Math.min(parsed.currentStep, TOTAL_STEPS);
      const nextUserId = parsed.userId ?? null;
      const nextParentEmail = parsed.parentEmail ?? null;
      const nextStudentName = parsed.studentName ?? null;

      if (!nextUserId && nextStep > 1) {
        nextStep = 1;
      }
      if (!nextParentEmail && nextStep > 2) {
        nextStep = 2;
      }

      setCurrentStep(nextStep);
      setUserId(nextUserId);
      setParentEmail(nextParentEmail);
      setStudentName(nextStudentName);
    } catch {
      localStorage.removeItem(REGISTRATION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentStep >= TOTAL_STEPS) {
      localStorage.removeItem(REGISTRATION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      REGISTRATION_STORAGE_KEY,
      JSON.stringify({
        currentStep,
        userId,
        parentEmail,
        studentName,
        savedAt: Date.now(),
      })
    );
  }, [currentStep, userId, parentEmail, studentName]);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);


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
        return 'Review parental consent';
      case 4:
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
        return 'Your parent or guardian confirms how we can use and protect your data.';
      case 4:
        return 'Your account is active. You can now explore lessons and activities.';
      default:
        return '';
    }
  };

  return (
    <div className="w-full space-y-5">
      <header
        className={cn(
          'space-y-2',
          currentStep === 4 && 'lg:pt-10'
        )}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {getStepTitle()}
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
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
                  'h-1.5 flex-1 rounded-full transition-all duration-500 ease-out',
                  isCompleted && 'bg-primary',
                  isCurrent && 'bg-primary',
                  !isCompleted && !isCurrent && 'bg-muted',
                )}
              />
            );
          })}
        </div>
      </header>

      <section className="space-y-4">
        {currentStep === 1 && (
          <Step1StudentInfo
            onSuccess={handleStep1Success}
            initialValues={step1Values}
            onValuesChange={setStep1Values}
          />
        )}
        {currentStep === 2 && userId && (
          <Step2ParentInfo
            userId={userId}
            onSuccess={handleStep2Success}
            onPrevious={handlePrevious}
            initialValues={step2Values}
            onValuesChange={setStep2Values}
          />
        )}
        {currentStep === 3 && userId && (
          <Step4Consent
            userId={userId}
            onSuccess={handleStep3Success}
            onPrevious={handlePrevious}
            initialValues={step4Values}
            onValuesChange={setStep4Values}
          />
        )}
        {currentStep === 4 && (
          <Step5Complete studentName={studentName || undefined} />
        )}
      </section>
    </div>
  );
}
