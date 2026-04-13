/**
 * New Document Editor
 *
 * Full-screen document editor for creating new materials.
 */

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StudioEditor } from '@/src/modules/materials/studio-editor';
import { Button } from '@/components/ui/button';
import { PiArrowLeft as ArrowLeft, PiFileText as FileText } from 'react-icons/pi';
import { useI18n } from '@/src/i18n/i18n-provider';

export default function NewDocumentPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const copy = messages.studio.newDocument;

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-background flex-shrink-0">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {copy.title}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/studio" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {copy.back}
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto px-4 pb-12 max-w-4xl mx-auto w-full">
        <StudioEditor
          mode="create"
          onSaved={() => router.push('/studio')}
        />
      </main>
    </div>
  );
}
