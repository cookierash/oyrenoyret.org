/**
 * Discussion Detail Page
 *
 * Single post with replies and voting.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { PiArrowUp as ArrowBigUp, PiArrowDown as ArrowBigDown, PiChatCircle as MessageSquare, PiArrowLeft as ArrowLeft } from 'react-icons/pi';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  replies: Reply[];
  archivedAt?: string | null;
  acceptedReplyId?: string | null;
  currentUserId?: string | null;
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

export default function DiscussionDetailPage() {
  const MAX_REPLY_LENGTH = 2000;
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingReplyId, setAcceptingReplyId] = useState<string | null>(null);
  const [inlineReply, setInlineReply] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const inlineRemaining = MAX_REPLY_LENGTH - inlineReply.length;
  const dialogRemaining = MAX_REPLY_LENGTH - dialogContent.length;

  const fetchDiscussion = useCallback(async () => {
    try {
      const res = await fetch(`/api/discussions/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          setDiscussion(null);
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setDiscussion(data);
      setCurrentUserId(data?.currentUserId ?? null);
    } catch {
      setDiscussion(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDiscussion();
  }, [fetchDiscussion]);

  const handleVote = async (target: 'discussion' | 'reply', targetId: string, value: 1 | -1) => {
    if (!discussion || voteLoading) return;

    let previousVote: 1 | -1 | null = null;
    let newVote: 1 | -1 | null = null;

    // Optimistic update
    const newDiscussion = { ...discussion };
    if (target === 'discussion') {
      previousVote = newDiscussion.userVote ?? null;
      newVote = previousVote === value ? null : value;
      const delta = (newVote ?? 0) - (previousVote ?? 0);
      newDiscussion.voteScore += delta;
      newDiscussion.userVote = newVote;
    } else {
      newDiscussion.replies = newDiscussion.replies.map((r) => {
        if (r.id === targetId) {
          previousVote = r.userVote ?? null;
          newVote = previousVote === value ? null : value;
          const delta = (newVote ?? 0) - (previousVote ?? 0);
          return { ...r, voteScore: r.voteScore + delta, userVote: newVote };
        }
        return r;
      });
    }

    setDiscussion(newDiscussion);
    setVoteLoading(targetId);

    try {
      const url =
        target === 'discussion'
          ? `/api/discussions/${targetId}/vote`
          : `/api/discussions/replies/${targetId}/vote`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newVote ?? 0 }),
      });
      if (!res.ok) throw new Error('Failed to vote');
    } catch {
      toast.error('Failed to vote');
      setDiscussion(discussion);
    } finally {
      setVoteLoading(null);
    }
  };

  const handleAcceptReply = async (replyId: string) => {
    setAcceptingReplyId(replyId);
    try {
      const res = await fetch(`/api/discussions/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId }),
      });
      if (!res.ok) throw new Error('Failed to accept');
      router.refresh();
      fetchDiscussion();
      toast.success('Marked as best answer');
    } catch {
      toast.error('Failed to accept');
    } finally {
      setAcceptingReplyId(null);
    }
  };

  const submitReply = async (content: string, parentReplyId?: string | null) => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          parentReplyId: parentReplyId || undefined,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error('Failed to reply');
      setInlineReply('');
      setDialogContent('');
      setDialogOpen(false);
      router.refresh();
      if (created?.id) {
        router.push(`/discussions/${id}/replies/${created.id}`);
      } else {
        fetchDiscussion();
      }
    } catch {
      toast.error('Failed to reply');
    } finally {
      setSubmitting(false);
    }
  };

  const openReplyDialog = (parentReplyId?: string) => {
    setDialogParentId(parentReplyId ?? null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <DashboardShell>
        <main className="min-w-0 space-y-6 pb-12">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href="/discussions" className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to discussions
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-7 w-2/3" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
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

  if (!discussion) {
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
          <p className="text-sm text-muted-foreground">Discussion not found.</p>
        </div>
      </DashboardShell>
    );
  }

  const replyCount = discussion.replies?.length ?? 0;

  return (
    <DashboardShell>
      <main className="lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
          <div className="space-y-6 min-w-0 pb-12 lg:overflow-y-auto">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href="/discussions" className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to discussions
                </Link>
              </Button>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2">
                <PostAvatar
                  userId={discussion.authorId}
                  authorName={discussion.authorName}
                  size="xs"
                />
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/70">
                    {discussion.authorName}
                  </span>
                  <span className="px-1">·</span>
                  <span>{formatDateTime(discussion.createdAt)}</span>
                </div>
              </div>
              <h1 className="text-[15px] font-semibold text-foreground break-words">
                {discussion.title}
              </h1>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
                {discussion.content}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReplyDialog()}
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Reply
                </Button>
                <div className="flex items-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote('discussion', discussion.id, 1)}
                    disabled={!!voteLoading}
                    aria-label="Upvote"
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      discussion.userVote === 1 && 'text-primary bg-primary/10'
                    )}
                  >
                    <ArrowBigUp className={cn('h-4 w-4', discussion.userVote === 1 && 'fill-current')} />
                  </Button>
                  <span
                    className={cn(
                      'min-w-[2rem] px-2 text-center text-xs font-semibold',
                      discussion.voteScore > 0
                        ? 'text-primary'
                        : discussion.voteScore < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {discussion.voteScore}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote('discussion', discussion.id, -1)}
                    disabled={!!voteLoading}
                    aria-label="Downvote"
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      discussion.userVote === -1 && 'text-destructive bg-destructive/10'
                    )}
                  >
                    <ArrowBigDown className={cn('h-4 w-4', discussion.userVote === -1 && 'fill-current')} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-3">
                    <textarea
                      value={inlineReply}
                      onChange={(e) => setInlineReply(e.target.value)}
                      placeholder="Write a reply"
                      className="w-full min-h-[96px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      maxLength={MAX_REPLY_LENGTH}
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {inlineRemaining <= 100 ? `${inlineRemaining} characters left` : ''}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => submitReply(inlineReply)}
                        disabled={submitting || !inlineReply.trim()}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Replies</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Replies to this discussion appear below.
                  </p>
                </div>

                {replyCount > 0 ? (
                  <div className="space-y-3">
                    {discussion.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg border border-border/60 bg-muted/10 p-3 transition-colors hover:bg-muted/20 cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/discussions/${id}/replies/${reply.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/discussions/${id}/replies/${reply.id}`);
                          }
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <PostAvatar
                              userId={reply.authorId}
                              authorName={reply.authorName}
                              size="xs"
                            />
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground/70">
                                {reply.authorName}
                              </span>
                              <span className="px-1">·</span>
                              <span>{formatDateTime(reply.createdAt)}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                            {reply.content}
                          </p>
                          {currentUserId === discussion?.authorId &&
                            reply.authorId !== discussion.authorId &&
                            !discussion?.archivedAt && (
                              <div className="pt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptReply(reply.id);
                                  }}
                                  disabled={acceptingReplyId === reply.id}
                                  className={cn(
                                    'text-xs font-medium transition-colors',
                                    discussion?.acceptedReplyId === reply.id
                                      ? 'text-primary'
                                      : 'text-muted-foreground hover:text-primary'
                                  )}
                                >
                                  {discussion?.acceptedReplyId === reply.id
                                    ? '✓ Best answer'
                                    : 'Accept as best answer'}
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                )}
              </div>
            </div>
          </div>
        </main>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Write a reply</AlertDialogTitle>
              <AlertDialogDescription>
                Share your thoughts on this discussion.
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
                  onClick={() => submitReply(dialogContent, dialogParentId)}
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
