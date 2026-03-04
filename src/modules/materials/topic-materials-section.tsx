'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { CatalogMaterialsGrid } from './catalog-materials-grid';

export type TopicMaterialWithCost = {
  id: string;
  userId: string;
  title: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null;
  publishedAt: Date | null;
  user: { firstName: string | null; lastName: string | null };
  _count: { accesses: number };
  estimatedCost: number;
};

type SortKey =
  | 'newest'
  | 'oldest'
  | 'mostUnlocked'
  | 'titleAz'
  | 'titleZa'
  | 'easiest'
  | 'hardest';

const DIFFICULTY_ORDER: Record<string, number> = {
  BASIC: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

interface TopicMaterialsSectionProps {
  materials: TopicMaterialWithCost[];
  subjectId: string;
  topicId: string;
  userId: string | null;
  unlockedIds: string[];
  balance: number;
}

export function TopicMaterialsSection({
  materials,
  subjectId,
  topicId,
  userId,
  unlockedIds,
  balance,
}: TopicMaterialsSectionProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = materials;

    if (q) {
      list = materials.filter((m) => {
        const title = m.title.toLowerCase();
        const author = [m.user.firstName, m.user.lastName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return title.includes(q) || author.includes(q);
      });
    }

    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
        case 'oldest':
          return new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime();
        case 'mostUnlocked':
          return (b._count?.accesses ?? 0) - (a._count?.accesses ?? 0);
        case 'titleAz':
          return (a.title ?? '').localeCompare(b.title ?? '');
        case 'titleZa':
          return (b.title ?? '').localeCompare(a.title ?? '');
        case 'easiest':
          return (DIFFICULTY_ORDER[a.difficulty ?? 'BASIC'] ?? 0) - (DIFFICULTY_ORDER[b.difficulty ?? 'BASIC'] ?? 0);
        case 'hardest':
          return (DIFFICULTY_ORDER[b.difficulty ?? 'BASIC'] ?? 0) - (DIFFICULTY_ORDER[a.difficulty ?? 'BASIC'] ?? 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [materials, search, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search materials by title or author"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="topic-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            Sort by
          </label>
          <Select
            id="topic-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-[180px]"
            aria-label="Sort materials"
          >
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="mostUnlocked">Most unlocked</SelectItem>
            <SelectItem value="titleAz">Title A–Z</SelectItem>
            <SelectItem value="titleZa">Title Z–A</SelectItem>
            <SelectItem value="easiest">Easiest first</SelectItem>
            <SelectItem value="hardest">Hardest first</SelectItem>
          </Select>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {search.trim() ? 'No materials match your search.' : 'No materials to show.'}
        </p>
      ) : (
        <CatalogMaterialsGrid
          materials={filteredAndSorted}
          subjectId={subjectId}
          topicId={topicId}
          userId={userId}
          unlockedIds={unlockedIds}
          balance={balance}
        />
      )}
    </div>
  );
}
