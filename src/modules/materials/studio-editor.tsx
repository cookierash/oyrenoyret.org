'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { DocumentEditor } from './document-editor';
import { SUBJECTS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { toast } from 'sonner';

interface StudioEditorProps {
  mode: 'create' | 'edit';
  materialId?: string;
  initialSubjectId?: string;
  initialTopicId?: string;
  initialTitle?: string;
  initialObjectives?: string;
  initialContent?: string;
  initialDifficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  onSaved?: (newMaterialId?: string) => void;
}

export function StudioEditor({
  mode,
  materialId,
  initialSubjectId = '',
  initialTopicId = '',
  initialTitle = '',
  initialObjectives = '',
  initialContent = '',
  initialDifficulty = 'BASIC',
  onSaved,
}: StudioEditorProps) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [title, setTitle] = useState(initialTitle);
  const [objectives, setObjectives] = useState(initialObjectives);
  const [content, setContent] = useState(initialContent || '<p></p>');
  const [difficulty, setDifficulty] = useState<'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const topics = subjectId
    ? (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId] ?? []
    : [];

  const save = useCallback(async (andPublish = false) => {
    if (!subjectId || !topicId || !title.trim()) {
      toast.error('Subject, topic, and title are required');
      return;
    }
    if (andPublish && !objectives.trim()) {
      toast.error('Lesson objectives are required to publish');
      return;
    }
    const trimmed = content.trim();
    const html = !trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>' ? '' : content;
    if (!html) {
      toast.error('Add some content before saving');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, topicId, title: title.trim(), objectives: objectives.trim() || null, content: html }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create');
        }
        const created = await res.json();
        if (andPublish && created.id) {
          const pubRes = await fetch(`/api/materials/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PUBLISHED', difficulty, objectives: objectives.trim() }),
          });
          const pubData = await pubRes.json();
          if (!pubRes.ok) throw new Error(pubData.error ?? 'Failed to publish');
          if (typeof pubData.balanceAfter === 'number') {
            (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(pubData.balanceAfter);
          }
          const creditsMsg =
            typeof pubData.creditsGranted === 'number' && pubData.creditsGranted > 0
              ? ` +${Number(pubData.creditsGranted).toFixed(2)} credits`
              : '';
          toast.success(`Published! Your material is now visible in the catalog.${creditsMsg}`);
          onSaved?.(created.id);
          router.push('/studio');
          // Refresh after nav so layout re-fetches credits (sidebar was not mounted during create)
          setTimeout(() => router.refresh(), 150);
          return;
        }
        toast.success('Draft saved');
        onSaved?.(created.id);
        if (created.id) router.push(`/studio/${created.id}`);
        return;
      } else if (materialId) {
        const res = await fetch(`/api/materials/${materialId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), objectives: objectives.trim() || null, content: html }),
        });
        if (!res.ok) throw new Error('Failed to save');
        toast.success('Saved');
      }
      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [mode, materialId, subjectId, topicId, title, objectives, content, router, onSaved]);

  const publish = useCallback(async () => {
    if (mode === 'create') {
      setPublishing(true);
      try {
        await save(true);
      } finally {
        setPublishing(false);
      }
      return;
    }
    if (!materialId) return;
    if (!objectives.trim()) {
      toast.error('Lesson objectives are required to publish');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED', difficulty, objectives: objectives.trim() }),
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
      toast.success(`Published! Your material is now visible in the catalog.${creditsMsg}`);
      router.refresh();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }, [mode, materialId, difficulty, objectives, save, router, onSaved]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 pb-4 border-b border-border mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="text-lg font-medium max-w-md border-0 shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              placeholder="Subject"
              disabled={mode === 'edit'}
            >
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </Select>
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId || mode === 'edit'}
              placeholder="Topic"
            >
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </Select>
            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')}
              placeholder="Difficulty"
            >
              <SelectItem value="BASIC">Basic</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="ADVANCED">Advanced</SelectItem>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="primary" size="sm" onClick={publish} disabled={publishing || saving}>
                {publishing ? 'Publishing...' : mode === 'create' ? 'Save & Publish' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Objectives (required for publishing)</label>
          <Input
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="What will learners achieve?"
            className="text-sm"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <DocumentEditor
          content={content}
          onChange={setContent}
          placeholder="Start writing your material..."
          editable
        />
      </div>
    </div>
  );
}
