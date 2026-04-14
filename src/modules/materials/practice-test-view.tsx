'use client';

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { sanitizeRichTextHtml } from '@/src/security/validation';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/src/i18n/i18n-provider';

interface PracticeQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer';
  questionHtml: string;
  options?: { id: string; textHtml: string }[];
  correctOptionId?: string;
}

interface PracticeTestViewProps {
  content: string;
  className?: string;
}

export function PracticeTestView({ content, className }: PracticeTestViewProps) {
  const { t, messages } = useI18n();
  const copy = messages.materials.practiceTest;
  const questions = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed.questions) ? parsed.questions : [];
      return list.map(
        (
          q: {
            id?: string;
            type?: 'multiple_choice' | 'short_answer';
            question?: string;
            options?: { id?: string; text?: string }[];
            correctOptionId?: string;
          },
          idx: number,
        ) => ({
          id: q.id ?? `q-${idx}`,
          type: q.type ?? 'multiple_choice',
          questionHtml: sanitizeRichTextHtml(q.question || copy.missingQuestion),
          options: Array.isArray(q.options)
            ? q.options.map((opt, optIdx) => ({
                id: opt.id ?? `${q.id ?? `q-${idx}`}-opt-${optIdx}`,
                textHtml: sanitizeRichTextHtml(opt.text || copy.emptyOption),
              }))
            : [],
          correctOptionId: q.correctOptionId,
        }),
      );
    } catch {
      return [];
    }
  }, [content, copy.emptyOption, copy.missingQuestion]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasAnyRevealed = Object.values(revealed).some(Boolean);

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {copy.noQuestions}
      </p>
    );
  }

  return (
    <form className={cn('space-y-6 text-sm', className)}>
      {questions.map((q: PracticeQuestion, idx: number) => {
        const selectedId = selected[q.id];
        const isRevealed = !!revealed[q.id];
        const hasSelection = !!selectedId;
        const isCorrect =
          hasSelection && q.correctOptionId && selectedId === q.correctOptionId;
        return (
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[q.id] = el;
            }}
            className="space-y-3 rounded-md border border-border/60 bg-card p-4"
          >
            <p className="text-[10px] uppercase text-muted-foreground">
              {t('materials.practiceTest.questionLabel', { count: idx + 1 })}
            </p>
            <div
              className="document-editor-content practice-test-content text-foreground"
              dangerouslySetInnerHTML={{ __html: q.questionHtml }}
            />
            {q.type === 'multiple_choice' && q.options?.length ? (
              <div className="space-y-3">
                {q.options.map((opt) => {
                  const isCorrectOption = q.correctOptionId && opt.id === q.correctOptionId;
                  const isSelected = selectedId === opt.id;
                  const showCorrect = isRevealed && isCorrectOption;
                  const showIncorrect = isRevealed && isSelected && !isCorrectOption;
                  const baseClasses = 'rounded-md border p-3 transition-colors';
                  const stateClasses = showCorrect
                    ? 'border-emerald-500/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : showIncorrect
                      ? 'border-rose-500/70 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
                      : 'border-border/70 bg-muted/20';
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex items-start gap-3 cursor-pointer hover:border-primary/40',
                        baseClasses,
                        stateClasses,
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.id}
                        checked={selectedId === opt.id}
                        onChange={() => setSelected((prev) => ({ ...prev, [q.id]: opt.id }))}
                        className="h-4 w-4 accent-primary mt-1"
                      />
                      <div
                        className="document-editor-content practice-test-content flex-1"
                        dangerouslySetInnerHTML={{
                          __html: opt.textHtml,
                        }}
                      />
                      {isRevealed ? (
                        <span className="text-[10px] font-medium uppercase">
                          {showCorrect
                            ? copy.correctLabel
                            : showIncorrect
                              ? copy.yourChoiceLabel
                              : ''}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : q.type === 'short_answer' ? (
              <input
                type="text"
                name={`q-${q.id}`}
                placeholder={copy.answerPlaceholder}
                className="w-full max-w-md px-3 py-2 text-sm border rounded-md bg-background"
              />
            ) : null}
            {isRevealed && q.correctOptionId ? (
              <span
                className={cn(
                  'text-xs',
                  hasSelection
                    ? isCorrect
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                    : 'text-muted-foreground',
                )}
              >
                {hasSelection
                  ? isCorrect
                    ? copy.correctResult
                    : copy.incorrectResult
                  : copy.answerRevealed}
              </span>
            ) : null}
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary-primary"
          disabled={submitting || questions.length === 0}
          onClick={async () => {
            if (submitting) return;
            if (hasAnyRevealed) {
              setRevealed({});
              setSelected({});
              return;
            }
            setSubmitting(true);
            for (const q of questions as PracticeQuestion[]) {
              const el = questionRefs.current[q.id];
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              setRevealed((prev) => ({ ...prev, [q.id]: true }));
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
            setSubmitting(false);
          }}
        >
          {hasAnyRevealed ? copy.clearAnswers : copy.submit}
        </Button>
      </div>
    </form>
  );
}
