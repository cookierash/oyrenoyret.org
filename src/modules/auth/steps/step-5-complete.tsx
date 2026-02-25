/**
 * Step 5: Registration Completed
 * 
 * Confirmation screen shown after successful registration.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Step5Props {
  studentName?: string;
}

export function Step5Complete({ studentName }: Step5Props) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card className="border border-primary/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
          <CardDescription className="text-base">
            {studentName ? `Welcome, ${studentName}!` : 'Welcome!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground">
              Your account has been successfully created and activated. You are now logged in and ready to start using the platform.
            </p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What's next?</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Explore the learning platform</li>
              <li>Start your educational journey</li>
              <li>Access your dashboard</li>
            </ul>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              router.push('/dashboard');
              router.refresh();
            }}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
