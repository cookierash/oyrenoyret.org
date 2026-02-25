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
import { ArrowLeft } from 'lucide-react';

export default function NewPracticeTestPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/studio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">New practice test</span>
      </header>
      <main className="flex-1 overflow-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <PracticeTestEditor
          mode="create"
          onSaved={() => router.push('/studio')}
        />
      </main>
    </div>
  );
}
