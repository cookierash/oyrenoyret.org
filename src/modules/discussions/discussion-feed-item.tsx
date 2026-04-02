'use client';

import Link from 'next/link';
import { PiChatCircle as MessageSquare, PiArrowUp as ArrowBigUp, PiArrowDown as ArrowBigDown } from 'react-icons/pi';
import { PostAvatar } from './post-avatar';
import { formatRelativeTime } from './relative-time';
import { cn } from '@/src/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface DiscussionFeedItemProps {
    id: string;
    title: string;
    contentPreview: string;
    authorId?: string;
    authorName: string;
    replyCount: number;
    voteScore: number;
    userVote?: 1 | -1 | null;
    createdAt: string;
    className?: string;
}

export function DiscussionFeedItem({
    id,
    title,
    contentPreview,
    authorId,
    authorName,
    replyCount,
    voteScore: initialScore,
    userVote: initialUserVote = null,
    createdAt,
    className,
}: DiscussionFeedItemProps) {
    const [score, setScore] = useState(initialScore);
    const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
    const [voteLoading, setVoteLoading] = useState(false);

    const handleVote = async (e: React.MouseEvent, value: 1 | -1) => {
        e.preventDefault();
        if (voteLoading) return;
        const newVote = userVote === value ? null : value;
        const delta = (newVote ?? 0) - (userVote ?? 0);
        setScore((s) => s + delta);
        setUserVote(newVote);
        setVoteLoading(true);
        try {
            const res = await fetch(`/api/discussions/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newVote ?? 0 }),
            });
            if (!res.ok) throw new Error();
        } catch {
            // revert
            setScore((s) => s - delta);
            setUserVote(userVote);
            toast.error('Failed to vote');
        } finally {
            setVoteLoading(false);
        }
    };

    return (
        <div className={cn(
            'group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30 border-b border-border last:border-0',
            className
        )}>
            <PostAvatar userId={authorId} authorName={authorName} size="sm" />

            <div className="flex-1 min-w-0">
                {/* Author + time */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground text-sm">{authorName}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatRelativeTime(createdAt)}</span>
                </div>

                {/* Title + preview */}
                <Link href={`/discussions/${id}`} className="block mt-0.5 group/link">
                    <h3 className="font-semibold text-[14px] leading-snug text-foreground group-hover/link:text-primary transition-colors">
                        {title}
                    </h3>
                    <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                        {contentPreview}
                    </p>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2 -ml-1">
                    <div className="flex items-center bg-muted/50 rounded-md border border-border/50 overflow-hidden">
                        {/* Upvote */}
                        <button
                            onClick={(e) => handleVote(e, 1)}
                            disabled={voteLoading}
                            className={cn(
                                'flex items-center justify-center p-1.5 transition-colors',
                                userVote === 1
                                    ? 'text-orange-500 bg-orange-500/10'
                                    : 'text-muted-foreground hover:text-orange-500'
                            )}
                        >
                            <ArrowBigUp className={cn("h-4 w-4", userVote === 1 && "fill-current")} />
                        </button>

                        {/* Score */}
                        <span className={cn(
                            "px-1 text-[13px] font-bold min-w-[1.5rem] text-center",
                            score > 0 ? "text-orange-500" : score < 0 ? "text-blue-500" : "text-muted-foreground"
                        )}>
                            {score}
                        </span>

                        {/* Downvote */}
                        <button
                            onClick={(e) => handleVote(e, -1)}
                            disabled={voteLoading}
                            className={cn(
                                'flex items-center justify-center p-1.5 transition-colors',
                                userVote === -1
                                    ? 'text-blue-500 bg-blue-500/10'
                                    : 'text-muted-foreground hover:text-blue-500'
                            )}
                        >
                            <ArrowBigDown className={cn("h-4 w-4", userVote === -1 && "fill-current")} />
                        </button>
                    </div>

                    {/* Reply count */}
                    <Link
                        href={`/discussions/${id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors ml-2"
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{replyCount}</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
