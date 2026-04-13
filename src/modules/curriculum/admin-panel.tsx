'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { cn } from '@/src/lib/utils';
import { isValidSlug, normalizeSlug } from '@/src/modules/curriculum/slug';

type CurriculumTopic = {
  id: string;
  slug: string;
  slugAz: string;
  nameEn: string;
  nameAz: string;
};

type CurriculumSubject = {
  id: string;
  slug: string;
  slugAz: string;
  nameEn: string;
  nameAz: string;
  descriptionEn: string | null;
  descriptionAz: string | null;
  topics: CurriculumTopic[];
};

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  return data as any;
}

export function CurriculumAdminPanel() {
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [subjectsQuery, setSubjectsQuery] = useState('');
  const [topicsQuery, setTopicsQuery] = useState('');
  const [deleteSubjectOpen, setDeleteSubjectOpen] = useState(false);
  const [deleteTopicOpen, setDeleteTopicOpen] = useState(false);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );
  const selectedTopic = useMemo(
    () => selectedSubject?.topics.find((t) => t.id === selectedTopicId) ?? null,
    [selectedSubject, selectedTopicId],
  );

  const [newSubject, setNewSubject] = useState({
    slug: '',
    slugAz: '',
    nameEn: '',
    nameAz: '',
    descriptionEn: '',
    descriptionAz: '',
  });
  const [subjectEdit, setSubjectEdit] = useState({
    slug: '',
    slugAz: '',
    nameEn: '',
    nameAz: '',
    descriptionEn: '',
    descriptionAz: '',
  });

  const [newTopic, setNewTopic] = useState({ slug: '', slugAz: '', nameEn: '', nameAz: '' });
  const [topicEdit, setTopicEdit] = useState({ slug: '', slugAz: '', nameEn: '', nameAz: '' });

  const filteredSubjects = useMemo(() => {
    const q = subjectsQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) =>
      [s.slug, s.nameEn, s.nameAz].some((field) => field.toLowerCase().includes(q)),
    );
  }, [subjects, subjectsQuery]);

  const filteredTopics = useMemo(() => {
    const list = selectedSubject?.topics ?? [];
    const q = topicsQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      [t.slug, t.nameEn, t.nameAz].some((field) => field.toLowerCase().includes(q)),
    );
  }, [selectedSubject?.topics, topicsQuery]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/curriculum/subjects', { cache: 'no-store' });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Failed to load');
      const list = Array.isArray(data?.subjects) ? (data.subjects as CurriculumSubject[]) : [];
      setSubjects(list);
      if (!selectedSubjectId && list.length > 0) {
        setSelectedSubjectId(list[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load curriculum');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    setSubjectEdit({
      slug: selectedSubject.slug,
      slugAz: selectedSubject.slugAz,
      nameEn: selectedSubject.nameEn,
      nameAz: selectedSubject.nameAz,
      descriptionEn: selectedSubject.descriptionEn ?? '',
      descriptionAz: selectedSubject.descriptionAz ?? '',
    });
    setSelectedTopicId('');
    setNewTopic({ slug: '', slugAz: '', nameEn: '', nameAz: '' });
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!selectedTopic) return;
    setTopicEdit({
      slug: selectedTopic.slug,
      slugAz: selectedTopic.slugAz,
      nameEn: selectedTopic.nameEn,
      nameAz: selectedTopic.nameAz,
    });
  }, [selectedTopicId]);

  const createSubject = async () => {
    try {
      const res = await fetch('/api/curriculum/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubject),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to create subject.', extractErrorMessage(data)));
        return;
      }
      toast.success('Subject created.');
      setNewSubject({
        slug: '',
        slugAz: '',
        nameEn: '',
        nameAz: '',
        descriptionEn: '',
        descriptionAz: '',
      });
      await load();
      if (typeof data?.id === 'string' && data.id) {
        setSelectedSubjectId(data.id);
      }
    } catch (error) {
      toast.error(formatErrorToast('Failed to create subject.', error instanceof Error ? error.message : null));
    }
  };

  const saveSubject = async () => {
    if (!selectedSubject) return;
    try {
      const res = await fetch(`/api/curriculum/subjects/${encodeURIComponent(selectedSubject.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...subjectEdit,
          descriptionEn: subjectEdit.descriptionEn.trim() ? subjectEdit.descriptionEn : null,
          descriptionAz: subjectEdit.descriptionAz.trim() ? subjectEdit.descriptionAz : null,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to save subject.', extractErrorMessage(data)));
        return;
      }
      toast.success('Subject saved.');
      await load();
      if (data && typeof data === 'object') {
        setSubjectEdit({
          slug: typeof data.slug === 'string' ? data.slug : subjectEdit.slug,
          slugAz: typeof data.slugAz === 'string' ? data.slugAz : subjectEdit.slugAz,
          nameEn: typeof data.nameEn === 'string' ? data.nameEn : subjectEdit.nameEn,
          nameAz: typeof data.nameAz === 'string' ? data.nameAz : subjectEdit.nameAz,
          descriptionEn: typeof data.descriptionEn === 'string' ? data.descriptionEn : '',
          descriptionAz: typeof data.descriptionAz === 'string' ? data.descriptionAz : '',
        });
      }
    } catch (error) {
      toast.error(formatErrorToast('Failed to save subject.', error instanceof Error ? error.message : null));
    }
  };

  const deleteSubject = async () => {
    if (!selectedSubject) return;
    try {
      const res = await fetch(`/api/curriculum/subjects/${encodeURIComponent(selectedSubject.id)}`, {
        method: 'DELETE',
      });
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to delete subject.', extractErrorMessage(data)));
        return;
      }
      toast.success('Subject deleted.');
      setSelectedSubjectId('');
      setDeleteSubjectOpen(false);
      await load();
    } catch (error) {
      toast.error(formatErrorToast('Failed to delete subject.', error instanceof Error ? error.message : null));
    }
  };

  const createTopic = async () => {
    if (!selectedSubject) return;
    try {
      const res = await fetch(
        `/api/curriculum/subjects/${encodeURIComponent(selectedSubject.id)}/topics`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTopic),
        },
      );
      const data = await parseJson(res);
      if (!res.ok) {
        const message = extractErrorMessage(data);
        const hint = message && /subject not found/i.test(message)
          ? 'Subject not found in the database. Seed defaults or create the subject first.'
          : message;
        toast.error(formatErrorToast('Failed to create topic.', hint));
        return;
      }
      toast.success('Topic created.');
      setNewTopic({ slug: '', slugAz: '', nameEn: '', nameAz: '' });
      await load();
      if (typeof data?.id === 'string' && data.id) {
        setSelectedTopicId(data.id);
      }
    } catch (error) {
      toast.error(formatErrorToast('Failed to create topic.', error instanceof Error ? error.message : null));
    }
  };

  const saveTopic = async () => {
    if (!selectedSubject || !selectedTopic) return;
    try {
      const res = await fetch(
        `/api/curriculum/subjects/${encodeURIComponent(selectedSubject.id)}/topics/${encodeURIComponent(selectedTopic.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(topicEdit),
        },
      );
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to save topic.', extractErrorMessage(data)));
        return;
      }
      toast.success('Topic saved.');
      await load();
      if (data && typeof data === 'object') {
        setTopicEdit({
          slug: typeof data.slug === 'string' ? data.slug : topicEdit.slug,
          slugAz: typeof data.slugAz === 'string' ? data.slugAz : topicEdit.slugAz,
          nameEn: typeof data.nameEn === 'string' ? data.nameEn : topicEdit.nameEn,
          nameAz: typeof data.nameAz === 'string' ? data.nameAz : topicEdit.nameAz,
        });
      }
    } catch (error) {
      toast.error(formatErrorToast('Failed to save topic.', error instanceof Error ? error.message : null));
    }
  };

  const deleteTopic = async () => {
    if (!selectedSubject || !selectedTopic) return;
    try {
      const res = await fetch(
        `/api/curriculum/subjects/${encodeURIComponent(selectedSubject.id)}/topics/${encodeURIComponent(selectedTopic.id)}`,
        { method: 'DELETE' },
      );
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to delete topic.', extractErrorMessage(data)));
        return;
      }
      toast.success('Topic deleted.');
      setSelectedTopicId('');
      setDeleteTopicOpen(false);
      await load();
    } catch (error) {
      toast.error(formatErrorToast('Failed to delete topic.', error instanceof Error ? error.message : null));
    }
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/curriculum/seed', { method: 'POST' });
      const data = await parseJson(res);
      if (!res.ok) {
        toast.error(formatErrorToast('Failed to initialize curriculum.', extractErrorMessage(data)));
        return;
      }
      toast.success(data?.seeded ? 'Curriculum initialized.' : 'Curriculum already initialized.');
      await load();
    } catch (error) {
      toast.error(
        formatErrorToast('Failed to initialize curriculum.', error instanceof Error ? error.message : null),
      );
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-frame bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="card-frame bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  const subjectSlugPreview = newSubject.slug ? normalizeSlug(newSubject.slug) : '';
  const subjectSlugAzPreview = newSubject.slugAz ? normalizeSlug(newSubject.slugAz) : '';
  const subjectEditSlugPreview = subjectEdit.slug ? normalizeSlug(subjectEdit.slug) : '';
  const subjectEditSlugAzPreview = subjectEdit.slugAz ? normalizeSlug(subjectEdit.slugAz) : '';
  const topicSlugPreview = newTopic.slug ? normalizeSlug(newTopic.slug) : '';
  const topicSlugAzPreview = newTopic.slugAz ? normalizeSlug(newTopic.slugAz) : '';
  const topicEditSlugPreview = topicEdit.slug ? normalizeSlug(topicEdit.slug) : '';
  const topicEditSlugAzPreview = topicEdit.slugAz ? normalizeSlug(topicEdit.slugAz) : '';

  const canCreateSubject =
    isValidSlug(subjectSlugPreview) &&
    isValidSlug(subjectSlugAzPreview) &&
    Boolean(newSubject.nameEn.trim()) &&
    Boolean(newSubject.nameAz.trim());
  const canSaveSubject =
    Boolean(selectedSubject) &&
    isValidSlug(subjectEditSlugPreview) &&
    isValidSlug(subjectEditSlugAzPreview) &&
    Boolean(subjectEdit.nameEn.trim()) &&
    Boolean(subjectEdit.nameAz.trim());

  const canCreateTopic =
    Boolean(selectedSubject) &&
    isValidSlug(topicSlugPreview) &&
    isValidSlug(topicSlugAzPreview) &&
    Boolean(newTopic.nameEn.trim()) &&
    Boolean(newTopic.nameAz.trim());
  const canSaveTopic =
    Boolean(selectedSubject) &&
    Boolean(selectedTopic) &&
    isValidSlug(topicEditSlugPreview) &&
    isValidSlug(topicEditSlugAzPreview) &&
    Boolean(topicEdit.nameEn.trim()) &&
    Boolean(topicEdit.nameAz.trim());

  return (
    <Tabs defaultValue="subjects" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          {subjects.length === 0 ? (
            <Button size="sm" variant="secondary-primary" onClick={seedDefaults} disabled={seeding}>
              {seeding ? 'Seeding…' : 'Seed defaults'}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={load} disabled={seeding}>
            Refresh
          </Button>
        </div>
      </div>

      <TabsContent value="subjects" className="mt-0">
        <section className="card-frame bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <h2 className="text-sm font-medium text-foreground">Subjects</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedSubjectId('');
                setSelectedTopicId('');
                setSubjectsQuery('');
                setNewSubject({
                  slug: '',
                  slugAz: '',
                  nameEn: '',
                  nameAz: '',
                  descriptionEn: '',
                  descriptionAz: '',
                });
              }}
            >
              New
            </Button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="subjects-search">Search</Label>
                <Input
                  id="subjects-search"
                  value={subjectsQuery}
                  onChange={(e) => setSubjectsQuery(e.target.value)}
                  placeholder="Search slug or name…"
                />
              </div>

              <div
                className="max-h-[60dvh] overflow-y-auto rounded-md border border-border bg-background/40 p-1"
                role="listbox"
                aria-label="Subjects"
              >
                {filteredSubjects.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No subjects.</div>
                ) : (
                  filteredSubjects.map((subject) => {
                    const active = subject.id === selectedSubjectId;
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setSelectedSubjectId(subject.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                          active ? 'bg-muted/70' : 'hover:bg-muted/40',
                        )}
                        role="option"
                        aria-selected={active}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{subject.nameEn}</div>
                          <div className="text-xs text-muted-foreground truncate">{subject.slug}</div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {subject.topics.length} topics
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  {selectedSubject ? 'Edit subject' : 'Create subject'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Slug accepts English or Azerbaijani characters. Saved as a URL-safe slug.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="subject-slug-en">Slug (EN)</Label>
                    <Input
                      id="subject-slug-en"
                      value={selectedSubject ? subjectEdit.slug : newSubject.slug}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, slug: value }));
                        } else {
                          setNewSubject((p) => ({ ...p, slug: value }));
                        }
                      }}
                      placeholder="e.g. mathematics"
                      aria-describedby="subject-slug-en-help"
                    />
                    <div id="subject-slug-en-help" className="text-[11px] text-muted-foreground">
                      Preview:{' '}
                      <span
                        className={cn(
                          'font-mono',
                          (selectedSubject ? subjectEditSlugPreview : subjectSlugPreview) &&
                            !isValidSlug(selectedSubject ? subjectEditSlugPreview : subjectSlugPreview)
                            ? 'text-destructive'
                            : '',
                        )}
                      >
                        {selectedSubject ? subjectEditSlugPreview : subjectSlugPreview || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="subject-slug-az">Slug (AZ)</Label>
                    <Input
                      id="subject-slug-az"
                      value={selectedSubject ? subjectEdit.slugAz : newSubject.slugAz}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, slugAz: value }));
                        } else {
                          setNewSubject((p) => ({ ...p, slugAz: value }));
                        }
                      }}
                      placeholder="e.g. riyaziyyat"
                      aria-describedby="subject-slug-az-help"
                    />
                    <div id="subject-slug-az-help" className="text-[11px] text-muted-foreground">
                      Preview:{' '}
                      <span
                        className={cn(
                          'font-mono',
                          (selectedSubject ? subjectEditSlugAzPreview : subjectSlugAzPreview) &&
                            !isValidSlug(selectedSubject ? subjectEditSlugAzPreview : subjectSlugAzPreview)
                            ? 'text-destructive'
                            : '',
                        )}
                      >
                        {selectedSubject
                          ? subjectEditSlugAzPreview
                          : subjectSlugAzPreview || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="subject-name-en">Name (EN)</Label>
                    <Input
                      id="subject-name-en"
                      value={selectedSubject ? subjectEdit.nameEn : newSubject.nameEn}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, nameEn: value }));
                        } else {
                          setNewSubject((p) => ({
                            ...p,
                            nameEn: value,
                            slug: p.slug.trim() ? p.slug : value,
                          }));
                        }
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="subject-name-az">Ad (AZ)</Label>
                    <Input
                      id="subject-name-az"
                      value={selectedSubject ? subjectEdit.nameAz : newSubject.nameAz}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, nameAz: value }));
                        } else {
                          setNewSubject((p) => ({
                            ...p,
                            nameAz: value,
                            slugAz: p.slugAz.trim() ? p.slugAz : value,
                          }));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="subject-desc-en">Description (EN)</Label>
                    <textarea
                      id="subject-desc-en"
                      value={selectedSubject ? subjectEdit.descriptionEn : newSubject.descriptionEn}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, descriptionEn: value }));
                        } else {
                          setNewSubject((p) => ({ ...p, descriptionEn: value }));
                        }
                      }}
                      className="min-h-[88px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="subject-desc-az">Təsvir (AZ)</Label>
                    <textarea
                      id="subject-desc-az"
                      value={selectedSubject ? subjectEdit.descriptionAz : newSubject.descriptionAz}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (selectedSubject) {
                          setSubjectEdit((p) => ({ ...p, descriptionAz: value }));
                        } else {
                          setNewSubject((p) => ({ ...p, descriptionAz: value }));
                        }
                      }}
                      className="min-h-[88px] max-h-[420px] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedSubject ? (
                    <>
                      <Button onClick={saveSubject} size="sm" variant="secondary-primary" disabled={!canSaveSubject}>
                        Save
                      </Button>
                      <Button onClick={() => setDeleteSubjectOpen(true)} size="sm" variant="danger">
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button onClick={createSubject} size="sm" disabled={!canCreateSubject}>
                      Create
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="topics" className="mt-0">
        <section className="card-frame bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <h2 className="text-sm font-medium text-foreground">Topics</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedTopicId('');
                setTopicsQuery('');
                setNewTopic({ slug: '', slugAz: '', nameEn: '', nameAz: '' });
              }}
              disabled={!selectedSubject}
            >
              New
            </Button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="topics-subject">Subject</Label>
                <Select
                  id="topics-subject"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  placeholder="Select a subject…"
                >
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nameEn} ({s.slug})
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics-search">Search</Label>
                <Input
                  id="topics-search"
                  value={topicsQuery}
                  onChange={(e) => setTopicsQuery(e.target.value)}
                  placeholder="Search slug or name…"
                  disabled={!selectedSubject}
                />
              </div>

              <div
                className={cn(
                  'max-h-[60dvh] overflow-y-auto rounded-md border border-border bg-background/40 p-1',
                  !selectedSubject && 'opacity-60',
                )}
                role="listbox"
                aria-label="Topics"
              >
                {!selectedSubject ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Select a subject.</div>
                ) : filteredTopics.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No topics.</div>
                ) : (
                  filteredTopics.map((topic) => {
                    const active = topic.id === selectedTopicId;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                          active ? 'bg-muted/70' : 'hover:bg-muted/40',
                        )}
                        role="option"
                        aria-selected={active}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{topic.nameEn}</div>
                          <div className="text-xs text-muted-foreground truncate">{topic.slug}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  {selectedTopic ? 'Edit topic' : 'Create topic'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Slug accepts English or Azerbaijani characters. Saved as a URL-safe slug.
                </p>
              </div>

              {!selectedSubject ? (
                <p className="text-sm text-muted-foreground">Select a subject to manage its topics.</p>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="topic-slug-en">Slug (EN)</Label>
                      <Input
                        id="topic-slug-en"
                        value={selectedTopic ? topicEdit.slug : newTopic.slug}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (selectedTopic) {
                            setTopicEdit((p) => ({ ...p, slug: value }));
                          } else {
                            setNewTopic((p) => ({ ...p, slug: value }));
                          }
                        }}
                        placeholder="e.g. algebra"
                        aria-describedby="topic-slug-en-help"
                      />
                      <div id="topic-slug-en-help" className="text-[11px] text-muted-foreground">
                        Preview:{' '}
                        <span
                          className={cn(
                            'font-mono',
                            (selectedTopic ? topicEditSlugPreview : topicSlugPreview) &&
                              !isValidSlug(selectedTopic ? topicEditSlugPreview : topicSlugPreview)
                              ? 'text-destructive'
                              : '',
                          )}
                        >
                          {selectedTopic ? topicEditSlugPreview : topicSlugPreview || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="topic-slug-az">Slug (AZ)</Label>
                      <Input
                        id="topic-slug-az"
                        value={selectedTopic ? topicEdit.slugAz : newTopic.slugAz}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (selectedTopic) {
                            setTopicEdit((p) => ({ ...p, slugAz: value }));
                          } else {
                            setNewTopic((p) => ({ ...p, slugAz: value }));
                          }
                        }}
                        placeholder="e.g. cebr"
                        aria-describedby="topic-slug-az-help"
                      />
                      <div id="topic-slug-az-help" className="text-[11px] text-muted-foreground">
                        Preview:{' '}
                        <span
                          className={cn(
                            'font-mono',
                            (selectedTopic ? topicEditSlugAzPreview : topicSlugAzPreview) &&
                              !isValidSlug(selectedTopic ? topicEditSlugAzPreview : topicSlugAzPreview)
                              ? 'text-destructive'
                              : '',
                          )}
                        >
                          {selectedTopic
                            ? topicEditSlugAzPreview
                            : topicSlugAzPreview || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="topic-name-en">Name (EN)</Label>
                      <Input
                        id="topic-name-en"
                        value={selectedTopic ? topicEdit.nameEn : newTopic.nameEn}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (selectedTopic) {
                            setTopicEdit((p) => ({ ...p, nameEn: value }));
                          } else {
                            setNewTopic((p) => ({
                              ...p,
                              nameEn: value,
                              slug: p.slug.trim() ? p.slug : value,
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="topic-name-az">Ad (AZ)</Label>
                      <Input
                        id="topic-name-az"
                        value={selectedTopic ? topicEdit.nameAz : newTopic.nameAz}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (selectedTopic) {
                            setTopicEdit((p) => ({ ...p, nameAz: value }));
                          } else {
                            setNewTopic((p) => ({
                              ...p,
                              nameAz: value,
                              slugAz: p.slugAz.trim() ? p.slugAz : value,
                            }));
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedTopic ? (
                      <>
                        <Button onClick={saveTopic} size="sm" variant="secondary-primary" disabled={!canSaveTopic}>
                          Save
                        </Button>
                        <Button onClick={() => setDeleteTopicOpen(true)} size="sm" variant="danger">
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button onClick={createTopic} size="sm" disabled={!canCreateTopic}>
                        Create
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </TabsContent>

      <AlertDialog open={deleteSubjectOpen} onOpenChange={setDeleteSubjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subject?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSubject
                ? `This hides "${selectedSubject.slug}" from the catalog and materials. You can recreate it later.`
                : 'This hides the subject from the catalog.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSubject}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTopicOpen} onOpenChange={setDeleteTopicOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete topic?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTopic
                ? `This hides "${selectedTopic.slug}" from the catalog and materials. You can recreate it later.`
                : 'This hides the topic from the catalog.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTopic}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
