'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  PiSquaresFour as LayoutDashboard,
  PiBookOpen as BookOpen,
  PiBooks as Library,
  PiCalendar as CalendarDays,
  PiGraduationCap as GraduationCap,
  PiChatCircle as MessageSquare,
  PiReceipt as Receipt,
  PiSparkle as Sparkles,
} from 'react-icons/pi';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/src/i18n/i18n-provider';

interface WelcomeTourProps {
  open: boolean;
  onComplete: () => void;
}

interface StepHighlight {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

interface TourStep {
  title: string;
  description: string;
  highlights: StepHighlight[];
  cta?: {
    label: string;
    href: string;
  };
}

export function WelcomeTour({ open, onComplete }: WelcomeTourProps) {
  const { t, messages } = useI18n();
  const copy = messages.welcomeTour;
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo<TourStep[]>(
    () => [
      {
        title: copy.steps.welcome.title,
        description: copy.steps.welcome.description,
        highlights: [
          {
            title: copy.steps.welcome.highlights.dashboard.title,
            description: copy.steps.welcome.highlights.dashboard.description,
            icon: LayoutDashboard,
          },
          {
            title: copy.steps.welcome.highlights.catalog.title,
            description: copy.steps.welcome.highlights.catalog.description,
            icon: BookOpen,
          },
          {
            title: copy.steps.welcome.highlights.library.title,
            description: copy.steps.welcome.highlights.library.description,
            icon: Library,
          },
        ],
      },
      {
        title: copy.steps.practice.title,
        description: copy.steps.practice.description,
        highlights: [
          {
            title: copy.steps.practice.highlights.liveActivities.title,
            description: copy.steps.practice.highlights.liveActivities.description,
            icon: CalendarDays,
          },
          {
            title: copy.steps.practice.highlights.academicRecord.title,
            description: copy.steps.practice.highlights.academicRecord.description,
            icon: GraduationCap,
          },
          {
            title: copy.steps.practice.highlights.studio.title,
            description: copy.steps.practice.highlights.studio.description,
            icon: Sparkles,
          },
        ],
      },
      {
        title: copy.steps.community.title,
        description: copy.steps.community.description,
        highlights: [
          {
            title: copy.steps.community.highlights.discussions.title,
            description: copy.steps.community.highlights.discussions.description,
            icon: MessageSquare,
          },
          {
            title: copy.steps.community.highlights.recentActivities.title,
            description: copy.steps.community.highlights.recentActivities.description,
            icon: Receipt,
          },
          {
            title: copy.steps.community.highlights.credits.title,
            description: copy.steps.community.highlights.credits.description,
            icon: Sparkles,
          },
        ],
      },
    ],
    [copy],
  );

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const totalSteps = steps.length;
  const step = steps[stepIndex];
  const isLastStep = stepIndex === totalSteps - 1;
  const progressValue = useMemo(() => stepIndex + 1, [stepIndex]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onComplete();
        }
      }}
    >
      <AlertDialogContent className="max-w-2xl px-6 pb-6 pt-7">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground tracking-normal">
              <span>{copy.headerLabel}</span>
              <span>
                {t('welcomeTour.stepLabel', {
                  current: stepIndex + 1,
                  total: totalSteps,
                })}
              </span>
            </div>
            <Progress value={progressValue} max={totalSteps} />
          </div>

          <AlertDialogHeader className="space-y-2 mb-4">
            <AlertDialogTitle className="text-2xl tracking-normal">
              {step.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {step.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            {step.highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>

          {step.cta ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="secondary-primary" size="sm">
                <Link href={step.cta.href}>{step.cta.label}</Link>
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="self-end sm:self-auto"
            >
              {copy.skip}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBack} disabled={stepIndex === 0}>
                {copy.back}
              </Button>
              <Button variant="primary" size="sm" onClick={handleNext}>
                {isLastStep ? copy.finish : copy.next}
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
