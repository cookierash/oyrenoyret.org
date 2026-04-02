'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/src/lib/utils';
import { DocumentEditor } from './document-editor';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

interface StudioEditorProps {
  mode: 'create' | 'edit';
  materialId?: string;
  initialSubjectId?: string;
  initialTopicId?: string;
  initialTitle?: string;
  initialObjectives?: string;
  initialContent?: string;
  initialDifficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  onSaved?: (newMaterialId?: string) => void;
}

export function StudioEditor({
  mode,
  materialId,
  initialSubjectId = '',
  initialTopicId = '',
  initialTitle = '',
  initialObjectives = '',
  initialContent = '',
  initialDifficulty = 'BASIC',
  initialStatus = 'DRAFT',
  onSaved,
}: StudioEditorProps) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(() => {
    const slots = (initialObjectives || '').split('\n').filter(Boolean);
    while (slots.length < 5) slots.push('');
    return slots.slice(0, 5);
  });
  const [savedObjectives, setSavedObjectives] = useState((initialObjectives || '').trim());
  const [content, setContent] = useState(initialContent || '<p></p>');
  const [savedContent, setSavedContent] = useState(initialContent || '<p></p>');
  const [difficulty, setDifficulty] = useState<'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>(initialDifficulty);
  const [savedDifficulty, setSavedDifficulty] = useState(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'DRAFT' | 'PUBLISHED'>(initialStatus);

  const isModified =
    title !== savedTitle ||
    content !== savedContent ||
    objectiveSlots.join('\n').trim() !== savedObjectives ||
    difficulty !== savedDifficulty;

  const isPublished = currentStatus === 'PUBLISHED';

  const topics = subjectId
    ? (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId] ?? []
    : [];

  const save = useCallback(async (andPublish = false, skipRedirect = false): Promise<string | undefined> => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }
    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');
    const trimmed = content.trim();
    const html = !trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>' ? '' : content;
    if (!html) {
      toast.error('Add some content before saving');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, topicId, title: title.trim(), objectives: finalObjectives || null, content: html }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create');
        }
        const created = await res.json();

        setSavedTitle(title);
        setSavedContent(content);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedDifficulty(difficulty);

        if (!andPublish && !skipRedirect) {
          toast.success('Draft saved');
          onSaved?.(created.id);
          if (created.id) router.push(`/studio/${created.id}`);
        }
        return created.id;
      } else if (materialId) {
        const res = await fetch(`/api/materials/${materialId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            objectives: finalObjectives || null,
            content: html,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save');
        }

        setSavedTitle(title);
        setSavedContent(content);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedDifficulty(difficulty);

        if (!andPublish && !skipRedirect) {
          toast.success('Saved');
        }
        router.refresh();
        onSaved?.();
        return materialId;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [mode, materialId, subjectId, topicId, title, objectiveSlots, content, difficulty, router, onSaved]);

  const publish = useCallback(async (confirmed = false) => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }

    if (!confirmed) {
      if (mode === 'edit' && materialId) {
        try {
          const res = await fetch(`/api/materials/${materialId}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const existing = (data.objectives ?? '')
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean);
            const nextSlots = existing.slice(0, 5);
            while (nextSlots.length < 5) nextSlots.push('');
            setObjectiveSlots(nextSlots);
          }
        } catch {
          /* ignore objective refresh */
        }
      }
      setShowPublishDialog(true);
      return;
    }

    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');
    if (objectiveSlots.filter(s => s.trim()).length < 2) {
      toast.error('Please provide at least 2 learning objectives to publish');
      return;
    }

    setShowPublishDialog(false);
    setPublishing(true);

    try {
      // Step 1: Save draft (and get ID if it's new)
      const currentId = await save(true, true);
      if (!currentId) return;

      const res = await fetch(`/api/materials/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED', difficulty, objectives: finalObjectives }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish');
      }

      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? ` +${Math.round(Number(data.creditsGranted))} credits`
          : '';
      toast.success(`Published! Your material is now visible in the catalog.${creditsMsg}`);

      setCurrentStatus('PUBLISHED');
      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }, [subjectId, topicId, title, objectiveSlots, mode, materialId, difficulty, save, router, onSaved]);

  const unpublish = useCallback(async () => {
    if (!materialId) return;
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to unpublish');
      toast.success('Material moved back to drafts.');
      setCurrentStatus('DRAFT');
      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setUnpublishing(false);
    }
  }, [materialId, router, onSaved]);

  const deleteMaterial = useCallback(async () => {
    if (!materialId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      toast.success('Material deleted.');
      setShowDeleteDialog(false);
      router.push('/studio');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }, [materialId, router]);

  return (
    <div className="flex flex-col h-full">
      <div className="card-frame bg-card p-6 space-y-4 mb-4 flex-shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 flex-1 max-w-xl">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Material title"
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-0.5">
            {mode === 'edit' && materialId ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting || publishing || unpublishing || saving}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
                {isPublished ? (
                  <Button
                    variant="secondary-primary"
                    onClick={unpublish}
                    disabled={deleting || publishing || unpublishing || saving}
                  >
                    {unpublishing ? 'Unpublishing...' : 'Unpublish'}
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="secondary-primary" onClick={() => save(false)} disabled={saving || publishing || unpublishing || deleting}>
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="primary"
              onClick={() => publish(false)}
              disabled={publishing || saving || unpublishing || deleting || (isPublished && !isModified)}
            >
              {publishing
                ? 'Publishing...'
                : mode === 'create'
                  ? 'Save & Publish'
                : isModified
                    ? 'Save & Publish'
                    : isPublished
                      ? 'Published'
                      : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              placeholder="Select subject"
              disabled={mode === 'edit'}
            >
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId || mode === 'edit'}
              placeholder="Select topic"
            >
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')}
              placeholder="Select difficulty"
            >
              <SelectItem value="BASIC">Basic</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="ADVANCED">Advanced</SelectItem>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[500px]">
        <DocumentEditor
          content={content}
          onChange={setContent}
          placeholder="Start writing your material..."
          editable
        />
      </div>

      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <div className="space-y-6">
            <header className="space-y-1">
              <AlertDialogTitle>
                Ready to publish?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Provide learning objectives to help learners understand what they will achieve. Please enter at least two objectives.
              </AlertDialogDescription>
            </header>
            <div className="space-y-4">
              <div className="space-y-2.5">
                {objectiveSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={slot}
                      onChange={(e) => {
                        const newSlots = [...objectiveSlots];
                        newSlots[idx] = e.target.value;
                        setObjectiveSlots(newSlots);
                      }}
                      placeholder={`Objective ${idx + 1}`}
                      className={cn(
                        "h-10 text-sm transition-all duration-200 flex-1 focus:border-primary/50"
                      )}
                      autoFocus={idx === 0}
                    />
                  </div>
                ))}
              </div>

            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPublishDialog(false)}
                disabled={publishing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  publish(true);
                }}
                disabled={publishing || (isPublished && !isModified) || objectiveSlots.filter(s => s.trim()).length < 2}
              >
                {publishing
                  ? 'Publishing...'
                  : isModified
                    ? 'Save & Publish'
                  : isPublished
                    ? 'Already Published'
                      : 'Publish'}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete material?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this material. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteMaterial}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
