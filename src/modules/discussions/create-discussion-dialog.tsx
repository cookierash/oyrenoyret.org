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
import { SUBJECTS } from '@/src/config/constants';
import { toast } from 'sonner';

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

  const remainingContent = MAX_CONTENT_LENGTH - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
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
        throw new Error(created.error || 'Failed to create');
      }
      if (typeof created.balanceAfter === 'number') {
        (await import('@/src/lib/credits-events')).dispatchCreditsUpdated(created.balanceAfter);
      }
      toast.success('Discussion created');
      onOpenChange(false);
      setTitle('');
      setContent('');
      setSubjectId('');
      router.refresh();
      onCreated?.();
      router.push(`/discussions/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create new discussion</AlertDialogTitle>
          <AlertDialogDescription>
            Share a question or topic for others to discuss.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is your question?"
              className="mt-1"
              maxLength={300}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Details</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add more context..."
              className="mt-1 w-full h-[180px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={MAX_CONTENT_LENGTH}
            />
            {remainingContent <= 100 ? (
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {remainingContent} characters left
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
              }}
              placeholder="Subject (optional)"
              className="w-full"
            >
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
