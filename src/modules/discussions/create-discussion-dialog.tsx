'use client';

import { useMemo, useState } from 'react';
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
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';

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
  const MAX_CONTENT_LENGTH = 2000;
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t, messages } = useI18n();
  const copy = messages.discussions.createDialog;
  const subjects = useMemo(() => getLocalizedSubjects(messages), [messages]);

  const remainingContent = MAX_CONTENT_LENGTH - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error(copy.titleRequired);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          subjectId: subjectId || undefined,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        toast.error(copy.createFailed);
        return;
      }
      if (typeof created.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(created.balanceAfter);
      }
      toast.success(copy.created);
      onOpenChange(false);
      setTitle('');
      setContent('');
      setSubjectId('');
      router.refresh();
      onCreated?.();
      router.push(`/discussions/${created.id}`);
    } catch {
      toast.error(copy.createFailed);
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
              maxLength={300}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{copy.detailsLabel}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={copy.detailsPlaceholder}
              className="mt-1 w-full h-[180px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={MAX_CONTENT_LENGTH}
            />
            {remainingContent <= 100 ? (
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {t('discussions.createDialog.charactersLeft', { count: remainingContent })}
              </div>
            ) : null}
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
