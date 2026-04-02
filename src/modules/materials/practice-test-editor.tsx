'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/src/lib/utils';
import { SUBJECTS } from '@/src/config/constants';
import { CREDITS_MATERIAL } from '@/src/config/credits';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { toast } from 'sonner';
import { PiTextB as Bold, PiTextItalic as Italic, PiTextUnderline as UnderlineIcon, PiTextAa as SubscriptIcon, PiTextH as SuperscriptIcon, PiCode as Code, PiEraser as Eraser, PiFunction as Sigma, PiPlus as Plus, PiTrash as Trash2 } from 'react-icons/pi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

export interface PracticeQuestion {
  id: string;
  type: 'multiple_choice';
  question: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
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

function ensureOptions(options?: { id: string; text: string }[]) {
  const next = (options ?? []).slice(0, 5);
  while (next.length < 3) next.push({ id: generateId(), text: '' });
  return next;
}

function parseInitialQuestions(initialContent?: string) {
  if (!initialContent) return [];
  try {
    const parsed = JSON.parse(initialContent);
    if (!Array.isArray(parsed.questions)) return [];
    return parsed.questions.map((q: PracticeQuestion) => {
      const options = ensureOptions(q.options);
      const correctOptionId = options.some((o) => o.id === q.correctOptionId)
        ? q.correctOptionId
        : options[0]?.id;
      return {
        ...q,
        type: 'multiple_choice',
        options,
        correctOptionId,
      };
    });
  } catch (e) {
    console.error('Failed to parse initial practice test content:', e);
    return [];
  }
}

const SCIENCE_SYMBOLS = [
  { value: '±', label: 'Plus/minus' },
  { value: '×', label: 'Multiplication' },
  { value: '÷', label: 'Division' },
  { value: '≈', label: 'Approximately equal' },
  { value: '≤', label: 'Less than or equal' },
  { value: '≥', label: 'Greater than or equal' },
  { value: '°', label: 'Degrees' },
  { value: 'µ', label: 'Micro' },
  { value: 'Ω', label: 'Omega' },
  { value: 'Δ', label: 'Delta' },
  { value: 'π', label: 'Pi' },
  { value: '∞', label: 'Infinity' },
  { value: '√', label: 'Square root' },
  { value: '²', label: 'Squared' },
  { value: '³', label: 'Cubed' },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasText(html: string): boolean {
  return stripHtml(html).length > 0;
}

function validateQuestions(
  questions: PracticeQuestion[],
  enforceComplete: boolean
): { ok: boolean; error?: string; normalized?: PracticeQuestion[] } {
  if (questions.length === 0) {
    return { ok: false, error: 'Add at least one question.' };
  }

  const normalized: PracticeQuestion[] = [];

  for (const q of questions) {
    const questionHasText = hasText(q.question);
    const options = (q.options ?? []).slice(0, 5);
    const filledOptions = options.filter((o) => hasText(o.text));
    const hasAnyOptionText = filledOptions.length > 0;

    if (!questionHasText && !hasAnyOptionText) {
      if (enforceComplete) {
        return { ok: false, error: 'Remove or complete empty questions before publishing.' };
      }
      normalized.push({ ...q, options });
      continue;
    }

    if (!questionHasText) {
      if (enforceComplete) {
        return { ok: false, error: 'Each question needs a prompt.' };
      }
      normalized.push({ ...q, options });
      continue;
    }

    if (options.length < 3 || options.length > 5) {
      return { ok: false, error: 'Each question must have 3 to 5 options.' };
    }

    if (!q.correctOptionId || !options.some((o) => o.id === q.correctOptionId)) {
      return { ok: false, error: 'Select the correct option for each question.' };
    }

    if (enforceComplete) {
      if (filledOptions.length < 3) {
        return { ok: false, error: 'Each question needs at least 3 filled options.' };
      }
      const correctOption = options.find((o) => o.id === q.correctOptionId);
      if (correctOption && !hasText(correctOption.text)) {
        return { ok: false, error: 'The correct option cannot be empty.' };
      }
    }

    normalized.push({
      ...q,
      options: enforceComplete ? filledOptions : options,
    });
  }

  const hasUsableQuestion = normalized.some((q) => hasText(q.question));
  if (!hasUsableQuestion) {
    return { ok: false, error: 'Add at least one question.' };
  }

  return { ok: true, normalized };
}

interface RichTextFieldProps {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  ariaLabel: string;
  minHeightClass?: string;
  toolbarVisibility?: 'always' | 'focus' | 'none';
}

function RichTextField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minHeightClass = 'min-h-[44px]',
  toolbarVisibility = 'always',
}: RichTextFieldProps) {
  const [showSymbols, setShowSymbols] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!showSymbols) return;
    const close = () => setShowSymbols(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [showSymbols]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      SubscriptExtension,
      SuperscriptExtension,
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: cn(
          'document-editor-content practice-test-editor-content text-sm leading-relaxed focus:outline-none px-3 py-2',
          minHeightClass
        ),
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>');
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => onChange(editor.getHTML());
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    editor.on('focus', onFocus);
    editor.on('blur', onBlur);
    return () => {
      editor.off('focus', onFocus);
      editor.off('blur', onBlur);
    };
  }, [editor]);

  const showToolbar =
    toolbarVisibility === 'always' || (toolbarVisibility === 'focus' && isFocused);

  const clearFormatting = useCallback(() => {
    editor?.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  const insertSymbol = useCallback(
    (symbol: string) => {
      editor?.chain().focus().insertContent(symbol).run();
      setShowSymbols(false);
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="space-y-1.5">
      {toolbarVisibility !== 'none' && showToolbar ? (
        <div
          className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleBold().run()}
            data-active={editor.isActive('bold')}
            aria-label="Bold"
            aria-pressed={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            data-active={editor.isActive('italic')}
            aria-label="Italic"
            aria-pressed={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            data-active={editor.isActive('underline')}
            aria-label="Underline"
            aria-pressed={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>
          <span className="w-px h-4 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            data-active={editor.isActive('subscript')}
            aria-label="Subscript"
            aria-pressed={editor.isActive('subscript')}
            title="Subscript"
          >
            <SubscriptIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            data-active={editor.isActive('superscript')}
            aria-label="Superscript"
            aria-pressed={editor.isActive('superscript')}
            title="Superscript"
          >
            <SuperscriptIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => editor.chain().focus().toggleCode().run()}
            data-active={editor.isActive('code')}
            aria-label="Inline code"
            aria-pressed={editor.isActive('code')}
            title="Inline code"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearFormatting}
            aria-label="Clear formatting"
            title="Clear formatting"
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setShowSymbols((s) => !s);
              }}
              aria-label="Insert symbol"
              aria-haspopup="menu"
              aria-expanded={showSymbols}
              title="Insert symbol"
            >
              <Sigma className="h-3.5 w-3.5" />
            </Button>
            {showSymbols ? (
              <div className="absolute left-0 top-full mt-1.5 grid grid-cols-5 gap-2 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg z-50 min-w-[220px]">
                {SCIENCE_SYMBOLS.map((symbol) => (
                  <button
                    key={symbol.value}
                    type="button"
                    className="h-8 w-8 rounded-sm border border-border text-base leading-none transition-colors hover:bg-muted flex items-center justify-center"
                    onClick={() => insertSymbol(symbol.value)}
                    aria-label={symbol.label}
                    title={symbol.label}
                  >
                    {symbol.value}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={cn(
        'rounded-md border border-border bg-background transition-shadow',
        isFocused ? 'ring-2 ring-primary/15 border-primary/40' : 'focus-within:ring-2 focus-within:ring-primary/10'
      )}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
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
  const initialQuestions = parseInitialQuestions(initialContent);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(initialQuestions);
  const [draftId, setDraftId] = useState<string | undefined>(materialId);

  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedDifficulty, setSavedDifficulty] = useState(initialDifficulty);
  const [savedObjectives, setSavedObjectives] = useState((initialObjectives || '').trim());
  const [savedQuestionsJson, setSavedQuestionsJson] = useState(JSON.stringify(initialQuestions));

  const hasChanges =
    title !== savedTitle ||
    difficulty !== savedDifficulty ||
    objectiveSlots.join('\n').trim() !== savedObjectives ||
    JSON.stringify(questions) !== savedQuestionsJson;

  const [currentStatus, setCurrentStatus] = useState<'DRAFT' | 'PUBLISHED'>(initialStatus);
  const isPublished = currentStatus === 'PUBLISHED';
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [questionToRemove, setQuestionToRemove] = useState<{
    id: string;
    index: number;
  } | null>(null);

  const topics = subjectId
    ? (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId] ?? []
    : [];

  const addQuestion = useCallback(() => {
    const options = ensureOptions();
    setQuestions((q) => [
      ...q,
      { id: generateId(), type: 'multiple_choice', question: '', options, correctOptionId: options[0]?.id },
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
          ? (() => {
              const current = x.options ?? [];
              if (current.length >= 5) return x;
              const nextOptions = [...current, { id: generateId(), text: '' }];
              return {
                ...x,
                options: nextOptions,
                correctOptionId: x.correctOptionId ?? nextOptions[0]?.id,
              };
            })()
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
          ? (() => {
              const current = x.options ?? [];
              if (current.length <= 3) return x;
              const nextOptions = current.filter((o) => o.id !== optionId);
              const nextCorrect =
                x.correctOptionId && nextOptions.some((o) => o.id === x.correctOptionId)
                  ? x.correctOptionId
                  : nextOptions[0]?.id;
              return { ...x, options: nextOptions, correctOptionId: nextCorrect };
            })()
          : x
      )
    );
  }, []);

  const save = useCallback(async (
    andPublish = false,
    skipRedirect = false,
    strict = false
  ): Promise<string | undefined> => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }
    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');

    const enforceComplete = strict || andPublish;
    const validation = validateQuestions(questions, enforceComplete);
    if (!validation.ok || !validation.normalized) {
      toast.error(validation.error ?? 'Please complete the questions.');
      return;
    }

    const content = JSON.stringify({ questions: validation.normalized });

    setSaving(true);
    try {
      const targetId = mode === 'create' ? draftId : materialId;
      if (mode === 'create' && !draftId) {
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

        setDraftId(created.id);
        setSavedTitle(title);
        setSavedDifficulty(difficulty);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedQuestionsJson(JSON.stringify(questions));

        if (!andPublish && !skipRedirect) {
          toast.success('Practice test saved');
          onSaved?.(created.id);
          if (created.id) router.push(`/studio/${created.id}`);
        }
        return created.id;
      } else if (targetId) {
        const res = await fetch(`/api/materials/${targetId}`, {
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

        setSavedTitle(title);
        setSavedDifficulty(difficulty);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedQuestionsJson(JSON.stringify(questions));

        if (!andPublish && !skipRedirect) {
          toast.success('Saved');
          if (mode === 'create') {
            router.push(`/studio/${targetId}`);
          }
        }
        router.refresh();
        onSaved?.(targetId);
        return targetId;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [mode, materialId, draftId, subjectId, topicId, title, objectiveSlots, difficulty, questions, router, onSaved]);

  const publish = useCallback(async (confirmed = false) => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }

    const publishCheck = validateQuestions(questions, true);
    if (!publishCheck.ok) {
      toast.error(publishCheck.error ?? 'Please complete the questions before publishing.');
      return;
    }
    if ((publishCheck.normalized?.length ?? 0) < CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS) {
      toast.error(`Practice tests must include at least ${CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS} questions to publish`);
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
      const currentId = await save(true, true, true);
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
      toast.success(`Published! Your practice test is now visible in the catalog.${creditsMsg}`);

      setCurrentStatus('PUBLISHED');
      router.refresh();
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }, [subjectId, topicId, title, objectiveSlots, mode, materialId, difficulty, questions, save, router, onSaved]);

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
      <div className="card-frame bg-card p-6 space-y-5 mb-4 flex-shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Test setup</h2>
            <p className="text-xs text-muted-foreground">
              Title, subject, and difficulty appear in the catalog and search.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              disabled={publishing || saving || unpublishing || deleting || (isPublished && !hasChanges)}
            >
              {publishing
                ? 'Publishing...'
                : mode === 'create'
                  ? 'Save & Publish'
                : hasChanges
                    ? 'Save & Publish'
                    : isPublished
                      ? 'Published'
                      : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Practice test title"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Select
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}
                placeholder="Select subject"
                disabled={mode === 'edit' || Boolean(draftId)}
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
                disabled={!subjectId || mode === 'edit' || Boolean(draftId)}
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
      </div>

      <div className="flex-1 min-h-[500px] space-y-6 pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="text-xs text-muted-foreground">
              Use the toolbar to add subscripts, superscripts, and science symbols.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            Add question
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-6 py-10 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No questions yet</p>
              <p className="text-xs text-muted-foreground">
                Add your first question to start building the test.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={addQuestion}>
              Add your first question
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div key={q.id} className="card-frame bg-card p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Question {i + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Write the prompt and select the correct answer.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setQuestionToRemove({ id: q.id, index: i })}
                    aria-label={`Remove question ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Prompt</label>
                  <RichTextField
                    value={q.question}
                    onChange={(html) => updateQuestion(q.id, { question: html })}
                    placeholder="Write the question prompt..."
                    ariaLabel={`Question ${i + 1} prompt`}
                    minHeightClass="min-h-[88px]"
                    toolbarVisibility="always"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Answer choices</legend>
                  <p id={`correct-help-${q.id}`} className="text-xs text-muted-foreground">
                    Select the correct answer. You can include scientific notation in each option.
                  </p>
                  <div className="space-y-3">
                    {q.options?.map((opt, optionIndex) => {
                      const optionLabel = String.fromCharCode(65 + optionIndex);
                      return (
                        <div
                          key={opt.id}
                          className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-start sm:gap-3"
                        >
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              className="h-4 w-4 accent-primary"
                              checked={q.correctOptionId === opt.id}
                              onChange={() => updateQuestion(q.id, { correctOptionId: opt.id })}
                              aria-label={`Mark option ${optionLabel} as correct`}
                              aria-describedby={`correct-help-${q.id}`}
                            />
                            <span className="text-xs font-semibold text-muted-foreground w-6">
                              {optionLabel}
                            </span>
                          </div>
                          <div className="flex-1">
                            <RichTextField
                              value={opt.text}
                              onChange={(html) => updateOption(q.id, opt.id, html)}
                              placeholder={`Option ${optionLabel}`}
                              ariaLabel={`Option ${optionLabel} for question ${i + 1}`}
                              minHeightClass="min-h-[44px]"
                              toolbarVisibility="focus"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeOption(q.id, opt.id)}
                            disabled={(q.options?.length ?? 0) <= 3}
                            aria-label={`Remove option ${optionLabel}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addOption(q.id)}
                    disabled={(q.options?.length ?? 0) >= 5}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add option
                  </Button>
                </fieldset>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center pb-8">
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            Add another question
          </Button>
        </div>
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
                disabled={publishing || (isPublished && !hasChanges) || objectiveSlots.filter(s => s.trim()).length < 2}
              >
                {publishing
                  ? 'Publishing...'
                  : hasChanges
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

      <AlertDialog
        open={Boolean(questionToRemove)}
        onOpenChange={(open) => {
          if (!open) setQuestionToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the selected question and its options.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel onClick={() => setQuestionToRemove(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (questionToRemove) {
                  removeQuestion(questionToRemove.id);
                  setQuestionToRemove(null);
                }
              }}
            >
              Remove question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
