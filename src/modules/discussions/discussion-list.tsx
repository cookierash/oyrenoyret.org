'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronUp } from 'lucide-react';
import { PostAvatar } from './post-avatar';
import { formatRelativeTime } from './relative-time';
import { SUBJECTS } from '@/src/config/constants';
import type { SubjectId } from '@/src/config/curriculum';
import { Skeleton } from '@/components/ui/skeleton';

interface Discussion {
  id: string;
  title: string;
  contentPreview: string;
  authorId?: string;
  authorName: string;
  replyCount: number;
  voteScore: number;
  createdAt: string;
  lastActivityAt: string;
  subjectId?: string | null;
  topicId?: string | null;
}

interface DiscussionListProps {
  refreshKey?: number;
  query?: string;
  subjectIds?: string[];
  onClearSearch?: () => void;
}

const SUBJECT_SLUGS = SUBJECTS.map((s) => ({
  id: s.id,
  slug: s.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
}));

function parseSearchQuery(raw: string) {
  const tags = raw.match(/#[a-z0-9-]+/gi) ?? [];
  const normalizedTags = tags.map((t) => t.slice(1).toLowerCase());
  const subjectIds = normalizedTags
    .map((tag) => {
      const direct = SUBJECT_SLUGS.find((s) => s.id === tag || s.slug === tag);
      return direct?.id ?? null;
    })
    .filter((id): id is SubjectId => Boolean(id));

  const textQuery = raw.replace(/#[a-z0-9-]+/gi, '').trim().toLowerCase();
  return { subjectIds, textQuery };
}

export function DiscussionList({
  refreshKey = 0,
  query = '',
  subjectIds = [],
  onClearSearch,
}: DiscussionListProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { subjectIds: tagSubjectIds, textQuery } = parseSearchQuery(query);
    const combinedSubjects = Array.from(new Set([...subjectIds, ...tagSubjectIds]));
    const params = new URLSearchParams();
    if (combinedSubjects.length > 0) params.set('subjects', combinedSubjects.join(','));
    if (textQuery) params.set('q', textQuery);
    params.set('take', '50');
    fetch(`/api/discussions?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDiscussions)
      .catch(() => setDiscussions([]))
      .finally(() => setLoading(false));
  }, [refreshKey, query, subjectIds]);

  if (loading) {
    return (
      <section className="card-frame bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (discussions.length === 0) {
    const hasQuery = Boolean(query.trim()) || subjectIds.length > 0;
    return (
      <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
        <MessageSquare className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
        {hasQuery ? (
          <>
            <p className="text-sm text-muted-foreground font-medium">No discussions found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a different keyword or remove the subject filter.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium">No discussions yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Be the first to start a discussion from the button above.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="card-frame bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {discussions.map((d) => (
          <Link
            key={d.id}
            href={`/discussions/${d.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20 group"
          >
            {/* Vote score pill */}
            <div className="flex flex-col items-center shrink-0 w-10 text-center">
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className={`text-xs font-bold leading-none ${d.voteScore > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {d.voteScore}
              </span>
            </div>

            {/* Avatar */}
            <PostAvatar userId={d.authorId ?? d.id} authorName={d.authorName} size="sm" />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {d.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="truncate">{d.authorName}</span>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{formatRelativeTime(d.createdAt)}</span>
                <span className="shrink-0 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {d.replyCount}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
