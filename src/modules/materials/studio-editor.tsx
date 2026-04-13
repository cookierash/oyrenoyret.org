'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/src/lib/utils';
import { DocumentEditor } from './document-editor';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { useCurriculum } from '@/src/modules/curriculum/use-curriculum';
import { splitObjectives } from '@/src/modules/materials/utils';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';

interface StudioEditorProps {
  mode: 'create' | 'edit';
  materialId?: string;
  initialSubjectId?: string;
  initialTopicId?: string;
  initialTitle?: string;
  initialObjectives?: string;
  initialContent?: string;
  initialDifficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  initialStatus?: 'DRAFT' | 'PUBLISHED';
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
  initialStatus = 'DRAFT',
  onSaved,
}: StudioEditorProps) {
  const { messages, t } = useI18n();
  const editorCopy = messages.studio.editor;
  const { subjects } = useCurriculum();
  const difficultyCopy = messages.materials.difficulty;
  const { canWrite, writeRestriction } = useCurrentUser();
  const writeBlockedMessage = useMemo(
    () => getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified),
    [writeRestriction, messages.auth.errors.emailNotVerified],
  );
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [objectiveSlots, setObjectiveSlots] = useState<string[]>(() => {
    const slots = splitObjectives(initialObjectives);
    while (slots.length < 5) slots.push('');
    return slots.slice(0, 5);
  });
  const [savedObjectives, setSavedObjectives] = useState((initialObjectives || '').trim());
  const [content, setContent] = useState(initialContent || '<p></p>');
  const [savedContent, setSavedContent] = useState(initialContent || '<p></p>');
  const [difficulty, setDifficulty] = useState<'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>(initialDifficulty);
  const [savedDifficulty, setSavedDifficulty] = useState(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'DRAFT' | 'PUBLISHED'>(initialStatus);
  const [draftId, setDraftId] = useState<string | undefined>(materialId);

  const isModified =
    title !== savedTitle ||
    content !== savedContent ||
    objectiveSlots.join('\n').trim() !== savedObjectives ||
    difficulty !== savedDifficulty;

  const isPublished = currentStatus === 'PUBLISHED';

  const topics = useMemo(() => {
    if (!subjectId) return [];
    return subjects.find((subject) => subject.id === subjectId)?.topics ?? [];
  }, [subjectId, subjects]);

  const save = useCallback(async (andPublish = false, skipRedirect = false): Promise<string | undefined> => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    if (!subjectId || !topicId || !title.trim()) {
      toast.error(editorCopy.toast.requiredFields);
      return;
    }
    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');
    const trimmed = content.trim();
    const html = !trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>' ? '' : content;
    if (!html) {
      toast.error(editorCopy.toast.contentRequired);
      return;
    }

    setSaving(true);
    try {
      const targetId = mode === 'create' ? draftId : materialId;
      if (mode === 'create' && !draftId) {
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, topicId, title: title.trim(), objectives: finalObjectives || null, content: html }),
        });
        const created = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            formatErrorToast(editorCopy.toast.createFailed, extractErrorMessage(created)),
          );
          return;
        }

        setDraftId(created.id);
        setSavedTitle(title);
        setSavedContent(content);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedDifficulty(difficulty);

        if (!andPublish && !skipRedirect) {
          toast.success(editorCopy.toast.draftSaved);
          onSaved?.(created.id);
          if (created.id) router.push(`/studio/${created.id}`);
        }
        return created.id;
      } else if (targetId) {
        const res = await fetch(`/api/materials/${targetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            objectives: finalObjectives || null,
            content: html,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(formatErrorToast(editorCopy.toast.saveFailed, extractErrorMessage(data)));
          return;
        }

        setSavedTitle(title);
        setSavedContent(content);
        setSavedObjectives(objectiveSlots.join('\n').trim());
        setSavedDifficulty(difficulty);

        if (!andPublish && !skipRedirect) {
          toast.success(editorCopy.toast.saved);
          if (mode === 'create') {
            router.push(`/studio/${targetId}`);
          }
        }
        router.refresh();
        onSaved?.(targetId);
        return targetId;
      }
    } catch (error) {
      toast.error(
        formatErrorToast(
          editorCopy.toast.saveFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [canWrite, writeBlockedMessage, mode, materialId, draftId, subjectId, topicId, title, objectiveSlots, content, difficulty, router, onSaved, editorCopy.toast.requiredFields, editorCopy.toast.contentRequired]);

  const publish = useCallback(async (confirmed = false) => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    if (!subjectId || !topicId || !title.trim()) {
      toast.error(editorCopy.toast.requiredFields);
      return;
    }

    if (!confirmed) {
      if (mode === 'edit' && materialId) {
        try {
          const res = await fetch(`/api/materials/${materialId}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const existing = splitObjectives(data.objectives ?? '');
            const nextSlots = existing.slice(0, 5);
            while (nextSlots.length < 5) nextSlots.push('');
            setObjectiveSlots(nextSlots);
          }
        } catch {
          /* ignore objective refresh */
        }
      }
      setShowPublishDialog(true);
      return;
    }

    const finalObjectives = objectiveSlots.map(s => s.trim()).filter(Boolean).join('\n');
    if (objectiveSlots.filter(s => s.trim()).length < 2) {
      toast.error(editorCopy.toast.objectivesRequired);
      return;
    }

    setShowPublishDialog(false);
    setPublishing(true);

    try {
      // Step 1: Save draft (and get ID if it's new)
      const currentId = await save(true, true);
      if (!currentId) return;

      const res = await fetch(`/api/materials/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED', difficulty, objectives: finalObjectives }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(formatErrorToast(editorCopy.toast.publishFailed, extractErrorMessage(data)));
        return;
      }

      if (typeof data.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(data.balanceAfter);
      }
      const creditsMsg =
        typeof data.creditsGranted === 'number' && data.creditsGranted > 0
          ? t('studio.editor.toast.creditsSuffix', { count: Math.round(Number(data.creditsGranted)) })
          : '';
      toast.success(t('studio.editor.toast.publishSuccess', { credits: creditsMsg }));

      setCurrentStatus('PUBLISHED');
      router.refresh();
      onSaved?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          editorCopy.toast.publishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setPublishing(false);
    }
  }, [canWrite, writeBlockedMessage, subjectId, topicId, title, objectiveSlots, mode, materialId, difficulty, save, router, onSaved, editorCopy.toast.requiredFields, editorCopy.toast.objectivesRequired, editorCopy.toast.publishFailed, t]);

  const unpublish = useCallback(async () => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    if (!materialId) return;
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(editorCopy.toast.unpublishFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(editorCopy.toast.unpublishSuccess);
      setCurrentStatus('DRAFT');
      router.refresh();
      onSaved?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          editorCopy.toast.unpublishFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setUnpublishing(false);
    }
  }, [canWrite, writeBlockedMessage, materialId, router, onSaved, editorCopy.toast.unpublishFailed, editorCopy.toast.unpublishSuccess]);

  const deleteMaterial = useCallback(async () => {
    if (!canWrite) {
      toast.error(writeBlockedMessage);
      return;
    }
    if (!materialId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(editorCopy.toast.deleteFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(editorCopy.toast.deleteSuccess);
      setShowDeleteDialog(false);
      router.push('/studio');
      router.refresh();
    } catch (error) {
      toast.error(
        formatErrorToast(
          editorCopy.toast.deleteFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setDeleting(false);
    }
  }, [canWrite, writeBlockedMessage, materialId, router, editorCopy.toast.deleteFailed, editorCopy.toast.deleteSuccess]);

  return (
    <div className="flex flex-col h-full pt-6">
      <div className="card-frame bg-card p-6 space-y-4 mb-4 flex-shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 flex-1 max-w-xl">
            <label className="text-sm font-medium">{editorCopy.labels.title}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={editorCopy.labels.titlePlaceholder}
              disabled={!canWrite}
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-0.5">
            {mode === 'edit' && materialId ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!canWrite || deleting || publishing || unpublishing || saving}
                >
                  {deleting ? editorCopy.actions.deleting : editorCopy.actions.delete}
                </Button>
                {isPublished ? (
                  <Button
                    variant="secondary-primary"
                    onClick={unpublish}
                    disabled={!canWrite || deleting || publishing || unpublishing || saving}
                  >
                    {unpublishing ? editorCopy.actions.unpublishing : editorCopy.actions.unpublish}
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="secondary-primary" onClick={() => save(false)} disabled={!canWrite || saving || publishing || unpublishing || deleting}>
              {saving ? editorCopy.actions.saving : editorCopy.actions.saveDraft}
            </Button>
            <Button
              variant="primary"
              onClick={() => publish(false)}
              disabled={!canWrite || publishing || saving || unpublishing || deleting || (isPublished && !isModified)}
            >
              {publishing
                ? editorCopy.actions.publishing
                : mode === 'create'
                  ? editorCopy.actions.savePublish
                : isModified
                    ? editorCopy.actions.savePublish
                    : isPublished
                      ? editorCopy.actions.published
                      : editorCopy.actions.publish}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">{editorCopy.labels.subject}</label>
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              placeholder={editorCopy.labels.subjectPlaceholder}
              disabled={!canWrite || mode === 'edit' || Boolean(draftId)}
            >
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{editorCopy.labels.topic}</label>
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!canWrite || !subjectId || mode === 'edit' || Boolean(draftId)}
              placeholder={editorCopy.labels.topicPlaceholder}
            >
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{editorCopy.labels.difficulty}</label>
            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED')}
              placeholder={editorCopy.labels.difficultyPlaceholder}
              disabled={!canWrite}
            >
              <SelectItem value="BASIC">{difficultyCopy.BASIC}</SelectItem>
              <SelectItem value="INTERMEDIATE">{difficultyCopy.INTERMEDIATE}</SelectItem>
              <SelectItem value="ADVANCED">{difficultyCopy.ADVANCED}</SelectItem>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[500px]">
        <DocumentEditor
          content={content}
          onChange={setContent}
          placeholder={editorCopy.placeholders.document}
          editable={canWrite}
        />
      </div>

      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <div className="space-y-6">
            <header className="space-y-1">
              <AlertDialogTitle>
                {editorCopy.dialog.publishTitle}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {editorCopy.dialog.publishDescription}
              </AlertDialogDescription>
            </header>
            <div className="space-y-4">
              <div className="space-y-2.5">
                {objectiveSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={slot}
                      onChange={(e) => {
                        const newSlots = [...objectiveSlots];
                        newSlots[idx] = e.target.value;
                        setObjectiveSlots(newSlots);
                      }}
                      placeholder={t('studio.editor.placeholders.objective', { count: idx + 1 })}
                      className={cn(
                        "h-10 text-sm transition-all duration-200 flex-1 focus:border-primary/50"
                      )}
                      disabled={!canWrite}
                      autoFocus={idx === 0}
                    />
                  </div>
                ))}
              </div>

            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPublishDialog(false)}
                disabled={publishing}
              >
                {editorCopy.dialog.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  publish(true);
                }}
                disabled={publishing || (isPublished && !isModified) || objectiveSlots.filter(s => s.trim()).length < 2}
              >
                {publishing
                  ? editorCopy.actions.publishing
                  : isModified
                    ? editorCopy.actions.savePublish
                  : isPublished
                    ? editorCopy.actions.alreadyPublished
                      : editorCopy.dialog.publish}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editorCopy.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{editorCopy.deleteDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              {editorCopy.deleteDialog.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteMaterial}
              disabled={deleting}
            >
              {deleting ? editorCopy.actions.deleting : editorCopy.deleteDialog.confirm}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
