'use client';

import Link from 'next/link';
import { MessageSquare, ArrowBigUp, ArrowBigDown, MoreHorizontal } from 'lucide-react';
import { PostAvatar } from './post-avatar';
import { formatRelativeTime } from './relative-time';
import { Button } from '@/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface DiscussionFeedItemProps {
    id: string;
    title: string;
    content: string;
    authorId?: string;
    authorName: string;
    replyCount: number;
    voteScore: number;
    createdAt: string;
    className?: string;
}

export function DiscussionFeedItem({
    id,
    title,
    content,
    authorId,
    authorName,
    replyCount,
    voteScore,
    createdAt,
    className,
}: DiscussionFeedItemProps) {
    const [localUpvotes, setLocalUpvotes] = useState(0); // Temporary until API returns separate
    const [localDownvotes, setLocalDownvotes] = useState(0); // Temporary until API returns separate
    const [voteLoading, setVoteLoading] = useState(false);

    // Initial sync - we need to update the interface to pass these down
    // For now, I'll update the component to accept separate counts
    // In the meantime, I'll use the combined score logic if separate ones aren't provided

    const handleVote = async (value: number) => {
        if (voteLoading) return;
        setVoteLoading(true);
        try {
            const res = await fetch(`/api/discussions/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
            if (!res.ok) throw new Error('Failed to vote');
            const data = await res.json();
            // Upvote logic: if value is 1, data.voteScore likely changes
            // For now, I'll use the API's return structure once I update it
            // Assuming I update the vote API to return separate counts too
            toast.success('Vote recorded');
        } catch {
            toast.error('Failed to vote');
        } finally {
            setVoteLoading(false);
        }
    };

    return (
        <div className={cn(
            "group flex gap-3 p-3 transition-colors hover:bg-muted/30 border-b border-border last:border-0",
            className
        )}>
            <Link href={`/users/${authorId || 'anonymous'}`} className="shrink-0">
                <PostAvatar userId={authorId} authorName={authorName} size="md" />
            </Link>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm truncate">
                        <Link href={`/users/${authorId || 'anonymous'}`} className="font-bold hover:underline truncate">
                            {authorName}
                        </Link>
                        <span className="text-muted-foreground opacity-50">·</span>
                        <span className="text-muted-foreground whitespace-nowrap text-xs">
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <Link href={`/discussions/${id}`} className="block group/link -mt-0.5">
                    <h3 className="font-bold text-[15px] leading-snug mb-0.5 group-hover/link:underline text-foreground">
                        {title}
                    </h3>
                    <p className="text-[14px] text-foreground/80 line-clamp-2 leading-normal">
                        {content}
                    </p>
                </Link>

                {/* Footer Actions */}
                <div className="flex items-center justify-between max-w-[280px] mt-1.5 -ml-2">
                    <div className="flex items-center gap-1">
                        {/* Upvote Group */}
                        <div
                            className="flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-orange-500/10 hover:text-orange-500 transition-colors cursor-pointer group/up"
                            onClick={(e) => {
                                e.preventDefault();
                                handleVote(1);
                            }}
                        >
                            <ArrowBigUp className="h-5 w-5 text-muted-foreground group-hover/up:text-orange-500 transition-colors" />
                            <span className="text-[13px] font-bold text-muted-foreground group-hover/up:text-orange-500 transition-colors">
                                {voteScore > 0 ? voteScore : 0}
                            </span>
                        </div>

                        {/* Downvote Group */}
                        <div
                            className="flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors cursor-pointer group/down"
                            onClick={(e) => {
                                e.preventDefault();
                                handleVote(-1);
                            }}
                        >
                            <ArrowBigDown className="h-5 w-5 text-muted-foreground group-hover/down:text-blue-500 transition-colors" />
                            <span className="text-[13px] font-bold text-muted-foreground group-hover/down:text-blue-500 transition-colors">
                                {voteScore < 0 ? Math.abs(voteScore) : 0}
                            </span>
                        </div>
                    </div>

                    <Button variant="ghost" size="sm" asChild className="h-8 px-3 gap-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 cursor-pointer rounded-full">
                        <Link href={`/discussions/${id}`}>
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-[13px] font-medium">{replyCount}</span>
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
