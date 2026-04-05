'use client';

import { useI18n } from '@/src/i18n/i18n-provider';

export type MaterialDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

interface DifficultyBarsProps {
  difficulty: MaterialDifficulty | null | undefined;
  className?: string;
}

/** 1 bar green (basic), 2 bars yellow (intermediate), 3 bars red (advanced) */
export function DifficultyBars({ difficulty, className = '' }: DifficultyBarsProps) {
  const { t, messages } = useI18n();
  const d = difficulty ?? 'BASIC';
  const label = messages.materials.difficulty[d] ?? d;

  const config = {
    BASIC: { count: 1, color: 'bg-green-500' },
    INTERMEDIATE: { count: 2, color: 'bg-yellow-500' },
    ADVANCED: { count: 3, color: 'bg-red-500' },
  } as const;

  const { count, color } = config[d] ?? config.BASIC;

  return (
    <div
      className={`inline-flex items-center gap-1 shrink-0 ${className}`}
      title={label}
      role="img"
      aria-label={t('materials.difficultyAria', { level: label })}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 min-h-2 min-w-2 shrink-0 rounded-full ${i <= count ? color : 'bg-muted'}`}
          aria-hidden
        />
      ))}
    </div>
  );
}
