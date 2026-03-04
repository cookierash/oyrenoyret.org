'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/src/lib/utils';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface PracticeQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer';
  question: string;
  options?: { id: string; text: string }[];
}

interface PracticeTestEditorProps {
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

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export function PracticeTestEditor({
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
}: PracticeTestEditorProps) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [title, setTitle] = useState(initialTitle);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(() => {
    const slots = (initialObjectives || '').split('\n').filter(Boolean);
    while (slots.length < 5) slots.push('');
    return slots.slice(0, 5);
  });
  const [difficulty, setDifficulty] = useState<'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>(initialDifficulty);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(() => {
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        return Array.isArray(parsed.questions) ? parsed.questions : [];
      } catch (e) {
        console.error('Failed to parse initial practice test content:', e);
        return [];
      }
    }
    return [];
  });

  const hasChanges =
    title !== initialTitle ||
    difficulty !== initialDifficulty ||
    objectiveSlots.join('\n').trim() !== (initialObjectives || '').trim() ||
    JSON.stringify(questions) !== (initialContent ? JSON.stringify(JSON.parse(initialContent).questions) : '[]');

  const isPublished = initialStatus === 'PUBLISHED';
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const topics = subjectId
    ? (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId] ?? []
    : [];

  const addQuestion = useCallback(() => {
    setQuestions((q) => [
      ...q,
      { id: generateId(), type: 'multiple_choice', question: '', options: [{ id: generateId(), text: '' }] },
    ]);
  }, []);

  const updateQuestion = useCallback((id: string, updates: Partial<PracticeQuestion>) => {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...updates } : x)));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((q) => q.filter((x) => x.id !== id));
  }, []);

  const addOption = useCallback((questionId: string) => {
    setQuestions((q) =>
      q.map((x) =>
        x.id === questionId
          ? { ...x, options: [...(x.options ?? []), { id: generateId(), text: '' }] }
          : x
      )
    );
  }, []);

  const updateOption = useCallback((questionId: string, optionId: string, text: string) => {
    setQuestions((q) =>
      q.map((x) =>
        x.id === questionId
          ? { ...x, options: (x.options ?? []).map((o) => (o.id === optionId ? { ...o, text } : o)) }
          : x
      )
    );
  }, []);

  const removeOption = useCallback((questionId: string, optionId: string) => {
    setQuestions((q) =>
      q.map((x) =>
        x.id === questionId
          ? { ...x, options: (x.options ?? []).filter((o) => o.id !== optionId) }
          : x
      )
    );
  }, []);

  const save = useCallback(async (andPublish = false, skipRedirect = false): Promise<string | undefined> => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }
    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');

    const validQuestions = questions.filter((q) => q.question.trim());
    if (validQuestions.length === 0) {
      toast.error('Add at least one question');
      return;
    }

    const content = JSON.stringify({ questions: validQuestions });

    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId,
            topicId,
            title: title.trim(),
            objectives: finalObjectives || null,
            content,
            materialType: 'PRACTICE_TEST',
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create');
        }
        const created = await res.json();

        if (!andPublish && !skipRedirect) {
          toast.success('Practice test saved');
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
            content,
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
  }, [mode, materialId, subjectId, topicId, title, objectiveSlots, difficulty, questions, router, onSaved]);

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
      toast.success(`Published! Your practice test is now visible in the catalog.${creditsMsg}`);

      router.refresh();
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }, [subjectId, topicId, title, objectiveSlots, mode, materialId, difficulty, save, router, onSaved]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 flex-1 max-w-xl">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Practice test title"
            />
          </div>
          <div className="flex gap-2 mb-0.5">
            <Button variant="secondary-primary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="primary"
              onClick={() => publish(false)}
              disabled={publishing || saving || (isPublished && !hasChanges)}
            >
              {publishing ? 'Yoxlanılır: Uyğunluq, Məqsədlər və Moderasiya...' : (isPublished && hasChanges) ? 'Publish Changes' : isPublished ? 'Published' : mode === 'create' ? 'Save & Publish' : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions</h2>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            Add question
          </Button>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-muted-foreground pt-2">{i + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                    placeholder="Question"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={q.type}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          type: e.target.value as 'multiple_choice' | 'short_answer',
                          options: e.target.value === 'multiple_choice' ? [{ id: generateId(), text: '' }] : undefined,
                        })
                      }
                    >
                      <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                      <SelectItem value="short_answer">Short answer</SelectItem>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      {q.options?.map((opt) => (
                        <div key={opt.id} className="flex gap-2">
                          <input type="radio" disabled className="mt-2" />
                          <Input
                            value={opt.text}
                            onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                            placeholder="Option"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeOption(q.id, opt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addOption(q.id)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add option
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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
                disabled={publishing || (isPublished && !hasChanges) || objectiveSlots.filter(s => s.trim()).length < 2}
                className="w-full h-11 text-sm font-medium"
              >
                {publishing ? 'Publishing...' : (isPublished && hasChanges) ? 'Publish Changes' : isPublished ? 'Already Published' : 'Save & Publish'}
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
