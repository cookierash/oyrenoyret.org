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
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
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
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const topics = subjectId
    ? (CURRICULUM_TOPICS as Record<string, { id: string; name: string }[]>)[subjectId] ?? []
    : [];

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
          topicId: topicId || undefined,
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
      setTopicId('');
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
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Create new discussion</AlertDialogTitle>
          <AlertDialogDescription>
            Share a question or topic for others to discuss.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
              className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={10000}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              placeholder="Subject (optional)"
            >
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              placeholder="Topic (optional)"
              disabled={!subjectId}
            >
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
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
