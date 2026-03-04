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
import { ArrowLeft } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </main>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Document not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/studio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Editing material</span>
      </header>
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
