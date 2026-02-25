'use client';

import { useState, useCallback } from 'react';
import { MaterialCardCompact } from './material-card-compact';

interface MaterialWithCost {
  id: string;
  userId: string;
  title: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  alignmentScore: number | null;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null;
  publishedAt: Date | null;
  user: { firstName: string | null; lastName: string | null };
  _count: { accesses: number };
  estimatedCost: number;
}

interface CatalogMaterialsGridProps {
  materials: MaterialWithCost[];
  subjectId: string;
  topicId: string;
  userId: string | null;
  unlockedIds: string[];
  balance: number;
}

export function CatalogMaterialsGrid({
  materials,
  subjectId,
  topicId,
  userId,
  unlockedIds,
  balance,
}: CatalogMaterialsGridProps) {
  const [unlockInProgress, setUnlockInProgress] = useState(0);

  const onUnlockStart = useCallback(() => {
    setUnlockInProgress((n) => n + 1);
  }, []);

  const onUnlockEnd = useCallback(() => {
    setUnlockInProgress((n) => Math.max(0, n - 1));
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {materials.map((m) => {
        const isOwn = userId !== null && m.userId === userId;
        return (
          <MaterialCardCompact
            key={m.id}
            id={m.id}
            title={m.title}
            materialType={m.materialType}
            authorName={[m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || 'Student'}
            isUnlocked={unlockedIds.includes(m.id) || isOwn}
            isOwn={isOwn}
            estimatedCost={m.estimatedCost}
            balance={balance}
            alignmentScore={m.alignmentScore}
            unlockCount={m._count.accesses}
            difficulty={m.difficulty}
            subjectId={subjectId}
            topicId={topicId}
            onUnlockStart={onUnlockStart}
            onUnlockEnd={onUnlockEnd}
            isUnlockDisabled={unlockInProgress > 0}
          />
        );
      })}
    </div>
  );
}
