'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PiChatCircle as MessageSquare, PiCaretUp as ChevronUp } from 'react-icons/pi';
import { PostAvatar } from './post-avatar';
import { formatRelativeTime } from './relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/src/i18n/i18n-provider';
import { buildTagIndex, createTagMap, parseTaggedQuery } from '@/src/lib/tagging';
import { useCurriculum } from '@/src/modules/curriculum/use-curriculum';

interface Discussion {
  id: string;
  title: string;
  contentPreview: string;
  authorId?: string;
  authorAvatarVariant?: string | null;
  authorName: string;
  replyCount: number;
  voteScore: number;
  totalPopularity: number;
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

export function DiscussionList({
  refreshKey = 0,
  query = '',
  subjectIds = [],
  onClearSearch,
}: DiscussionListProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const { locale, messages } = useI18n();
  const copy = messages.discussions.list;
  const { subjects } = useCurriculum();
  const subjectTagIndex = useMemo(
    () =>
      buildTagIndex(
        subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          tag: subject.tag,
          aliases: subject.aliases,
        })),
      ),
    [subjects],
  );
  const subjectTagMap = useMemo(() => createTagMap(subjectTagIndex), [subjectTagIndex]);

  useEffect(() => {
    const { tagIds: tagSubjectIds, textQuery } = parseTaggedQuery(query, subjectTagMap);
    const combinedSubjects = Array.from(new Set([...subjectIds, ...tagSubjectIds]));
    const params = new URLSearchParams();
    if (combinedSubjects.length > 0) params.set('subjects', combinedSubjects.join(','));
    if (textQuery) params.set('q', textQuery.toLowerCase());
    params.set('take', '50');
    fetch(`/api/discussions?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDiscussions)
      .catch(() => setDiscussions([]))
      .finally(() => setLoading(false));
  }, [refreshKey, query, subjectIds, subjectTagMap]);

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
            <p className="text-sm text-muted-foreground font-medium">{copy.noFound}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {copy.noFoundHint}
            </p>
            {onClearSearch ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="mt-3 inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {copy.clear}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium">{copy.noDiscussions}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {copy.noDiscussionsHint}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="card-frame bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {discussions.map((d) => {
          const popularity = d.totalPopularity ?? d.voteScore;
          return (
            <Link
              key={d.id}
              href={`/discussions/${d.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20 group"
            >
            {/* Vote score pill */}
            <div className="flex flex-col items-center shrink-0 w-10 text-center">
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className={`text-xs font-medium leading-none ${popularity > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {popularity}
              </span>
            </div>

            {/* Avatar */}
            <PostAvatar
              userId={d.authorId ?? d.id}
              authorName={d.authorName}
              avatarVariant={d.authorAvatarVariant}
              size="sm"
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {d.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="truncate">{d.authorName}</span>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{formatRelativeTime(d.createdAt, locale)}</span>
                <span className="shrink-0 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {d.replyCount}
                </span>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
