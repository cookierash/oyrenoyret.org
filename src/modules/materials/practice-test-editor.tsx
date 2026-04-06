'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { CREDITS_MATERIAL } from '@/src/config/credits';
import { toast } from 'sonner';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { PiTextB as Bold, PiTextItalic as Italic, PiTextUnderline as UnderlineIcon, PiTextAa as SubscriptIcon, PiTextH as SuperscriptIcon, PiCode as Code, PiEraser as Eraser, PiFunction as Sigma, PiPlus as Plus, PiTrash as Trash2 } from 'react-icons/pi';
import { useI18n } from '@/src/i18n/i18n-provider';
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';
import { getLocalizedTopics } from '@/src/i18n/topic-utils';
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
  { value: '±', key: 'plusMinus' },
  { value: '×', key: 'multiplication' },
  { value: '÷', key: 'division' },
  { value: '≈', key: 'approximately' },
  { value: '≤', key: 'lessEqual' },
  { value: '≥', key: 'greaterEqual' },
  { value: '°', key: 'degrees' },
  { value: 'µ', key: 'micro' },
  { value: 'Ω', key: 'omega' },
  { value: 'Δ', key: 'delta' },
  { value: 'π', key: 'pi' },
  { value: '∞', key: 'infinity' },
  { value: '√', key: 'sqrt' },
  { value: '²', key: 'squared' },
  { value: '³', key: 'cubed' },
] as const;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasText(html: string): boolean {
  return stripHtml(html).length > 0;
}

interface PracticeValidationCopy {
  addQuestion: string;
  removeEmpty: string;
  questionPrompt: string;
  optionCount: string;
  selectCorrect: string;
  minOptions: string;
  correctNotEmpty: string;
}

function validateQuestions(
  questions: PracticeQuestion[],
  enforceComplete: boolean,
  copy: PracticeValidationCopy,
): { ok: boolean; error?: string; normalized?: PracticeQuestion[] } {
  if (questions.length === 0) {
    return { ok: false, error: copy.addQuestion };
  }

  const normalized: PracticeQuestion[] = [];

  for (const q of questions) {
    const questionHasText = hasText(q.question);
    const options = (q.options ?? []).slice(0, 5);
    const filledOptions = options.filter((o) => hasText(o.text));
    const hasAnyOptionText = filledOptions.length > 0;

    if (!questionHasText && !hasAnyOptionText) {
      if (enforceComplete) {
        return { ok: false, error: copy.removeEmpty };
      }
      normalized.push({ ...q, options });
      continue;
    }

    if (!questionHasText) {
      if (enforceComplete) {
        return { ok: false, error: copy.questionPrompt };
      }
      normalized.push({ ...q, options });
      continue;
    }

    if (options.length < 3 || options.length > 5) {
      return { ok: false, error: copy.optionCount };
    }

    if (!q.correctOptionId || !options.some((o) => o.id === q.correctOptionId)) {
      return { ok: false, error: copy.selectCorrect };
    }

    if (enforceComplete) {
      if (filledOptions.length < 3) {
        return { ok: false, error: copy.minOptions };
      }
      const correctOption = options.find((o) => o.id === q.correctOptionId);
      if (correctOption && !hasText(correctOption.text)) {
        return { ok: false, error: copy.correctNotEmpty };
      }
    }

    normalized.push({
      ...q,
      options: enforceComplete ? filledOptions : options,
    });
  }

  const hasUsableQuestion = normalized.some((q) => hasText(q.question));
  if (!hasUsableQuestion) {
    return { ok: false, error: copy.addQuestion };
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
  const { messages } = useI18n();
  const toolbar = messages.editor.toolbar;
  const symbolsCopy = messages.studio.practice.symbols;
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
            aria-label={toolbar.bold}
            aria-pressed={editor.isActive('bold')}
            title={toolbar.bold}
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
            aria-label={toolbar.italic}
            aria-pressed={editor.isActive('italic')}
            title={toolbar.italic}
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
            aria-label={toolbar.underline}
            aria-pressed={editor.isActive('underline')}
            title={toolbar.underline}
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
            aria-label={toolbar.subscript}
            aria-pressed={editor.isActive('subscript')}
            title={toolbar.subscript}
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
            aria-label={toolbar.superscript}
            aria-pressed={editor.isActive('superscript')}
            title={toolbar.superscript}
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
            aria-label={toolbar.inlineCode}
            aria-pressed={editor.isActive('code')}
            title={toolbar.inlineCode}
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearFormatting}
            aria-label={toolbar.clearFormatting}
            title={toolbar.clearFormatting}
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
              aria-label={toolbar.insertSymbol}
              aria-haspopup="menu"
              aria-expanded={showSymbols}
              title={toolbar.insertSymbol}
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
                    aria-label={symbolsCopy[symbol.key]}
                    title={symbolsCopy[symbol.key]}
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
  const { messages, t } = useI18n();
  const practiceCopy = messages.studio.practice;
  const editorCopy = messages.studio.editor;
  const subjects = useMemo(() => getLocalizedSubjects(messages), [messages]);
  const difficultyCopy = messages.materials.difficulty;
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

  const topics = subjectId ? getLocalizedTopics(messages, subjectId) : [];

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
      toast.error(practiceCopy.toast.requiredFields);
      return;
    }
    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');

    const enforceComplete = strict || andPublish;
    const validation = validateQuestions(questions, enforceComplete, practiceCopy.validation);
    if (!validation.ok || !validation.normalized) {
      toast.error(validation.error ?? practiceCopy.toast.completeQuestions);
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
        const created = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            formatErrorToast(practiceCopy.toast.createFailed, extractErrorMessage(created)),
          );
          return;
        }

        setDraftId(created.id);
        setSavedTitle(title);
        setSavedDifficulty(difficulty);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedQuestionsJson(JSON.stringify(questions));

        if (!andPublish && !skipRedirect) {
          toast.success(practiceCopy.toast.savedPractice);
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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(formatErrorToast(practiceCopy.toast.saveFailed, extractErrorMessage(data)));
          return;
        }

        setSavedTitle(title);
        setSavedDifficulty(difficulty);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedQuestionsJson(JSON.stringify(questions));

        if (!andPublish && !skipRedirect) {
          toast.success(practiceCopy.toast.saved);
          if (mode === 'create') {
            router.push(`/studio/${targetId}`);
          }
        }
        router.refresh();
        onSaved?.(targetId);
        return targetId;
      }
    } catch (error) {
      toast.error(
        formatErrorToast(
          practiceCopy.toast.saveFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [mode, materialId, draftId, subjectId, topicId, title, objectiveSlots, difficulty, questions, router, onSaved]);

  const publish = useCallback(async (confirmed = false) => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error(practiceCopy.toast.requiredFields);
      return;
    }

    const publishCheck = validateQuestions(questions, true, practiceCopy.validation);
    if (!publishCheck.ok) {
      toast.error(publishCheck.error ?? practiceCopy.toast.completeQuestions);
      return;
    }
    if ((publishCheck.normalized?.length ?? 0) < CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS) {
      toast.error(
        t('studio.practice.toast.minQuestions', {
          count: CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS,
        }),
      );
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
      toast.error(practiceCopy.toast.objectivesRequired);
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(
          formatErrorToast(practiceCopy.toast.publishFailed, extractErrorMessage(data)),
        );
        return;
      }

      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? t('studio.editor.toast.creditsSuffix', { count: Math.round(Number(data.creditsGranted)) })
          : '';
      toast.success(t('studio.practice.toast.publishSuccess', { credits: creditsMsg }));

      setCurrentStatus('PUBLISHED');
      router.refresh();
      onSaved?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          practiceCopy.toast.publishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(practiceCopy.toast.unpublishFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(practiceCopy.toast.unpublishSuccess);
      setCurrentStatus('DRAFT');
      router.refresh();
      onSaved?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          practiceCopy.toast.unpublishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setUnpublishing(false);
    }
  }, [materialId, router, onSaved]);

  const deleteMaterial = useCallback(async () => {
    if (!materialId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(practiceCopy.toast.deleteFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(practiceCopy.toast.deleteSuccess);
      setShowDeleteDialog(false);
      router.push('/studio');
      router.refresh();
    } catch (error) {
      toast.error(
        formatErrorToast(
          practiceCopy.toast.deleteFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setDeleting(false);
    }
  }, [materialId, router]);

  return (
    <div className="flex flex-col h-full">
      <div className="card-frame bg-card p-6 space-y-5 mb-4 flex-shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{practiceCopy.setupTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {practiceCopy.setupDescription}
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
                  {deleting ? editorCopy.actions.deleting : editorCopy.actions.delete}
                </Button>
                {isPublished ? (
                  <Button
                    variant="secondary-primary"
                    onClick={unpublish}
                    disabled={deleting || publishing || unpublishing || saving}
                  >
                    {unpublishing ? editorCopy.actions.unpublishing : editorCopy.actions.unpublish}
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="secondary-primary" onClick={() => save(false)} disabled={saving || publishing || unpublishing || deleting}>
              {saving ? editorCopy.actions.saving : editorCopy.actions.saveDraft}
            </Button>
            <Button
              variant="primary"
              onClick={() => publish(false)}
              disabled={publishing || saving || unpublishing || deleting || (isPublished && !hasChanges)}
            >
              {publishing
                ? editorCopy.actions.publishing
                : mode === 'create'
                  ? editorCopy.actions.savePublish
                : hasChanges
                    ? editorCopy.actions.savePublish
                    : isPublished
                      ? editorCopy.actions.published
                      : editorCopy.actions.publish}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{editorCopy.labels.title}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={editorCopy.labels.titlePlaceholder}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{editorCopy.labels.subject}</label>
              <Select
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}
                placeholder={editorCopy.labels.subjectPlaceholder}
                disabled={mode === 'edit' || Boolean(draftId)}
              >
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{editorCopy.labels.topic}</label>
              <Select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={!subjectId || mode === 'edit' || Boolean(draftId)}
                placeholder={editorCopy.labels.topicPlaceholder}
              >
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{editorCopy.labels.difficulty}</label>
              <Select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')}
                placeholder={editorCopy.labels.difficultyPlaceholder}
              >
                <SelectItem value="BASIC">{difficultyCopy.BASIC}</SelectItem>
                <SelectItem value="INTERMEDIATE">{difficultyCopy.INTERMEDIATE}</SelectItem>
                <SelectItem value="ADVANCED">{difficultyCopy.ADVANCED}</SelectItem>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[500px] space-y-6 pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{practiceCopy.questionsTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {practiceCopy.questionsDescription}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            {practiceCopy.addQuestion}
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-6 py-10 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{practiceCopy.noQuestionsTitle}</p>
              <p className="text-xs text-muted-foreground">
                {practiceCopy.noQuestionsDescription}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={addQuestion}>
              {practiceCopy.addFirstQuestion}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div key={q.id} className="card-frame bg-card p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('studio.practice.questionLabel', { count: i + 1 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {practiceCopy.questionHint}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setQuestionToRemove({ id: q.id, index: i })}
                    aria-label={t('studio.practice.removeQuestionAria', { count: i + 1 })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{practiceCopy.promptLabel}</label>
                  <RichTextField
                    value={q.question}
                    onChange={(html) => updateQuestion(q.id, { question: html })}
                    placeholder={practiceCopy.promptPlaceholder}
                    ariaLabel={t('studio.practice.promptAriaLabel', { count: i + 1 })}
                    minHeightClass="min-h-[88px]"
                    toolbarVisibility="always"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">{practiceCopy.answerChoicesLabel}</legend>
                  <p id={`correct-help-${q.id}`} className="text-xs text-muted-foreground">
                    {practiceCopy.answerChoicesHelp}
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
                              aria-label={t('studio.practice.optionCorrectAria', { label: optionLabel })}
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
                              placeholder={t('studio.practice.optionLabel', { label: optionLabel })}
                              ariaLabel={t('studio.practice.optionAriaLabel', { label: optionLabel, count: i + 1 })}
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
                            aria-label={t('studio.practice.removeOptionAria', { label: optionLabel })}
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
                    {practiceCopy.addOption}
                  </Button>
                </fieldset>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center pb-8">
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            {practiceCopy.addAnotherQuestion}
          </Button>
        </div>
      </div>

      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <div className="space-y-6">
            <header className="space-y-1">
              <AlertDialogTitle>
                {editorCopy.dialog.publishTitle}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {editorCopy.dialog.publishDescription}
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
                      placeholder={t('studio.editor.placeholders.objective', { count: idx + 1 })}
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
                {editorCopy.dialog.cancel}
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
                  ? editorCopy.actions.publishing
                  : hasChanges
                    ? editorCopy.actions.savePublish
                  : isPublished
                    ? editorCopy.actions.alreadyPublished
                      : editorCopy.dialog.publish}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editorCopy.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{editorCopy.deleteDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              {editorCopy.deleteDialog.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteMaterial}
              disabled={deleting}
            >
              {deleting ? editorCopy.actions.deleting : editorCopy.deleteDialog.confirm}
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
            <AlertDialogTitle>{practiceCopy.dialogs.removeQuestionTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {practiceCopy.dialogs.removeQuestionDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel onClick={() => setQuestionToRemove(null)}>
              {practiceCopy.dialogs.cancel}
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
              {practiceCopy.dialogs.confirmRemove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
