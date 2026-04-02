/**
 * Step 5: Registration Completed
 * 
 * Confirmation screen shown after successful registration.
 */

'use client';

import { Button } from '@/components/ui/button';
import { PiCheckCircle as CheckCircle2 } from 'react-icons/pi';
import { useRouter } from 'next/navigation';

interface Step5Props {
  studentName?: string;
}

export function Step5Complete({ studentName }: Step5Props) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Registration complete
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {studentName ? `Welcome, ${studentName}!` : 'Welcome!'}
          </h2>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Your account is active and ready. You can now explore lessons, track
        progress, and join activities.
      </p>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="text-xs font-medium text-muted-foreground">
          What&apos;s next
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span>Explore the learning platform</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span>Start your educational journey</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span>Access your personalized dashboard</span>
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          router.push('/dashboard');
          router.refresh();
        }}
        className="h-10 w-full text-sm font-semibold"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
