'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { toast } from 'sonner';

interface Material {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  status: string;
  materialType?: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type SortKey = 'newest' | 'oldest' | 'titleAz' | 'titleZa' | 'draftFirst' | 'publishedFirst' | 'textFirst' | 'practiceFirst';

function getSubjectName(id: string) {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id;
}

function getTopicName(subjectId: string, topicId: string) {
  const topics = (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId];
  return topics?.find((t) => t.id === topicId)?.name ?? topicId;
}

interface MyMaterialsListProps {
  onRefresh?: () => void;
}

export function MyMaterialsList({ onRefresh }: MyMaterialsListProps) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = materials;

    if (q) {
      list = materials.filter((m) => {
        const title = m.title.toLowerCase();
        const subject = getSubjectName(m.subjectId).toLowerCase();
        const topic = getTopicName(m.subjectId, m.topicId).toLowerCase();
        return title.includes(q) || subject.includes(q) || topic.includes(q);
      });
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'titleAz':
          return (a.title ?? '').localeCompare(b.title ?? '');
        case 'titleZa':
          return (b.title ?? '').localeCompare(a.title ?? '');
        case 'draftFirst':
          return (a.status === 'DRAFT' ? 0 : 1) - (b.status === 'DRAFT' ? 0 : 1);
        case 'publishedFirst':
          return (b.status === 'PUBLISHED' ? 0 : 1) - (a.status === 'PUBLISHED' ? 0 : 1);
        case 'textFirst':
          return (a.materialType === 'PRACTICE_TEST' ? 1 : 0) - (b.materialType === 'PRACTICE_TEST' ? 1 : 0);
        case 'practiceFirst':
          return (b.materialType === 'PRACTICE_TEST' ? 1 : 0) - (a.materialType === 'PRACTICE_TEST' ? 1 : 0);
        default:
          return 0;
      }
    });
  }, [materials, search, sort]);

  const fetchMaterials = async () => {
    try {
      const res = await fetch('/api/materials/my-drafts', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMaterials(data);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Refetch when tab becomes visible (e.g. returning from editor or another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchMaterials();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const publish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to publish');
      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? ` +${Number(data.creditsGranted).toFixed(2)} credits`
          : '';
      toast.success(`Material published! It will appear under the topic in the catalog.${creditsMsg}`);
      router.refresh();
      fetchMaterials();
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-24 rounded-md bg-muted animate-pulse" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have not created any materials yet. Click &quot;Create new material&quot; to get started.
      </p>
    );
  }

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
            aria-label="Search materials by title, subject, or topic"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="studio-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            Sort by
          </label>
          <Select
            id="studio-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-[180px]"
            aria-label="Sort materials"
          >
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="titleAz">Title A–Z</SelectItem>
            <SelectItem value="titleZa">Title Z–A</SelectItem>
            <SelectItem value="draftFirst">Draft first</SelectItem>
            <SelectItem value="publishedFirst">Published first</SelectItem>
            <SelectItem value="textFirst">Text first</SelectItem>
            <SelectItem value="practiceFirst">Practice test first</SelectItem>
          </Select>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No materials match your search.
        </p>
      ) : (
        <div className="space-y-3">
      {filteredAndSorted.map((m) => (
        <Card key={m.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{m.title}</CardTitle>
              <CardDescription>
                {getSubjectName(m.subjectId)} → {getTopicName(m.subjectId, m.topicId)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {m.materialType === 'PRACTICE_TEST' ? 'Practice test' : 'Text'}
              </Badge>
              <Badge variant={m.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                {m.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/studio/${m.id}`}>Edit</Link>
            </Button>
            {m.status === 'DRAFT' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => publish(m.id)}
                disabled={publishing === m.id}
              >
                {publishing === m.id ? 'Publishing...' : 'Publish'}
              </Button>
            )}
            {m.status === 'PUBLISHED' && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/catalog/${m.subjectId}/${m.topicId}`}>
                  View in catalog
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
        </div>
      )}
    </div>
  );
}
