'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PiLock as Lock, PiCircleNotch as Loader2 } from 'react-icons/pi';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { PracticeTestView } from './practice-test-view';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/src/security/validation';

interface MaterialDetailViewProps {
  id: string;
  title: string;
  objectives: string | null;
  content: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  authorName: string;
  publishedAt: Date | null;
  isUnlocked: boolean;
  isOwn?: boolean;
  isPreview?: boolean;
  difficulty?: MaterialDifficulty | null;
  estimatedCost?: number;
  balance?: number;
  unlockCount?: number;
}

function stripHtmlWithLineBreaks(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n');
  return withBreaks.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function practiceTestPreview(content: string): {
  questions: { questionHtml: string; options: { label: string; textHtml: string }[] }[];
} {
  try {
    const parsed = JSON.parse(content);
    const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return {
      questions: qs.slice(0, 3).map((q: { question?: string; options?: { text?: string }[] }) => {
        const options = Array.isArray(q.options) ? q.options : [];
        return {
          questionHtml: sanitizeHtml(q.question || '<p>(No question)</p>'),
          options: options.map((opt, idx) => ({
            label: String.fromCharCode(65 + idx),
            textHtml: sanitizeHtml(opt?.text || '<p>(Empty option)</p>'),
          })),
        };
      }),
    };
  } catch {
    return { questions: [] };
  }
}

function getTextStats(html: string) {
  const text = stripHtmlWithLineBreaks(html);
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.replace(/\s+/g, '').length;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { text, wordCount, charCount, lines };
}

function getPracticeStats(content: string) {
  try {
    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questionCount = questions.length;
    const optionCount = questions.reduce((total: number, q: { options?: unknown[] }) => {
      const opts = Array.isArray(q.options) ? q.options.length : 0;
      return total + opts;
    }, 0);
    return { questionCount, optionCount };
  } catch {
    return { questionCount: 0, optionCount: 0 };
  }
}

function formatPublishedDate(value: Date | string | null) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function MaterialDetailView({
  id,
  objectives,
  content,
  materialType,
  authorName,
  publishedAt,
  isUnlocked,
  isOwn = false,
  isPreview = false,
  difficulty,
  estimatedCost = 3,
  balance,
  unlockCount = 0,
}: MaterialDetailViewProps) {
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const textStats = useMemo(
    () => (materialType === 'TEXTUAL' ? getTextStats(content) : null),
    [content, materialType],
  );
  const previewLines = useMemo(
    () => textStats?.lines.slice(0, 5) ?? [],
    [textStats],
  );
  const practicePreview = useMemo(
    () => (materialType === 'PRACTICE_TEST' ? practiceTestPreview(content) : null),
    [content, materialType],
  );
  const practiceStats = useMemo(
    () => (materialType === 'PRACTICE_TEST' ? getPracticeStats(content) : null),
    [content, materialType],
  );

  const handleUnlock = async () => {
    if (unlocked || unlocking) return;
    if (balance !== undefined && balance < estimatedCost) {
      toast.error('Insufficient credits');
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch(`/api/materials/${id}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to unlock');
        return;
      }
      setUnlocked(true);
      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success(`Unlocked! (−${Math.round(Number(data.cost ?? estimatedCost))} credits)`);
      router.refresh();
    } catch {
      toast.error('Failed to unlock');
    } finally {
      setUnlocking(false);
    }
  };

  const unlockSection = !isOwn && !unlocked ? (
    <section className="card-frame bg-card p-4 space-y-3">
      <>
        <p className="text-sm text-muted-foreground">
          Purchase this material to access the full content.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleUnlock}
          disabled={unlocking || (balance !== undefined && balance < estimatedCost)}
        >
          {unlocking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Lock className="h-4 w-4 mr-1.5" />
              Unlock for {Math.round(Number(estimatedCost))} credits
            </>
          )}
        </Button>
        {balance !== undefined && balance < estimatedCost && (
          <p className="text-xs text-destructive">
            You need {Math.round(Number(estimatedCost - balance))} more credits
          </p>
        )}
      </>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBars difficulty={difficulty ?? 'BASIC'} />
        <p className="text-xs text-muted-foreground">
          By {authorName}
          {publishedAt && <> · {formatPublishedDate(publishedAt)}</>}
          {materialType === 'PRACTICE_TEST' && <> · Practice test</>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start">
        <div className="space-y-4">
          {objectives && objectives.trim() && (
            <section className="card-frame bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Objectives</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {objectives
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {!unlocked && (materialType === 'TEXTUAL' || materialType === 'PRACTICE_TEST') && (
            <section className="card-frame bg-card p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">Material stats</div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Unlocked
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {unlockCount}
                  </div>
                </div>
                {materialType === 'TEXTUAL' ? (
                  <>
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Words
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {textStats?.wordCount ?? 0}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Characters
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {textStats?.charCount ?? 0}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Questions
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {practiceStats?.questionCount ?? 0}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Options
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {practiceStats?.optionCount ?? 0}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {!isPreview && !isOwn && !unlocked ? (
            <section className="card-frame bg-card p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Purchase this material to access the full content.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUnlock}
                disabled={unlocking || (balance !== undefined && balance < estimatedCost)}
              >
                {unlocking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1.5" />
                    Unlock for {Math.round(Number(estimatedCost))} credits
                  </>
                )}
              </Button>
              {balance !== undefined && balance < estimatedCost && (
                <p className="text-xs text-destructive">
                  You need {Math.round(Number(estimatedCost - balance))} more credits
                </p>
              )}
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {unlocked ? (
            materialType === 'TEXTUAL' ? (
              <div
                className="document-editor-content text-sm"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div className="space-y-4">
                {/* Full practice test view with answer checks */}
                <PracticeTestView content={content} />
              </div>
            )
          ) : materialType === 'TEXTUAL' ? (
            <section className="card-frame bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Preview (first 5 lines)</h2>
                  <p className="text-xs text-muted-foreground">
                    A quick look at the material content before unlocking.
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {previewLines.length > 0 ? (
                  previewLines.map((line, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="italic">No preview available.</p>
                )}
              </div>
            </section>
          ) : (
            <section className="card-frame bg-card p-4 space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Preview (first 3 questions)</h2>
                <p className="text-xs text-muted-foreground">
                  Review the prompts and answer choices before unlocking.
                </p>
              </div>
              {practicePreview && practicePreview.questions.length > 0 ? (
                <div className="space-y-5">
                  {practicePreview.questions.map((q, i) => (
                    <div key={i} className="card-frame bg-card p-5 space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Question {i + 1}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Preview of the prompt and answer choices.
                        </p>
                      </div>
                      <div
                        className="document-editor-content practice-test-content text-foreground"
                        dangerouslySetInnerHTML={{ __html: q.questionHtml }}
                      />
                      {q.options.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Answer choices</p>
                          <div className="space-y-3">
                            {q.options.map((opt) => (
                              <div
                                key={opt.label}
                                className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-start sm:gap-3"
                              >
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="h-4 w-4 rounded-full border border-border bg-background" />
                                  <span className="text-xs font-semibold text-muted-foreground w-6">
                                    {opt.label}
                                  </span>
                                </div>
                                <div
                                  className="document-editor-content practice-test-content text-foreground"
                                  dangerouslySetInnerHTML={{ __html: opt.textHtml }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No options provided.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No questions in this practice test.</p>
              )}
            </section>
          )}
          {isPreview ? unlockSection : null}
          {isOwn ? (
            <p className="text-sm text-muted-foreground">
              You published this material.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
