/**
 * Discussion Detail Page
 *
 * X-style single post with replies, nested replies, and voting.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { formatRelativeTime } from '@/src/modules/discussions/relative-time';
import { ChevronLeft, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  childReplies: Reply[];
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  replies: Reply[];
  archivedAt?: string | null;
  acceptedReplyId?: string | null;
}

export default function DiscussionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [acceptingReplyId, setAcceptingReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);

  const fetchDiscussion = async () => {
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
    } catch {
      setDiscussion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussion();
  }, [id]);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setCurrentUserId(data?.user?.id ?? null));
  }, []);

  const handleVote = async (target: 'discussion' | 'reply', targetId: string, value: number) => {
    setVoteLoading(targetId);
    try {
      const url =
        target === 'discussion'
          ? `/api/discussions/${targetId}/vote`
          : `/api/discussions/replies/${targetId}/vote`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      const data = await res.json();
      router.refresh();
      if (discussion) {
        if (target === 'discussion') {
          setDiscussion({ ...discussion, voteScore: data.voteScore });
        } else {
          const updateReplyScore = (replies: Reply[]): Reply[] =>
            replies.map((r) =>
              r.id === targetId
                ? { ...r, voteScore: data.voteScore }
                : { ...r, childReplies: updateReplyScore(r.childReplies) }
            );
          setDiscussion({ ...discussion, replies: updateReplyScore(discussion.replies) });
        }
      }
    } catch {
      toast.error('Failed to vote');
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

  const handleReply = async (parentReplyId?: string) => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          ...(parentReplyId && { parentReplyId }),
        }),
      });
      if (!res.ok) throw new Error('Failed to reply');
      setReplyContent('');
      setReplyingTo(null);
      fetchDiscussion();
    } catch {
      toast.error('Failed to reply');
    } finally {
      setSubmitting(false);
    }
  };

  const ReplyBlock = ({ reply, depth = 0 }: { reply: Reply; depth?: number }) => (
    <div
      className={
        depth > 0
          ? 'ml-12 mt-3 pl-4 border-l-2 border-border/60'
          : 'mt-4'
      }
    >
      <div className="flex gap-3">
        <PostAvatar
          userId={reply.authorId}
          authorName={reply.authorName}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-sm">
              {reply.authorName}
            </span>
            <span className="text-muted-foreground text-xs">
              · {formatRelativeTime(reply.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">
            {reply.content}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {currentUserId === discussion?.authorId &&
              reply.authorId !== discussion.authorId &&
              !discussion?.archivedAt && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptReply(reply.id);
                  }}
                  disabled={acceptingReplyId === reply.id}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                    discussion?.acceptedReplyId === reply.id
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {discussion?.acceptedReplyId === reply.id ? '✓ Best answer' : 'Accept as best answer'}
                </button>
              )}
            {!discussion?.archivedAt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyingTo(replyingTo === reply.id ? null : reply.id);
                }}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary text-xs font-medium transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Reply
              </button>
            )}
            <div className="flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleVote('reply', reply.id, 1);
                }}
                disabled={voteLoading === reply.id}
                className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-medium text-muted-foreground min-w-[1.25rem] text-center">
                {reply.voteScore}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleVote('reply', reply.id, -1);
                }}
                disabled={voteLoading === reply.id}
                className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {replyingTo === reply.id && (
            <div className="mt-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-0"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleReply(reply.id)} disabled={submitting}>
                  Post
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {reply.childReplies.map((c) => (
            <ReplyBlock key={c.id} reply={c} depth={depth + 1} />
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex gap-3 py-6">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!discussion) {
    return (
      <DashboardShell>
        <div className="flex flex-col gap-4">
          <div className="flex items-center border-b border-border py-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/discussions" className="flex items-center gap-1 -ml-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Discussion not found</p>
            <Button variant="outline" asChild>
              <Link href="/discussions">Back to discussions</Link>
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex items-center border-b border-border py-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/discussions" className="flex items-center gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <main className="border-t border-border">
        {/* Main post - X style */}
        <article className="flex gap-3 py-4">
          <PostAvatar
            userId={discussion.authorId}
            authorName={discussion.authorName}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground">
                {discussion.authorName}
              </span>
              <span className="text-muted-foreground text-sm">
                · {formatRelativeTime(discussion.createdAt)}
              </span>
            </div>
            <h1 className="font-semibold text-foreground mt-1 text-lg">
              {discussion.title}
            </h1>
            <p className="text-foreground mt-1 whitespace-pre-wrap">
              {discussion.content}
            </p>
            <div className="flex items-center gap-4 mt-3 text-muted-foreground">
              {!discussion.archivedAt && (
                <button
                  onClick={() => setReplyingTo(replyingTo === 'root' ? null : 'root')}
                  className="flex items-center gap-1.5 hover:text-primary text-sm font-medium transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Reply
                </button>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleVote('discussion', discussion.id, 1)}
                  disabled={voteLoading === discussion.id}
                  className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium min-w-[1.5rem] text-center">
                  {discussion.voteScore}
                </span>
                <button
                  onClick={() => handleVote('discussion', discussion.id, -1)}
                  disabled={voteLoading === discussion.id}
                  className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* Reply composer */}
        {replyingTo === 'root' && (
          <div className="border-t border-border py-4">
            <div className="flex gap-3">
              <div className="h-10 w-10 shrink-0" aria-hidden />
              <div className="flex-1">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Post your reply..."
                  className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => handleReply()} disabled={submitting}>
                    Post
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Replies section */}
        <section className="border-t border-border">
          <div className="py-2 text-xs font-medium text-muted-foreground">
            Replies ({discussion.replies.length})
          </div>
          <div className="divide-y divide-border/60">
            {discussion.replies.map((r) => (
              <div key={r.id}>
                <ReplyBlock reply={r} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
