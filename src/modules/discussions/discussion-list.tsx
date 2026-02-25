'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronUp } from 'lucide-react';
import { PostAvatar } from './post-avatar';
import { formatRelativeTime } from './relative-time';

interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  replyCount: number;
  voteScore: number;
  createdAt: string;
  lastActivityAt: string;
}

interface DiscussionListProps {
  refreshKey?: number;
}

export function DiscussionList({ refreshKey = 0 }: DiscussionListProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiscussions = async () => {
    try {
      const res = await fetch('/api/discussions', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDiscussions(data);
    } catch {
      setDiscussions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="divide-y divide-border">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] gap-x-4 py-2">
            <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
            <div className="min-w-0 space-y-1">
              <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (discussions.length === 0) {
    return (
      <div className="border-t border-border py-16 text-center">
        <p className="text-muted-foreground">
          No discussions yet. Be the first to start one.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {discussions.map((d) => (
        <Link
          key={d.id}
          href={`/discussions/${d.id}`}
          className="grid grid-cols-[auto_1fr] gap-x-4 py-2 transition-colors hover:bg-muted/50"
        >
          <PostAvatar userId={d.authorId ?? d.id} authorName={d.authorName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground truncate">
                {d.title}
              </h3>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatRelativeTime(d.createdAt)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <MessageSquare className="h-3.5 w-3.5" />
                {d.replyCount}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <ChevronUp className="h-3.5 w-3.5" />
                {d.voteScore}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 truncate">
              {d.authorName} · {d.content}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
