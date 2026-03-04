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
import { ChevronLeft, ChevronUp, ChevronDown, ArrowBigUp, ArrowBigDown, MessageSquare, MoreHorizontal, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  childReplies?: Reply[];
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  upvotes?: number;
  downvotes?: number;
  replies: Reply[];
  archivedAt?: string | null;
  acceptedReplyId?: string | null;
}

import { Skeleton } from '@/components/ui/skeleton';

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
                : { ...r, childReplies: r.childReplies ? updateReplyScore(r.childReplies) : [] }
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
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${discussion?.acceptedReplyId === reply.id
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
          {reply.childReplies?.map((c) => (
            <ReplyBlock key={c.id} reply={c} depth={depth + 1} />
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <DashboardShell className="max-w-2xl mx-auto px-4">
        <div className="flex items-center py-3">
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="flex gap-3 py-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
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
    <DashboardShell className="pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Thread content */}
        <div className="min-w-0">
          <div className="flex items-center sticky top-0 z-10 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 border-b border-border/50">
            <Button variant="ghost" size="sm" asChild className="h-8 -ml-2 gap-1 text-muted-foreground hover:text-foreground rounded-full">
              <Link href="/discussions">
                <ChevronLeft className="h-4 w-4" />
                <span className="font-bold">Post</span>
              </Link>
            </Button>
          </div>

          <main className="mt-4">
            {/* Main post - X style */}
            <article className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PostAvatar
                    userId={discussion.authorId}
                    authorName={discussion.authorName}
                    size="md"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground leading-tight hover:underline cursor-pointer">
                      {discussion.authorName}
                    </span>
                    <span className="text-muted-foreground text-[13px]">
                      @{discussion.authorName.toLowerCase().replace(/\s+/g, '')}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <h1 className="font-bold text-xl md:text-2xl leading-tight text-foreground tracking-tight">
                  {discussion.title}
                </h1>
                <p className="text-[17px] text-foreground/90 whitespace-pre-wrap leading-normal">
                  {discussion.content}
                </p>
              </div>

              <div className="py-3 border-y border-border/50 flex items-center gap-6 text-[14px] text-muted-foreground">
                <span>{new Date(discussion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(discussion.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>

              <div className="flex items-center justify-between max-w-sm py-1">
                <div className="flex items-center gap-2">
                  {/* Upvote Group */}
                  <div
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-orange-500/10 text-muted-foreground hover:text-orange-500 transition-colors cursor-pointer group/up"
                    onClick={() => handleVote('discussion', discussion.id, 1)}
                  >
                    <ArrowBigUp className="h-6 w-6 group-hover/up:text-orange-500 transition-colors" />
                    <span className="text-sm font-bold">{discussion.upvotes ?? discussion.voteScore}</span>
                  </div>

                  {/* Downvote Group */}
                  <div
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors cursor-pointer group/down"
                    onClick={() => handleVote('discussion', discussion.id, -1)}
                  >
                    <ArrowBigDown className="h-6 w-6 group-hover/down:text-blue-500 transition-colors" />
                    <span className="text-sm font-bold">{discussion.downvotes ?? 0}</span>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="h-10 px-4 gap-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-full">
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-medium text-sm">{discussion.replies?.length ?? 0}</span>
                </Button>
              </div>
            </article>

            {/* Reply composer */}
            {!discussion.archivedAt && (
              <div className="py-4 border-b border-border/50">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0">
                    <PostAvatar userId={currentUserId || ''} authorName="You" size="md" className="opacity-50" />
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Post your reply"
                      className="w-full min-h-[40px] text-lg bg-transparent border-none focus:ring-0 resize-none placeholder:text-muted-foreground/60 py-2"
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                    <div className="flex justify-end border-t border-border/30 pt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        className="rounded-full px-5 font-bold"
                        onClick={() => handleReply()}
                        disabled={submitting || !replyContent.trim()}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Replies section */}
            <section className="mt-2 divide-y divide-border/30">
              {discussion.replies?.map((r) => (
                <div key={r.id} className="py-1">
                  <ReplyBlock reply={r} />
                </div>
              ))}
              {(discussion.replies?.length ?? 0) === 0 && (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">No replies yet.</p>
                </div>
              )}
            </section>
          </main>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden lg:block space-y-6 sticky top-6">
          <section className="bg-muted/30 rounded-xl p-5 border border-border/50">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              Thread Stats
            </h2>
            <div className="space-y-4 font-medium text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Net votes</span>
                <span className="text-primary font-bold">+{discussion.voteScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Replies</span>
                <span className="text-foreground font-bold">{discussion.replies?.length ?? 0}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
}
