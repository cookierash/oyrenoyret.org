'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectItem } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(['', '', '', '', '']);
  const [objectiveTarget, setObjectiveTarget] = useState<{ id: string; title: string } | null>(null);
  const [objectiveError, setObjectiveError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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

  useEffect(() => {
    setPage(1);
  }, [search, sort, materials.length]);

  const visibleMaterials = useMemo(
    () => filteredAndSorted.slice(0, page * pageSize),
    [filteredAndSorted, page, pageSize],
  );

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

  const loadObjectives = async (id: string) => {
    try {
      const res = await fetch(`/api/materials/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load objectives');
      const data = await res.json();
      const existing = (data.objectives ?? '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const nextSlots = existing.slice(0, 5);
      while (nextSlots.length < 5) nextSlots.push('');
      setObjectiveSlots(nextSlots);
      return;
    } catch {
      setObjectiveSlots(['', '', '', '', '']);
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

  const openPublishDialog = async (id: string, title: string) => {
    setObjectiveTarget({ id, title });
    setObjectiveError(null);
    await loadObjectives(id);
    setObjectiveDialogOpen(true);
  };

  const publishWithObjectives = async () => {
    if (!objectiveTarget) return;
    const cleaned = objectiveSlots.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length < 2) {
      setObjectiveError('Please add at least 2 objectives to publish.');
      return;
    }
    setObjectiveError(null);
    setPublishing(objectiveTarget.id);
    try {
      const res = await fetch(`/api/materials/${objectiveTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED', objectives: cleaned.join('\n') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to publish');
      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? ` +${Math.round(Number(data.creditsGranted))} credits`
          : '';
      toast.success(`Material published! It will appear under the topic in the catalog.${creditsMsg}`);
      setObjectiveDialogOpen(false);
      setObjectiveTarget(null);
      setObjectiveError(null);
      router.refresh();
      fetchMaterials();
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(null);
    }
  };

  const unpublish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to unpublish');
      toast.success('Material moved back to drafts.');
      router.refresh();
      fetchMaterials();
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setPublishing(null);
    }
  };

  const deleteMaterial = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      toast.success('Material deleted.');
      router.refresh();
      fetchMaterials();
      onRefresh?.();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const openDeleteDialog = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex-1">
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="card-frame bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-7 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1">
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

      {materials.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <FileText className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            No materials created yet.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click &quot;Create new material&quot; to get started.
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            No materials match your search.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Try a different keyword or clear the filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  <th className="py-2 pr-4 font-medium">Topic</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Updated</th>
                  <th className="py-2 pr-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleMaterials.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 text-sm text-foreground">
                    <td className="py-3 pr-4 min-w-[220px]">
                      <div className="font-medium">{m.title}</div>
                    </td>
                    <td className="py-3 pr-4 min-w-[160px]">
                      {getSubjectName(m.subjectId)}
                    </td>
                    <td className="py-3 pr-4 min-w-[180px]">
                      {getTopicName(m.subjectId, m.topicId)}
                    </td>
                    <td className="py-3 pr-4 min-w-[140px]">
                      <Badge variant="outline" className="text-xs">
                        {m.materialType === 'PRACTICE_TEST' ? 'Practice test' : 'Text'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 min-w-[120px]">
                      <Badge variant={m.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {m.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 min-w-[140px] text-muted-foreground">
                      {new Date(m.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex justify-start gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openDeleteDialog(m.id, m.title)}
                          disabled={deleting === m.id}
                        >
                          {deleting === m.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      {m.status === 'PUBLISHED' ? (
                        <Button
                          variant="secondary-primary"
                          size="sm"
                          onClick={() => unpublish(m.id)}
                          disabled={publishing === m.id}
                        >
                          {publishing === m.id ? 'Unpublishing...' : 'Unpublish'}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openPublishDialog(m.id, m.title)}
                          disabled={publishing === m.id}
                        >
                          {publishing === m.id ? 'Publishing...' : 'Publish'}
                        </Button>
                      )}
                        <Button variant="secondary-primary" size="sm" asChild>
                          <Link href={`/studio/${m.id}`}>Edit</Link>
                        </Button>
                        {m.status === 'PUBLISHED' && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/catalog/${m.subjectId}/${m.topicId}`}>
                              View in catalog
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page * pageSize < filteredAndSorted.length ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
              >
                Load more items
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <AlertDialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set learning objectives</AlertDialogTitle>
            <AlertDialogDescription>
              Add learning objectives for {objectiveTarget?.title ? `"${objectiveTarget.title}"` : 'this material'}. Please enter at least two objectives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {objectiveSlots.map((slot, idx) => (
              <Input
                key={idx}
                value={slot}
                onChange={(e) => {
                  const next = [...objectiveSlots];
                  next[idx] = e.target.value;
                  setObjectiveSlots(next);
                  if (objectiveError) setObjectiveError(null);
                }}
                placeholder={`Objective ${idx + 1}`}
                className="h-9 text-sm"
                autoFocus={idx === 0}
              />
            ))}
            {objectiveError ? (
              <p className="text-xs text-destructive">{objectiveError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setObjectiveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={publishWithObjectives}
                disabled={publishing === objectiveTarget?.id}
              >
                {publishing === objectiveTarget?.id ? 'Publishing...' : 'Publish'}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete material?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.title ? `"${deleteTarget.title}"` : 'this material'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={Boolean(deleting)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteTarget && deleteMaterial(deleteTarget.id)}
              disabled={Boolean(deleting)}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
