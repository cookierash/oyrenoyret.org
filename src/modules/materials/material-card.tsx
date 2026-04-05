'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiLock as Lock, PiCircleNotch as Loader2 } from 'react-icons/pi';
import { PracticeTestView } from './practice-test-view';
import { DifficultyBars, type MaterialDifficulty } from './difficulty-bars';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { getLocaleCode } from '@/src/i18n';

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
  const { locale, t, messages } = useI18n();
  const detailCopy = messages.materials.detail;
  const cardCopy = messages.materials.card;
  const localeCode = getLocaleCode(locale);
  const publishedLabel = publishedAt
    ? new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(publishedAt))
    : null;

  const handleUnlock = async () => {
    if (unlocked || unlocking) return;
    if (balance !== undefined && balance < estimatedCost) {
      toast.error(detailCopy.insufficientCredits);
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch(`/api/materials/${id}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(detailCopy.unlockFailed);
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
      onUnlocked?.();
    } catch {
      toast.error(detailCopy.unlockFailed);
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
            {t('materials.detail.by', { name: authorName })}
            {publishedLabel && <> · {publishedLabel}</>}
            {materialType === 'PRACTICE_TEST' && <> · {detailCopy.practiceTestLabel}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isOwn ? cardCopy.ownNotice : cardCopy.lockedNotice}
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
                  <>
                    {t('materials.detail.unlockButton', {
                      count: Math.round(Number(estimatedCost)),
                    })}
                  </>
                  )}
              </Button>
              {balance !== undefined && balance < estimatedCost && (
                <p className="text-xs text-destructive mt-2">
                  {t('materials.detail.unlockNeedMore', {
                    count: Math.round(Number(estimatedCost - balance)),
                  })}
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
        {t('materials.detail.by', { name: authorName })}
        {publishedLabel && <> · {publishedLabel}</>}
        {materialType === 'PRACTICE_TEST' && <> · {detailCopy.practiceTestLabel}</>}
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
