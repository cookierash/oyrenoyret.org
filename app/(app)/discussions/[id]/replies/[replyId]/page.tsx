'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowBigUp, ArrowBigDown, ArrowLeft, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  childReplies?: Reply[];
}

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const day = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${time} · ${day}`;
};

export default function ReplyPage() {
  const MAX_REPLY_LENGTH = 2000;
  const { id: rawId, replyId: rawReplyId } = useParams();
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const replyId = typeof rawReplyId === 'string' ? rawReplyId : Array.isArray(rawReplyId) ? rawReplyId[0] : '';
  const router = useRouter();

  const [parentReply, setParentReply] = useState<Reply | null>(null);
  const [parentReplyId, setParentReplyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const replyRemaining = MAX_REPLY_LENGTH - replyContent.length;
  const dialogRemaining = MAX_REPLY_LENGTH - dialogContent.length;

  useEffect(() => {
    if (!id || !replyId) return;
    setLoading(true);
    fetch(`/api/discussions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        let foundReply: Reply | null = null;
        let foundParentId: string | null = null;
        const findReply = (replies: Reply[]) => {
          for (const r of replies) {
            if (r.id === replyId) {
              foundReply = r;
              foundParentId = null;
              return;
            }
            if (r.childReplies) {
              for (const child of r.childReplies) {
                if (child.id === replyId) {
                  foundReply = child;
                  foundParentId = r.id;
                  return;
                }
              }
              findReply(r.childReplies);
            }
          }
        };
        findReply(data.replies || []);
        setParentReply(foundReply);
        setParentReplyId(foundParentId);
      })
      .catch(() => {
        toast.error('Failed to load reply');
        setParentReply(null);
      })
      .finally(() => setLoading(false));
  }, [id, replyId]);

  const handleVote = async (value: 1 | -1) => {
    if (!parentReply || voteLoading) return;

    const previousVote = parentReply.userVote ?? null;
    const newVote = previousVote === value ? null : value;
    const delta = (newVote ?? 0) - (previousVote ?? 0);

    const newReply = {
      ...parentReply,
      voteScore: parentReply.voteScore + delta,
      userVote: newVote,
    };
    setParentReply(newReply);
    setVoteLoading(true);

    try {
      const res = await fetch(`/api/discussions/replies/${replyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newVote ?? 0 }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to vote');
      setParentReply(parentReply);
    } finally {
      setVoteLoading(false);
    }
  };

  const submitReply = async (content: string) => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          parentReplyId: replyId,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error('Failed to reply');
      setReplyContent('');
      setDialogContent('');
      setDialogOpen(false);
      router.refresh();
      if (created?.id) {
        router.push(`/discussions/${id}/replies/${created.id}`);
      }
    } catch {
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <main className="min-w-0 space-y-6">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href="/discussions" className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to discussions
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-24 ml-auto" />
              <Skeleton className="h-4 w-32" />
            </div>
          </main>
      </DashboardShell>
    );
  }

  if (!parentReply) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div className="border-b border-border/60 py-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/discussions" className="inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to discussions
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Reply not found.</p>
        </div>
      </DashboardShell>
    );
  }

  const backHref = parentReplyId
    ? `/discussions/${id}/replies/${parentReplyId}`
    : `/discussions/${id}`;

  return (
    <DashboardShell>
      <main className="lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
          <div className="space-y-6 min-w-0 lg:overflow-y-auto">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href={backHref} className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Link>
              </Button>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-3">
                <PostAvatar
                  userId={parentReply.authorId}
                  authorName={parentReply.authorName}
                  size="sm"
                />
                <span className="text-sm font-semibold text-foreground">{parentReply.authorName}</span>
              </div>
              <p className="text-[15px] text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
                {parentReply.content}
              </p>
              <div className="text-xs text-muted-foreground">
                {formatDateTime(parentReply.createdAt)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialogOpen(true)}
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Reply
                </Button>
                <div className="flex items-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote(1)}
                    disabled={voteLoading}
                    aria-label="Upvote"
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      parentReply.userVote === 1 && 'text-primary bg-primary/10'
                    )}
                  >
                    <ArrowBigUp className={cn('h-4 w-4', parentReply.userVote === 1 && 'fill-current')} />
                  </Button>
                  <span
                    className={cn(
                      'min-w-[2rem] px-2 text-center text-xs font-semibold',
                      parentReply.voteScore > 0
                        ? 'text-primary'
                        : parentReply.voteScore < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {parentReply.voteScore}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote(-1)}
                    disabled={voteLoading}
                    aria-label="Downvote"
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      parentReply.userVote === -1 && 'text-destructive bg-destructive/10'
                    )}
                  >
                    <ArrowBigDown className={cn('h-4 w-4', parentReply.userVote === -1 && 'fill-current')} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-6">
              <div className="space-y-3">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply"
                  className="w-full min-h-[88px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-b border-border/60 pb-3"
                  maxLength={MAX_REPLY_LENGTH}
                />
                {replyRemaining <= 100 ? (
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    {replyRemaining} characters left
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => submitReply(replyContent)} disabled={submitting || !replyContent.trim()}>
                    Reply
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Replies</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Replies open in their own pages.
                </p>
              </div>
            </div>
          </div>
        </main>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Write a reply</AlertDialogTitle>
              <AlertDialogDescription>
                Share your thoughts on this reply.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <textarea
                value={dialogContent}
                onChange={(e) => setDialogContent(e.target.value)}
                placeholder="Write your reply..."
                className="w-full h-[180px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={MAX_REPLY_LENGTH}
              />
              {dialogRemaining <= 100 ? (
                <div className="text-right text-xs text-muted-foreground">
                  {dialogRemaining} characters left
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => submitReply(dialogContent)}
                  disabled={submitting || !dialogContent.trim()}
                >
                  Post reply
                </Button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>
    </DashboardShell>
  );
}
