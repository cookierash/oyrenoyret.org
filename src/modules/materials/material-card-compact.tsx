'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, Users, ExternalLink, User } from 'lucide-react';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { toast } from 'sonner';

interface MaterialCardCompactProps {
  id: string;
  title: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  authorName: string;
  isUnlocked: boolean;
  isOwn?: boolean;
  estimatedCost?: number;
  balance?: number;
  /** Number of users who unlocked this material */
  unlockCount: number;
  /** basic=1 green bar, intermediate=2 yellow, advanced=3 red */
  difficulty?: MaterialDifficulty | null;
  subjectId: string;
  topicId: string;
  onUnlocked?: () => void;
  /** Called when unlock request starts (disables other unlock buttons) */
  onUnlockStart?: () => void;
  /** Called when unlock request ends (success or failure) */
  onUnlockEnd?: () => void;
  /** Disable unlock button (e.g. when another unlock is in progress) */
  isUnlockDisabled?: boolean;
}

export function MaterialCardCompact({
  id,
  title,
  materialType,
  authorName,
  isUnlocked,
  isOwn = false,
  estimatedCost = 2,
  balance,
  unlockCount,
  difficulty,
  subjectId,
  topicId,
  onUnlocked,
  onUnlockStart,
  onUnlockEnd,
  isUnlockDisabled = false,
}: MaterialCardCompactProps) {
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const detailHref = `/catalog/${subjectId}/${topicId}/${id}`;
  const previewHref = `/preview/${id}`;
  const canViewFull = unlocked && !isOwn;
  const typeBadge =
    materialType === 'PRACTICE_TEST'
      ? 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400'
      : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400';

  const handleUnlock = async () => {
    if (unlocked || unlocking || isUnlockDisabled) return;
    if (balance !== undefined && balance < estimatedCost) {
      toast.error('Insufficient credits');
      return;
    }
    setUnlocking(true);
    onUnlockStart?.();
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
      onUnlocked?.();
    } catch {
      toast.error('Failed to unlock');
    } finally {
      setUnlocking(false);
      onUnlockEnd?.();
    }
  };

  return (
    <Card className={`overflow-hidden ${isOwn ? 'ring-1 ring-primary/30' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <h3 className="font-medium text-sm truncate min-w-0 flex-1" title={title}>
            {!unlocked && !isOwn && <Lock className="h-3.5 w-3.5 text-muted-foreground inline mr-1.5 align-text-bottom shrink-0" />}
            {title}
          </h3>
          <div className="shrink-0 flex items-center gap-1">
            <span
              className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${typeBadge}`}
            >
              {materialType === 'PRACTICE_TEST' ? 'Test' : 'Textual'}
            </span>
            {isOwn && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/15 text-primary" title="You published this">
                <User className="h-3 w-3" />
                Yours
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <DifficultyBars difficulty={difficulty ?? 'BASIC'} className="shrink-0" />
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {unlockCount} unlocked
          </span>
        </div>

        <p className="text-xs text-muted-foreground truncate">By {authorName}</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {!unlocked && !isOwn && (
            <Button
              variant="primary"
              size="sm"
              className="h-7 text-xs"
              onClick={handleUnlock}
              disabled={unlocking || isUnlockDisabled || (balance !== undefined && balance < estimatedCost)}
            >
              {unlocking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>Unlock ({Number(estimatedCost).toFixed(2)} credits)</>
              )}
            </Button>
          )}
          <Button variant="secondary-primary" size="sm" className="h-7 text-xs" asChild>
            <Link href={canViewFull ? detailHref : previewHref}>
              {canViewFull ? 'View in library' : 'Preview'}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {!isOwn && balance !== undefined && balance < estimatedCost && !unlocked && (
          <p className="text-[10px] text-destructive">Need {Number(estimatedCost - balance).toFixed(2)} more credits</p>
        )}
      </CardContent>
    </Card>
  );
}
