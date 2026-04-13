'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PiFileText as FileText, PiMagnifyingGlass as Search } from 'react-icons/pi';
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
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { getLocaleCode } from '@/src/i18n';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';
import { useCurriculum } from '@/src/modules/curriculum/use-curriculum';
import { splitObjectives } from '@/src/modules/materials/utils';

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

interface MyMaterialsListProps {
  onRefresh?: () => void;
}

export function MyMaterialsList({ onRefresh }: MyMaterialsListProps) {
  const router = useRouter();
  const { locale, messages, t } = useI18n();
  const copy = messages.studio.list;
  const { canWrite, writeRestriction } = useCurrentUser();
  const writeBlockedMessage = useMemo(
    () => getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified),
    [writeRestriction, messages.auth.errors.emailNotVerified],
  );
  const localeCode = getLocaleCode(locale);
  const { subjectNameMap, topicNameMap, subjectHrefMap, topicHrefMap } = useCurriculum();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [localeCode],
  );
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
        const subject = (subjectNameMap.get(m.subjectId) ?? m.subjectId).toLowerCase();
        const topic = (topicNameMap.get(`${m.subjectId}:${m.topicId}`) ?? m.topicId).toLowerCase();
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
  }, [materials, search, sort, subjectNameMap]);

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
      const existing = splitObjectives(data.objectives ?? '');
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
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    setObjectiveTarget({ id, title });
    setObjectiveError(null);
    await loadObjectives(id);
    setObjectiveDialogOpen(true);
  };

  const publishWithObjectives = async () => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    if (!objectiveTarget) return;
    const cleaned = objectiveSlots.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length < 2) {
      setObjectiveError(copy.objectives.error);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toast.publishFailed, extractErrorMessage(data)));
        return;
      }
      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? t('studio.list.creditsSuffix', { count: Math.round(Number(data.creditsGranted)) })
          : '';
      toast.success(t('studio.list.toast.publishSuccess', { credits: creditsMsg }));
      setObjectiveDialogOpen(false);
      setObjectiveTarget(null);
      setObjectiveError(null);
      router.refresh();
      fetchMaterials();
      onRefresh?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toast.publishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setPublishing(null);
    }
  };

  const unpublish = async (id: string) => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    setPublishing(id);
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toast.unpublishFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(copy.toast.unpublishSuccess);
      router.refresh();
      fetchMaterials();
      onRefresh?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.toast.unpublishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setPublishing(null);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.toast.deleteFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(copy.toast.deleteSuccess);
      router.refresh();
      fetchMaterials();
      onRefresh?.();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.toast.deleteFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setDeleting(null);
    }
  };

  const openDeleteDialog = (id: string, title: string) => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
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
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label={copy.searchLabel}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="studio-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            {copy.sortLabel}
          </label>
          <Select
            id="studio-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-[180px]"
            aria-label={copy.sortLabel}
          >
            <SelectItem value="newest">{copy.sortOptions.newest}</SelectItem>
            <SelectItem value="oldest">{copy.sortOptions.oldest}</SelectItem>
            <SelectItem value="titleAz">{copy.sortOptions.titleAz}</SelectItem>
            <SelectItem value="titleZa">{copy.sortOptions.titleZa}</SelectItem>
            <SelectItem value="draftFirst">{copy.sortOptions.draftFirst}</SelectItem>
            <SelectItem value="publishedFirst">{copy.sortOptions.publishedFirst}</SelectItem>
            <SelectItem value="textFirst">{copy.sortOptions.textFirst}</SelectItem>
            <SelectItem value="practiceFirst">{copy.sortOptions.practiceFirst}</SelectItem>
          </Select>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <FileText className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            {copy.emptyTitle}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {copy.emptyHint}
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            {copy.emptySearchTitle}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {copy.emptySearchHint}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{copy.table.title}</th>
                  <th className="py-2 pr-4 font-medium">{copy.table.subject}</th>
                  <th className="py-2 pr-4 font-medium">{copy.table.topic}</th>
                  <th className="py-2 pr-4 font-medium">{copy.table.type}</th>
                  <th className="py-2 pr-4 font-medium">{copy.table.status}</th>
                  <th className="py-2 pr-4 font-medium">{copy.table.updated}</th>
                  <th className="py-2 pr-2 text-right font-medium">{copy.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visibleMaterials.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 text-sm text-foreground">
                    <td className="py-3 pr-4 min-w-[220px]">
                      <div className="font-medium">{m.title}</div>
                    </td>
                    <td className="py-3 pr-4 min-w-[160px]">
                      {subjectNameMap.get(m.subjectId) ?? m.subjectId}
                    </td>
                    <td className="py-3 pr-4 min-w-[180px]">
                      {topicNameMap.get(`${m.subjectId}:${m.topicId}`) ?? m.topicId}
                    </td>
                    <td className="py-3 pr-4 min-w-[140px]">
                      <Badge variant="outline" className="text-xs">
                        {m.materialType === 'PRACTICE_TEST' ? copy.type.practice : copy.type.text}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 min-w-[120px]">
                      <Badge variant={m.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {m.status === 'PUBLISHED' ? copy.status.published : copy.status.draft}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 min-w-[140px] text-muted-foreground">
                      {dateFormatter.format(new Date(m.updatedAt))}
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex justify-start gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openDeleteDialog(m.id, m.title)}
                          disabled={!canWrite || deleting === m.id}
                        >
                          {deleting === m.id ? copy.actions.deleting : copy.actions.delete}
                        </Button>
                      {m.status === 'PUBLISHED' ? (
                        <Button
                          variant="secondary-primary"
                          size="sm"
                          onClick={() => unpublish(m.id)}
                          disabled={!canWrite || publishing === m.id}
                        >
                          {publishing === m.id ? copy.actions.unpublishing : copy.actions.unpublish}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openPublishDialog(m.id, m.title)}
                          disabled={!canWrite || publishing === m.id}
                        >
                          {publishing === m.id ? copy.actions.publishing : copy.actions.publish}
                        </Button>
                      )}
                        {canWrite ? (
                          <Button variant="secondary-primary" size="sm" asChild>
                            <Link href={`/studio/${m.id}`}>{copy.actions.edit}</Link>
                          </Button>
                        ) : (
                          <Button variant="secondary-primary" size="sm" disabled>
                            {copy.actions.edit}
                          </Button>
                        )}
                        {m.status === 'PUBLISHED' && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={`/catalog/${
                                subjectHrefMap.get(m.subjectId) ?? m.subjectId
                              }/${
                                topicHrefMap.get(`${m.subjectId}:${m.topicId}`) ?? m.topicId
                              }`}
                            >
                              {copy.actions.viewCatalog}
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
                {copy.actions.loadMore}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <AlertDialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.objectives.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('studio.list.objectives.description', {
                title: objectiveTarget?.title ? `"${objectiveTarget.title}"` : copy.objectives.materialFallback,
              })}
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
                placeholder={t('studio.list.objectives.placeholder', { count: idx + 1 })}
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
                {copy.objectives.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={publishWithObjectives}
                disabled={!canWrite || publishing === objectiveTarget?.id}
              >
                {publishing === objectiveTarget?.id ? copy.objectives.publishing : copy.objectives.publish}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('studio.list.deleteDialog.description', {
                title: deleteTarget?.title ? `"${deleteTarget.title}"` : copy.deleteDialog.materialFallback,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={Boolean(deleting)}
            >
              {copy.deleteDialog.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteTarget && deleteMaterial(deleteTarget.id)}
              disabled={Boolean(deleting)}
            >
              {deleting ? copy.deleteDialog.deleting : copy.deleteDialog.confirm}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
