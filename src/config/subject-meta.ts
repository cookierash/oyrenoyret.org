/**
 * Subject metadata for catalog display.
 * Icons and colors for engaging, distinct cards.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  BookOpen,
  BookText,
  Languages,
  Landmark,
  Globe,
  Cpu,
  Scale,
} from 'lucide-react';
import type { SubjectId } from './curriculum';

export const SUBJECT_ICONS: Record<SubjectId, LucideIcon> = {
  mathematics: Calculator,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Leaf,
  'azerbaijani-language': BookOpen,
  'azerbaijani-literature': BookText,
  english: Languages,
  russian: Languages,
  history: Landmark,
  geography: Globe,
  'information-technology': Cpu,
  civics: Scale,
};

/** Accent colors for subject cards - Tailwind classes */
export const SUBJECT_COLORS: Record<SubjectId, string> = {
  mathematics: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  physics: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  chemistry: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  biology: 'bg-green-500/15 text-green-600 dark:text-green-400',
  'azerbaijani-language': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'azerbaijani-literature': 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  english: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  russian: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  history: 'bg-stone-500/15 text-stone-600 dark:text-stone-400',
  geography: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  'information-technology': 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  civics: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
};
