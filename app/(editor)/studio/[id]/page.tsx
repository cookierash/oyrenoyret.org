/**
 * Edit Document Editor
 *
 * Full-screen document editor for editing existing materials.
 */

'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StudioEditor } from '@/src/modules/materials/studio-editor';
import { PracticeTestEditor } from '@/src/modules/materials/practice-test-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, ClipboardList } from 'lucide-react';

export default function EditMaterialPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [material, setMaterial] = useState<{
    id: string;
    subjectId: string;
    topicId: string;
    title: string;
    objectives?: string | null;
    content: string;
    materialType?: string;
    difficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
    status?: 'DRAFT' | 'PUBLISHED';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/materials/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((m) =>
        setMaterial({
          id: m.id,
          subjectId: m.subjectId,
          topicId: m.topicId,
          title: m.title,
          objectives: m.objectives ?? '',
          content: m.materialType === 'PRACTICE_TEST' ? (m.content || '{"questions":[]}') : (m.content || '<p></p>'),
          materialType: m.materialType,
          status: m.status,
          difficulty: m.difficulty ?? 'BASIC',
        })
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const isPracticeTest = material?.materialType === 'PRACTICE_TEST';
  const HeaderIcon = isPracticeTest ? ClipboardList : FileText;
  const headerTitle = isPracticeTest ? 'Edit practice test' : 'Edit textual material';
  const headerDescription = isPracticeTest
    ? 'Update questions, difficulty, and objectives. Publish changes when ready.'
    : 'Refine your lesson content, structure, and objectives, then publish updates.';

  const renderHeader = (title: string, description: string) => (
    <header className="border-b border-border bg-background flex-shrink-0">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Studio
          </div>
          <div className="flex items-center gap-2">
            <HeaderIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {description}
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
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="border-b border-border bg-background flex-shrink-0">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-48 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="flex flex-col h-full">
        {renderHeader('Material not found', 'Return to the studio to view your materials.')}
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Document not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {renderHeader(headerTitle, headerDescription)}
      <main className="flex-1 overflow-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {material.materialType === 'PRACTICE_TEST' ? (
          <PracticeTestEditor
            mode="edit"
            materialId={material.id}
            initialSubjectId={material.subjectId}
            initialTopicId={material.topicId}
            initialTitle={material.title}
            initialObjectives={material.objectives ?? ''}
            initialContent={material.content}
            initialDifficulty={material.difficulty}
            initialStatus={material.status}
            onSaved={() => router.refresh()}
          />
        ) : (
          <StudioEditor
            mode="edit"
            materialId={material.id}
            initialSubjectId={material.subjectId}
            initialTopicId={material.topicId}
            initialTitle={material.title}
            initialObjectives={material.objectives ?? ''}
            initialContent={material.content}
            initialDifficulty={material.difficulty}
            initialStatus={material.status}
            onSaved={() => router.refresh()}
          />
        )}
      </main>
    </div>
  );
}
