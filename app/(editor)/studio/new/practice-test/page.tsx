/**
 * New Practice Test
 *
 * Full-screen Google Forms-like editor for creating practice tests.
 */

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PracticeTestEditor } from '@/src/modules/materials/practice-test-editor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export default function NewPracticeTestPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-background flex-shrink-0">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Studio
            </div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                New practice test
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Build multiple-choice questions with 3-5 options and mark the correct answer. Add objectives when you publish.
            </p>
          </div>
          <Button variant="secondary-primary" size="sm" asChild>
            <Link href="/studio">
              <ArrowLeft className="h-4 w-4" />
              Back to studio
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto px-4 py-6 max-w-4xl mx-auto w-full">
        <PracticeTestEditor
          mode="create"
          onSaved={() => router.push('/studio')}
        />
      </main>
    </div>
  );
}
