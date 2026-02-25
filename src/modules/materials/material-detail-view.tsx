'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { toast } from 'sonner';

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
  difficulty?: MaterialDifficulty | null;
  estimatedCost?: number;
  balance?: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textPreview(html: string, maxLength = 400): string {
  const text = stripHtml(html);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

function practiceTestPreview(content: string): { questions: { question: string }[] } {
  try {
    const parsed = JSON.parse(content);
    const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return { questions: qs.slice(0, 3).map((q: { question?: string }) => ({ question: q.question || '(No question)' })) };
  } catch {
    return { questions: [] };
  }
}

export function MaterialDetailView({
  id,
  title: _title,
  objectives,
  content,
  materialType,
  authorName,
  publishedAt,
  isUnlocked,
  isOwn = false,
  difficulty,
  estimatedCost = 2,
  balance,
}: MaterialDetailViewProps) {
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked);

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
      toast.success(`Unlocked! (−${Number(data.cost ?? estimatedCost).toFixed(2)} credits)`);
      router.refresh();
    } catch {
      toast.error('Failed to unlock');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-2">
        <DifficultyBars difficulty={difficulty ?? 'BASIC'} />
        <p className="text-xs text-muted-foreground">
          By {authorName}
          {publishedAt && <> · {new Date(publishedAt).toLocaleDateString()}</>}
          {materialType === 'PRACTICE_TEST' && <> · Practice test</>}
        </p>
      </div>

      {objectives && objectives.trim() && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Objectives</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{objectives.trim()}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">Preview</h2>
        {materialType === 'TEXTUAL' ? (
          <p className="text-sm text-muted-foreground">{textPreview(content) || 'No preview available.'}</p>
        ) : (
          <div className="space-y-2 text-sm">
            {practiceTestPreview(content).questions.map((q, i) => (
              <p key={i} className="text-muted-foreground">
                {i + 1}. {q.question}
              </p>
            ))}
            {practiceTestPreview(content).questions.length === 0 && (
              <p className="text-muted-foreground italic">No questions in this practice test.</p>
            )}
          </div>
        )}
      </section>

      <section>
        {isOwn ? (
          <p className="text-sm text-muted-foreground">
            You published this material.
          </p>
        ) : !unlocked ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Unlock this material to access it.
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
                  Unlock for {Number(estimatedCost).toFixed(2)} credits
                </>
              )}
            </Button>
            {balance !== undefined && balance < estimatedCost && (
              <p className="text-xs text-destructive mt-2">
                You need {Number(estimatedCost - balance).toFixed(2)} more credits
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You have unlocked this material.
          </p>
        )}
      </section>
    </div>
  );
}
