'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PiLock as Lock, PiCircleNotch as Loader2 } from 'react-icons/pi';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { PracticeTestView } from './practice-test-view';
import { toast } from 'sonner';
import { sanitizeRichTextHtml } from '@/src/security/validation';
import { useI18n } from '@/src/i18n/i18n-provider';
import { getLocaleCode } from '@/src/i18n';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { StarRating } from '@/src/components/ui/star-rating';
import { htmlToPlainTextWithNewlines } from '@/src/lib/html';
import { splitObjectives } from '@/src/modules/materials/utils';

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
  ratingAvg?: number;
  ratingCount?: number;
}

function practiceTestPreview(
  content: string,
  fallback: { missingQuestion: string; emptyOption: string },
): {
  questions: { questionHtml: string; options: { label: string; textHtml: string }[] }[];
} {
  try {
    const parsed = JSON.parse(content);
    const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return {
      questions: qs.slice(0, 3).map((q: { question?: string; options?: { text?: string }[] }) => {
        const options = Array.isArray(q.options) ? q.options : [];
        return {
          questionHtml: sanitizeRichTextHtml(
            q.question || `<p>${fallback.missingQuestion}</p>`,
          ),
          options: options.map((opt, idx) => ({
            label: String.fromCharCode(65 + idx),
            textHtml: sanitizeRichTextHtml(opt?.text || `<p>${fallback.emptyOption}</p>`),
          })),
        };
      }),
    };
  } catch {
    return { questions: [] };
  }
}

function getTextStats(html: string) {
  const text = htmlToPlainTextWithNewlines(html);
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.replace(/\s+/g, '').length;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { text, wordCount, charCount, lines };
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
  ratingAvg = 0,
  ratingCount = 0,
}: MaterialDetailViewProps) {
  const { locale, t, messages } = useI18n();
  const copy = messages.materials.detail;
  const commentsCopy = messages.materials.comments;
  const practiceCopy = messages.materials.practiceTest;
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const localeCode = getLocaleCode(locale);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [localeCode],
  );
  const textStats = useMemo(
    () => (materialType === 'TEXTUAL' ? getTextStats(content) : null),
    [content, materialType],
  );
  const previewLines = useMemo(
    () => textStats?.lines.slice(0, 5) ?? [],
    [textStats],
  );
  const objectiveLines = useMemo(() => splitObjectives(objectives), [objectives]);
  const practicePreview = useMemo(
    () =>
      materialType === 'PRACTICE_TEST'
        ? practiceTestPreview(content, {
            missingQuestion: practiceCopy.missingQuestion,
            emptyOption: practiceCopy.emptyOption,
          })
        : null,
    [content, materialType, practiceCopy],
  );

  const handleUnlock = async () => {
    if (unlocked || unlocking) return;
    if (balance !== undefined && balance < estimatedCost) {
      toast.error(copy.insufficientCredits);
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch(`/api/materials/${id}/unlock`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.unlockFailed, extractErrorMessage(data)));
        return;
      }
      setUnlocked(true);
      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success(
        t('materials.detail.unlockSuccess', {
          count: Math.round(Number(data.cost ?? estimatedCost)),
        }),
      );
      router.refresh();
    } catch (error) {
      toast.error(
        formatErrorToast(copy.unlockFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setUnlocking(false);
    }
  };

  const unlockSection = !isOwn && !unlocked ? (
    <section className="card-frame bg-card p-4 space-y-3">
      <>
        <p className="text-sm text-muted-foreground">
          {copy.purchasePrompt}
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
              {t('materials.detail.unlockButton', { count: Math.round(Number(estimatedCost)) })}
            </>
          )}
        </Button>
        {balance !== undefined && balance < estimatedCost && (
          <p className="text-xs text-destructive">
            {t('materials.detail.unlockNeedMore', {
              count: Math.round(Number(estimatedCost - balance)),
            })}
          </p>
        )}
      </>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBars difficulty={difficulty ?? 'BASIC'} />
        <div className="flex items-center gap-2">
          <StarRating
            value={ratingCount > 0 ? ratingAvg : 0}
            ariaLabel={
              ratingCount > 0
                ? commentsCopy.ratingSummary
                    .replace('{{avg}}', Number(ratingAvg).toFixed(1))
                    .replace('{{count}}', String(ratingCount))
                : commentsCopy.noRatings
            }
          />
          <span className="text-xs text-muted-foreground">
            {ratingCount > 0
              ? commentsCopy.ratingSummary
                  .replace('{{avg}}', Number(ratingAvg).toFixed(1))
                  .replace('{{count}}', String(ratingCount))
              : commentsCopy.noRatings}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('materials.detail.by', { name: authorName })}
          {publishedAt && <> · {dateFormatter.format(new Date(publishedAt))}</>}
          {materialType === 'PRACTICE_TEST' && <> · {copy.practiceTestLabel}</>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start">
        <div className="space-y-4">
          {objectiveLines.length > 0 && (
            <section className="card-frame bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{copy.objectivesTitle}</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {objectiveLines.map((line, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {!unlocked && (materialType === 'TEXTUAL' || materialType === 'PRACTICE_TEST') && (
            <section className="card-frame bg-card p-4 space-y-3">
              <div className="text-sm font-medium text-foreground">{copy.statsTitle}</div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {copy.statsUnlocked}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {unlockCount}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {copy.statsRatingAvg}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StarRating
                      value={ratingCount > 0 ? ratingAvg : 0}
                      sizeClass="h-4 w-4"
                      ariaLabel={
                        ratingCount > 0
                          ? commentsCopy.ratingSummary
                              .replace('{{avg}}', Number(ratingAvg).toFixed(1))
                              .replace('{{count}}', String(ratingCount))
                          : commentsCopy.noRatings
                      }
                    />
                    <span className="text-sm font-medium text-foreground">
                      {ratingCount > 0 ? Number(ratingAvg).toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {copy.statsRatingCount}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {ratingCount}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!isPreview && !isOwn && !unlocked ? (
            <section className="card-frame bg-card p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {copy.purchasePrompt}
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
                    {t('materials.detail.unlockButton', {
                      count: Math.round(Number(estimatedCost)),
                    })}
                  </>
                )}
              </Button>
              {balance !== undefined && balance < estimatedCost && (
                <p className="text-xs text-destructive">
                  {t('materials.detail.unlockNeedMore', {
                    count: Math.round(Number(estimatedCost - balance)),
                  })}
                </p>
              )}
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {unlocked ? (
            materialType === 'TEXTUAL' ? (
              <div
                className="document-editor-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content) }}
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
                  <h2 className="text-sm font-medium">{copy.previewTextTitle}</h2>
                  <p className="text-xs text-muted-foreground">
                    {copy.previewTextSubtitle}
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
                  <p className="italic">{copy.noPreview}</p>
                )}
              </div>
            </section>
          ) : (
            <section className="card-frame bg-card p-4 space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">{copy.previewQuestionsTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  {copy.previewQuestionsSubtitle}
                </p>
              </div>
              {practicePreview && practicePreview.questions.length > 0 ? (
                <div className="space-y-5">
                  {practicePreview.questions.map((q, i) => (
                    <div key={i} className="card-frame bg-card p-5 space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t('materials.detail.previewQuestionLabel', { count: i + 1 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {copy.previewQuestionHint}
                        </p>
                      </div>
                      <div
                        className="document-editor-content practice-test-content text-foreground"
                        dangerouslySetInnerHTML={{ __html: q.questionHtml }}
                      />
                      {q.options.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium">{copy.answerChoices}</p>
                          <div className="space-y-3">
                            {q.options.map((opt) => (
                              <div
                                key={opt.label}
                                className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-start sm:gap-3"
                              >
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="h-4 w-4 rounded-full border border-border bg-background" />
                                  <span className="text-xs font-medium text-muted-foreground w-6">
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
                        <p className="text-xs text-muted-foreground italic">
                          {copy.noOptions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">{practiceCopy.noQuestions}</p>
              )}
            </section>
          )}
          {isPreview ? unlockSection : null}
          {isOwn ? (
            <p className="text-sm text-muted-foreground">
              {copy.youPublished}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
