'use client';

import { useMemo } from 'react';
import { cn } from '@/src/lib/utils';

interface PracticeQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer';
  question: string;
  options?: { id: string; text: string }[];
}

interface PracticeTestViewProps {
  content: string;
  className?: string;
}

export function PracticeTestView({ content, className }: PracticeTestViewProps) {
  const questions = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed.questions) ? parsed.questions : [];
    } catch {
      return [];
    }
  }, [content]);

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No questions in this practice test.
      </p>
    );
  }

  return (
    <form className={cn('space-y-6 text-sm', className)}>
      {questions.map((q: PracticeQuestion, idx: number) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="font-medium text-foreground">
            {idx + 1}. {q.question || '(No question text)'}
          </legend>
          {q.type === 'multiple_choice' && q.options?.length ? (
            <div className="space-y-2 pl-1">
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 cursor-pointer hover:text-foreground"
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt.id}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{opt.text || '(Empty option)'}</span>
                </label>
              ))}
            </div>
          ) : q.type === 'short_answer' ? (
            <input
              type="text"
              name={`q-${q.id}`}
              placeholder="Your answer..."
              className="w-full max-w-md px-3 py-2 text-sm border rounded-md bg-background"
            />
          ) : null}
        </fieldset>
      ))}
    </form>
  );
}
