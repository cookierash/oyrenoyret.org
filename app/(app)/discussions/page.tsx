/**
 * Discussions Page
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/src/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { PiMagnifyingGlass as Search } from 'react-icons/pi';
import { CreateDiscussionDialog } from '@/src/modules/discussions/create-discussion-dialog';
import { DiscussionList } from '@/src/modules/discussions/discussion-list';
import { useI18n } from '@/src/i18n/i18n-provider';
import { buildTagIndex, normalizeTagToken, TAG_MATCH_REGEX } from '@/src/lib/tagging';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { useCurriculum } from '@/src/modules/curriculum/use-curriculum';

export default function DiscussionsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const { t, messages } = useI18n();
  const copy = messages.discussions.page;
  const { canWrite } = useCurrentUser();
  const { subjects } = useCurriculum();
  const tagIndex = useMemo(() => {
    const options: Array<{ id: string; name: string; tag: string; aliases?: readonly string[] }> = [];

    subjects.forEach((subject) => {
      options.push({
        id: `subject:${subject.id}`,
        name: subject.name,
        tag: subject.tag,
        aliases: subject.aliases,
      });
    });

    subjects.forEach((subject) => {
      subject.topics.forEach((topic) => {
        options.push({
          id: `topic:${topic.id}`,
          name: topic.name,
          tag: topic.id,
        });
      });
    });

    return buildTagIndex(options);
  }, [subjects]);

  useEffect(() => {
    return;
  }, []);

  useEffect(() => {
    let active = true;
    const ping = async () => {
      try {
        const res = await fetch('/api/online-users', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (active && typeof data?.count === 'number') {
          setOnlineCount(data.count);
        }
      } catch {
        if (active) setOnlineCount(null);
      }
    };

    ping();
    const interval = setInterval(ping, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSubmittedQuery('');
      return;
    }
    searchTimer.current = setTimeout(() => {
      setSubmittedQuery(trimmed);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const tagMatch = useMemo(() => {
    const matches = Array.from(searchQuery.matchAll(TAG_MATCH_REGEX));
    return matches.length ? matches[matches.length - 1] : null;
  }, [searchQuery]);
  const tagQuery = tagMatch?.[1] ? normalizeTagToken(tagMatch[1]) : '';

  const subjectSuggestions = useMemo(() => {
    if (!tagMatch) return [];
    return tagIndex
      .filter((entry) => {
        if (!tagQuery) return true;
        return (
          entry.tokens.some((token) => token.includes(tagQuery)) ||
          normalizeTagToken(entry.name).includes(tagQuery)
        );
      })
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        tag: entry.tag,
        type: entry.id.startsWith('topic:') ? 'topic' : 'subject',
      }));
  }, [tagIndex, tagMatch, tagQuery]);

  const showSuggestions = Boolean(tagMatch) && subjectSuggestions.length > 0;

  const applyTag = (tag: string) => {
    if (tagMatch?.index != null) {
      const token = tagMatch[0] ?? '';
      const before = searchQuery.slice(0, tagMatch.index);
      const after = searchQuery.slice(tagMatch.index + token.length);
      const needsLeadingSpace = token.startsWith(' ');
      const insertion = `${needsLeadingSpace ? ' ' : ''}#${tag} `;
      const next = `${before}${insertion}${after}`.replace(/\s{2,}/g, ' ').trimStart();
      setSearchQuery(next);
    } else {
      setSearchQuery((prev) => `${prev.trimEnd()} #${tag} `.trimStart());
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSubmittedQuery(searchQuery.trim());
  };

  return (
    <DashboardShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} disabled={!canWrite}>
            {copy.newPost}
          </Button>
        }
      />

      <main className="min-w-0 space-y-4 pt-2">
        {onlineCount !== null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>
              {t('discussions.page.onlineNow', {
                count: Math.max(onlineCount - 1, 0),
              })}
            </span>
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="relative">
            <div className="flex w-full items-stretch">
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                className="rounded-r-none"
                placeholder={copy.placeholder}
              />
              <button
                type="button"
                onClick={submitSearch}
                className="inline-flex items-center gap-1 rounded-r-md border border-l-0 border-input bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                aria-label={copy.searchLabel}
              >
                <Search className="h-4 w-4" />
                {copy.search}
              </button>
            </div>
            {showSuggestions ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-md border border-border bg-background shadow-sm">
                <div className="border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  {copy.subjects}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {subjectSuggestions.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTag(subject.tag)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium">#{subject.tag}</div>
                        <div className="text-xs text-muted-foreground">{subject.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {copy.helper}
          </p>
        </div>
        <DiscussionList
          refreshKey={refreshKey}
          query={submittedQuery}
        />
      </main>

      <CreateDiscussionDialog
        open={showCreate && canWrite}
        onOpenChange={(open) => setShowCreate(open && canWrite)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </DashboardShell>
  );
}
