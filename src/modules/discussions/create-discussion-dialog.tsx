'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { CompactRichText, type CompactRichTextImage, type CompactRichTextStats } from '@/src/components/rich-text/compact-rich-text';
import { discussionRichTextHasContent } from '@/src/lib/discussion-rich-text';
import { appendDiscussionAttachmentsToHtml } from '@/src/lib/discussion-attachments';
import { useCurriculum } from '@/src/modules/curriculum/use-curriculum';
import { CONTENT_LIMITS } from '@/src/config/constants';
import { MAX_DISCUSSION_IMAGES } from '@/src/config/uploads';

interface CreateDiscussionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateDiscussionDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDiscussionDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentStats, setContentStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [attachments, setAttachments] = useState<CompactRichTextImage[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.discussions.createDialog;
  const { subjects } = useCurriculum();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const composed = appendDiscussionAttachmentsToHtml(content, attachments);
    if (!title.trim() || !discussionRichTextHasContent(composed)) {
      toast.error(copy.titleRequired);
      return;
    }
    if (contentStats.characters > CONTENT_LIMITS.DISCUSSION_CONTENT_MAX) {
      toast.error(
        t('discussions.createDialog.contentTooLong', { count: CONTENT_LIMITS.DISCUSSION_CONTENT_MAX })
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: composed,
          subjectId: subjectId || undefined,
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(copy.createFailed, extractErrorMessage(created)));
        return;
      }
      if (typeof created.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(created.balanceAfter);
      }
      if (typeof created.creditsSpent === 'number' && created.creditsSpent > 0) {
        toast.success(t('discussions.createDialog.createdWithCost', { count: created.creditsSpent }));
      } else {
        toast.success(copy.created);
      }
      onOpenChange(false);
      setTitle('');
      setContent('');
      setContentStats({ words: 0, characters: 0 });
      setAttachments([]);
      setSubjectId('');
      router.refresh();
      onCreated?.();
      router.push(`/discussions/${created.id}`);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.createFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.dialogDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">{copy.titleLabel}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.titlePlaceholder}
              className="mt-1"
              maxLength={CONTENT_LIMITS.DISCUSSION_TITLE_MAX}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{copy.detailsLabel}</label>
            <div className="mt-1">
              <CompactRichText
                value={content}
                onChange={setContent}
                onStatsChange={setContentStats}
                placeholder={copy.detailsPlaceholder}
                ariaLabel={copy.detailsLabel}
                minHeightClass="min-h-[180px]"
                toolbarVisibility="always"
                countsVisibility="none"
                imageUploadEndpoint="/api/uploads/discussions/sign"
                imageMode="attachments"
                imageMaxImages={MAX_DISCUSSION_IMAGES}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
              }}
              placeholder={copy.subjectPlaceholder}
              className="w-full"
            >
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? copy.creating : copy.create}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
