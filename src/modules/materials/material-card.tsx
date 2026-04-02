'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiLock as Lock, PiCircleNotch as Loader2 } from 'react-icons/pi';
import { PracticeTestView } from './practice-test-view';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { toast } from 'sonner';

interface MaterialCardProps {
  id: string;
  title: string;
  content: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  authorName: string;
  publishedAt: Date | null;
  isUnlocked: boolean;
  /** True when current user is the publisher (cannot unlock own material) */
  isOwn?: boolean;
  /** basic=1 green bar, intermediate=2 yellow, advanced=3 red */
  difficulty?: MaterialDifficulty | null;
  estimatedCost?: number;
  balance?: number;
  onUnlocked?: () => void;
}

export function MaterialCard({
  id,
  title,
  content,
  materialType,
  authorName,
  publishedAt,
  isUnlocked,
  isOwn = false,
  difficulty,
  estimatedCost = 2,
  balance,
  onUnlocked,
}: MaterialCardProps) {
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
      toast.success(`Unlocked! (−${Math.round(Number(data.cost ?? estimatedCost))} credits)`);
      router.refresh();
      onUnlocked?.();
    } catch {
      toast.error('Failed to unlock');
    } finally {
      setUnlocking(false);
    }
  };

  if (!unlocked) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DifficultyBars difficulty={difficulty ?? 'BASIC'} />
            <Lock className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <CardDescription>
            By {authorName}
            {publishedAt && <> · {new Date(publishedAt).toLocaleDateString()}</>}
            {materialType === 'PRACTICE_TEST' && <> · Practice test</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isOwn
              ? 'You published this material. It is always available to you.'
              : 'Unlock this material to view the full content.'}
          </p>
          {!isOwn && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUnlock}
                disabled={unlocking || (balance !== undefined && balance < estimatedCost)}
              >
                {unlocking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Unlock for {Math.round(Number(estimatedCost))} credits</>
                )}
              </Button>
              {balance !== undefined && balance < estimatedCost && (
                <p className="text-xs text-destructive mt-2">
                  You need {Math.round(Number(estimatedCost - balance))} more credits
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DifficultyBars difficulty={difficulty ?? 'BASIC'} />
          {title}
        </CardTitle>
        <CardDescription>
          By {authorName}
          {publishedAt && <> · {new Date(publishedAt).toLocaleDateString()}</>}
          {materialType === 'PRACTICE_TEST' && <> · Practice test</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {materialType === 'PRACTICE_TEST' ? (
          <PracticeTestView content={content} />
        ) : (
          <div
            className="document-editor-content text-sm"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </CardContent>
    </Card>
  );
}
