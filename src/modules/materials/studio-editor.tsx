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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
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
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(() => {
    const slots = (initialObjectives || '').split('\n').filter(Boolean);
    while (slots.length < 5) slots.push('');
    return slots.slice(0, 5);
  });
  const [content, setContent] = useState(initialContent || '<p></p>');
  const [difficulty, setDifficulty] = useState<'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const isModified =
    title !== initialTitle ||
    content !== initialContent ||
    objectiveSlots.join('\n').trim() !== (initialObjectives || '').trim() ||
    difficulty !== initialDifficulty;

  const isPublished = initialStatus === 'PUBLISHED';

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
  }, [mode, materialId, subjectId, topicId, title, objectiveSlots, content, router, onSaved]);

  const publish = useCallback(async (confirmed = false) => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }

    if (!confirmed) {
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
          ? ` +${Number(data.creditsGranted).toFixed(2)} credits`
          : '';
      toast.success(`Published! Your material is now visible in the catalog.${creditsMsg}`);

      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }, [subjectId, topicId, title, objectiveSlots, mode, materialId, difficulty, save, router, onSaved]);

  return (
    <div className="flex flex-col h-full">
      <div className="rounded-lg border border-border bg-card p-6 space-y-4 mb-4 flex-shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 flex-1 max-w-xl">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Material title"
            />
          </div>
          <div className="flex gap-2 mb-0.5">
            <Button variant="secondary-primary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="primary"
              onClick={() => publish(false)}
              disabled={publishing || saving || (isPublished && !isModified)}
            >
              {publishing ? 'Yoxlanılır: Uyğunluq, Məqsədlər və Moderasiya...' : (isPublished && isModified) ? 'Publish Changes' : isPublished ? 'Published' : mode === 'create' ? 'Save & Publish' : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <AlertDialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-background p-6 pt-8 space-y-6">
            <header className="space-y-1">
              <AlertDialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
                Ready to publish?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                Provide learning objectives to help learners understand what they will achieve.
              </AlertDialogDescription>
            </header>
            <div className="space-y-4">
              <div className="space-y-2.5">
                {objectiveSlots.map((slot, idx) => (
                  <div key={idx} className="group relative">
                    <Input
                      value={slot}
                      onChange={(e) => {
                        const newSlots = [...objectiveSlots];
                        newSlots[idx] = e.target.value;
                        setObjectiveSlots(newSlots);
                      }}
                      placeholder={idx < 2 ? `Objective ${idx + 1} (required)` : `Objective ${idx + 1} (optional)`}
                      className={cn(
                        "h-10 text-sm transition-all duration-200",
                        idx < 2 && !slot.trim()
                          ? "border-primary/20 bg-primary/[0.02] focus:bg-background focus:border-primary"
                          : "focus:border-primary/50"
                      )}
                      autoFocus={idx === 0}
                    />
                    {idx < 2 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity group-focus-within:opacity-40">
                        <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Req</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 mb-2">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Difficulty Level</label>
                <Select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')}
                >
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  publish(true);
                }}
                disabled={publishing || (isPublished && !isModified) || objectiveSlots.filter(s => s.trim()).length < 2}
                className="w-full h-11 text-sm font-medium"
              >
                {publishing ? 'Publishing...' : (isPublished && isModified) ? 'Publish Changes' : isPublished ? 'Already Published' : 'Save & Publish'}
              </AlertDialogAction>

              <AlertDialogCancel
                disabled={publishing}
                className="w-full h-11 text-sm font-medium"
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
