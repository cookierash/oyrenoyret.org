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

const steps: TourStep[] = [
  {
    title: 'Welcome to oyrenoyret',
    description: 'Here is a quick tour to help you find lessons, track progress, and start learning.',
    highlights: [
      {
        title: 'Dashboard',
        description: 'Your daily focus, streaks, and progress in one place.',
        icon: LayoutDashboard,
      },
      {
        title: 'Catalog',
        description: 'Browse subjects and topics to discover new materials.',
        icon: BookOpen,
      },
      {
        title: 'Library',
        description: 'Everything you save or unlock lives here for easy revisit.',
        icon: Library,
      },
    ],
    cta: {
      label: 'Catalog',
      href: '/catalog',
    },
  },
  {
    title: 'Learn by doing',
    description: 'Study materials, join live sessions, and keep an eye on your achievements.',
    highlights: [
      {
        title: 'Live activities',
        description: 'Join sprints and events from the calendar.',
        icon: CalendarDays,
      },
      {
        title: 'Academic record',
        description: 'Certificates and milestones stay organized for you.',
        icon: GraduationCap,
      },
      {
        title: 'Create in Studio',
        description: 'Build and share your own learning materials.',
        icon: Sparkles,
      },
    ],
    cta: {
      label: 'Live activities',
      href: '/live-activities',
    },
  },
  {
    title: 'Learn with the community',
    description: 'Ask questions, help others, and earn credits for contributing.',
    highlights: [
      {
        title: 'Discussions',
        description: 'Post questions and learn from peer answers.',
        icon: MessageSquare,
      },
      {
        title: 'Recent Activities',
        description: 'Stay up to date with replies and updates.',
        icon: Receipt,
      },
      {
        title: 'Credits',
        description: 'Spend on materials or earn them by helping others.',
        icon: Sparkles,
      },
    ],
    cta: {
      label: 'Discussions',
      href: '/discussions',
    },
  },
];

export function WelcomeTour({ open, onComplete }: WelcomeTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

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
              <span>Quick tour</span>
              <span>
                Step {stepIndex + 1} of {totalSteps}
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
              Skip for now
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBack} disabled={stepIndex === 0}>
                Back
              </Button>
              <Button variant="primary" size="sm" onClick={handleNext}>
                {isLastStep ? 'Finish tour' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
