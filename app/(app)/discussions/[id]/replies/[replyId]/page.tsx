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
import { Skeleton } from '@/components/ui/skeleton';

interface Reply {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: string;
    voteScore: number;
    replyCount: number;
}

interface Discussion {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: string;
    voteScore: number;
    ancestors: Reply[];
    replies: Reply[];
    archivedAt?: string | null;
}

export default function ReplyThreadPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const replyId = params.replyId as string;

    const [discussion, setDiscussion] = useState<Discussion | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [voteLoading, setVoteLoading] = useState<string | null>(null);

    const fetchThread = async () => {
        try {
            const res = await fetch(`/api/discussions/${id}?replyId=${replyId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setDiscussion(data);
        } catch {
            setDiscussion(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchThread();
    }, [id, replyId]);

    useEffect(() => {
        fetch('/api/auth/me', { cache: 'no-store' })
            .then((r) => r.json())
            .then((data) => setCurrentUserId(data?.user?.id ?? null));
    }, []);

    const handleVote = async (target: 'discussion' | 'reply', targetId: string, value: number) => {
        setVoteLoading(targetId);
        try {
            const url = target === 'discussion'
                ? `/api/discussions/${targetId}/vote`
                : `/api/discussions/replies/${targetId}/vote`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
            if (!res.ok) throw new Error('Failed to vote');
            const data = await res.json();

            // Update local state
            if (discussion) {
                if (target === 'discussion') {
                    setDiscussion({ ...discussion, voteScore: data.voteScore });
                } else {
                    const updateReplies = (list: Reply[]) => list.map(r => r.id === targetId ? { ...r, voteScore: data.voteScore } : r);
                    setDiscussion({
                        ...discussion,
                        ancestors: updateReplies(discussion.ancestors),
                        replies: updateReplies(discussion.replies)
                    });
                }
            }
        } catch {
            toast.error('Failed to vote');
        } finally {
            setVoteLoading(null);
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
                    parentReplyId: parentReplyId || replyId,
                }),
            });
            if (!res.ok) throw new Error('Failed to reply');
            const data = await res.json();
            setReplyContent('');
            fetchThread();
            // If we replied to something other than the core focused reply, we might want to navigate to it
            if (parentReplyId && parentReplyId !== replyId) {
                router.push(`/discussions/${id}/replies/${data.id}`);
            }
        } catch {
            toast.error('Failed to reply');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell className="max-w-2xl mx-auto px-4">
                <Skeleton className="h-10 w-full mb-4" />
                <Skeleton className="h-32 w-full mb-8" />
                <Skeleton className="h-64 w-full" />
            </DashboardShell>
        );
    }

    if (!discussion) return <div>Thread not found</div>;

    const focusedReply = discussion.ancestors[discussion.ancestors.length - 1];

    return (
        <DashboardShell className="max-w-2xl mx-auto px-4 pb-20">
            <div className="flex items-center sticky top-0 z-10 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 border-b border-border/50">
                <Button variant="ghost" size="sm" asChild className="h-8 -ml-2 gap-1 text-muted-foreground hover:text-foreground">
                    <Link href={discussion.ancestors.length > 1
                        ? `/discussions/${id}/replies/${discussion.ancestors[discussion.ancestors.length - 2].id}`
                        : `/discussions/${id}`
                    }>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="font-bold">Thread</span>
                    </Link>
                </Button>
            </div>

            <main className="mt-4">
                {/* Ancestor Chain */}
                <div className="space-y-4 mb-4">
                    {/* Post preview if we are deep */}
                    <div className="border-l-2 border-muted pl-4 py-1 opacity-60">
                        <Link href={`/discussions/${id}`} className="text-sm font-bold hover:underline mb-1 block">
                            {discussion.title}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1">{discussion.content}</p>
                    </div>

                    {discussion.ancestors.slice(0, -1).map((a, i) => (
                        <div key={a.id} className="relative group">
                            <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-muted" />
                            <div className="flex gap-3">
                                <PostAvatar userId={a.authorId} authorName={a.authorName} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="font-bold">{a.authorName}</span>
                                        <span className="text-muted-foreground">· {formatRelativeTime(a.createdAt)}</span>
                                    </div>
                                    <p className="text-[14px] mt-0.5 whitespace-pre-wrap">{a.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Focused Reply */}
                <article className="space-y-4 py-4 border-t-2 border-primary/10">
                    <div className="flex items-center gap-3">
                        <PostAvatar userId={focusedReply.authorId} authorName={focusedReply.authorName} size="md" />
                        <div className="flex flex-col">
                            <span className="font-bold text-foreground leading-tight">{focusedReply.authorName}</span>
                            <span className="text-muted-foreground text-[13px]">@{focusedReply.authorName.toLowerCase().replace(/\s+/g, '')}</span>
                        </div>
                    </div>
                    <p className="text-[17px] text-foreground/90 whitespace-pre-wrap leading-normal">
                        {focusedReply.content}
                    </p>
                    <div className="py-2 border-y border-border/50 flex items-center gap-6 text-[13px] text-muted-foreground">
                        <span>{new Date(focusedReply.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between max-w-xs">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost" size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-orange-500"
                                onClick={() => handleVote('reply', focusedReply.id, 1)}
                            >
                                <ChevronUp className="h-5 w-5" />
                            </Button>
                            <span className="text-sm font-bold">{focusedReply.voteScore}</span>
                            <Button
                                variant="ghost" size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-blue-500"
                                onClick={() => handleVote('reply', focusedReply.id, -1)}
                            >
                                <ChevronDown className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm">{discussion.replies.length}</span>
                        </div>
                    </div>
                </article>

                {/* Reply Composer */}
                <div className="py-4 border-b border-border">
                    <div className="flex gap-3">
                        <PostAvatar userId={currentUserId || ''} authorName="You" size="md" className="opacity-50" />
                        <div className="flex-1 flex flex-col gap-3">
                            <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Post your reply"
                                className="w-full min-h-[40px] text-lg bg-transparent border-none focus:ring-0 resize-none placeholder:text-muted-foreground/60 py-2"
                                rows={1}
                            />
                            <div className="flex justify-end pt-2 border-t border-border/30">
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

                {/* Replies to focused reply */}
                <section className="mt-4 divide-y divide-border/50">
                    {discussion.replies.map(r => (
                        <div key={r.id} className="group p-3 transition-colors hover:bg-muted/30">
                            <div className="flex gap-3">
                                <Link href={`/users/${r.authorId}`} className="shrink-0">
                                    <PostAvatar userId={r.authorId} authorName={r.authorName} size="sm" />
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className="font-bold">{r.authorName}</span>
                                        <span className="text-muted-foreground text-xs">· {formatRelativeTime(r.createdAt)}</span>
                                    </div>
                                    <p className="text-sm mt-1 mb-2 whitespace-pre-wrap">{r.content}</p>
                                    <div className="flex items-center gap-4 text-muted-foreground">
                                        <div className="flex items-center gap-0.5">
                                            <ChevronUp className="h-4 w-4 cursor-pointer hover:text-orange-500" onClick={() => handleVote('reply', r.id, 1)} />
                                            <span className="text-xs font-bold leading-none">{r.voteScore}</span>
                                            <ChevronDown className="h-4 w-4 cursor-pointer hover:text-blue-500" onClick={() => handleVote('reply', r.id, -1)} />
                                        </div>
                                        <Link href={`/discussions/${id}/replies/${r.id}`} className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            {r.replyCount > 0 ? `${r.replyCount} replies` : 'Reply'}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </DashboardShell>
    );
}
