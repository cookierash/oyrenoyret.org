'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PiMagnifyingGlass as SearchIcon, PiX as X } from 'react-icons/pi';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SUBJECTS } from '@/src/config/constants';

interface CatalogSearchResult {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  authorName: string;
  publishedAt: string;
}

interface CatalogSearchProps {
  baseSubjectIds?: string[];
  baseTopicIds?: string[];
  tagMode?: 'subject' | 'topic';
  tagOptions?: { id: string; name: string }[];
}

function buildTagIndex(options: { id: string; name: string }[]) {
  return options.map((opt) => ({
    id: opt.id,
    slug: opt.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  }));
}

function parseSearchQuery(raw: string, tagIndex: { id: string; slug: string }[]) {
  const tags = raw.match(/#[a-z0-9-]+/gi) ?? [];
  const normalizedTags = tags.map((t) => t.slice(1).toLowerCase());
  const tagIds = normalizedTags
    .map((tag) => {
      const direct = tagIndex.find((s) => s.id === tag || s.slug === tag);
      return direct?.id ?? null;
    })
    .filter((id): id is string => Boolean(id));

  const textQuery = raw.replace(/#[a-z0-9-]+/gi, '').trim();
  return { tagIds, textQuery };
}

export function CatalogSearch({
  baseSubjectIds,
  baseTopicIds,
  tagMode = 'subject',
  tagOptions,
}: CatalogSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<NodeJS.Timeout | null>(null);

  const tagSource = useMemo(
    () =>
      tagMode === 'topic'
        ? tagOptions ?? []
        : SUBJECTS.map((s) => ({ id: s.id, name: s.name })),
    [tagMode, tagOptions]
  );
  const tagIndex = useMemo(() => buildTagIndex(tagSource), [tagSource]);
  const baseIds = useMemo(
    () => baseSubjectIds ?? [],
    [baseSubjectIds ? baseSubjectIds.join(',') : '']
  );
  const baseTopicIdsMemo = useMemo(
    () => baseTopicIds ?? [],
    [baseTopicIds ? baseTopicIds.join(',') : '']
  );
  const tagMatch = useMemo(() => {
    const matches = Array.from(query.matchAll(/(?:^|\s)#([a-z0-9-]*)/gi));
    return matches.length ? matches[matches.length - 1] : null;
  }, [query]);
  const tagQuery = tagMatch?.[1]?.toLowerCase() ?? '';
  const { tagIds, textQuery } = useMemo(
    () => parseSearchQuery(query, tagIndex),
    [query, tagIndex]
  );
  const effectiveSubjectIds = useMemo(() => {
    if (tagMode === 'subject') {
      return Array.from(new Set([...baseIds, ...selectedTags, ...tagIds]));
    }
    return baseIds;
  }, [baseIds, selectedTags, tagIds, tagMode]);
  const effectiveTopicIds = useMemo(() => {
    if (tagMode === 'topic') {
      const tagged = Array.from(new Set([...selectedTags, ...tagIds]));
      return tagged.length > 0 ? tagged : baseTopicIdsMemo;
    }
    return baseTopicIdsMemo;
  }, [baseTopicIdsMemo, selectedTags, tagIds, tagMode]);

  const tagSuggestions = useMemo(() => {
    if (!tagMatch) return [];
    return tagSource
      .filter((opt) => {
        if (!tagQuery) return true;
        return (
          opt.id.includes(tagQuery) ||
          opt.name.toLowerCase().includes(tagQuery)
        );
      })
      .slice(0, 8);
  }, [tagMatch, tagQuery, tagSource]);

  const showTagSuggestions = Boolean(tagMatch) && tagSuggestions.length > 0;

  const applyTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSelectedTags((prev) => [...prev, tagId]);
    if (tagMatch?.index != null) {
      const token = tagMatch[0] ?? '';
      const before = query.slice(0, tagMatch.index);
      const after = query.slice(tagMatch.index + token.length);
      const next = `${before}${after}`.replace(/\s{2,}/g, ' ').trimStart();
      setQuery(next);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeTag = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || showTagSuggestions) {
      setResults((prev) => (prev.length ? [] : prev));
      setLoading((prev) => (prev ? false : prev));
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (textQuery) params.set('q', textQuery);
        if (effectiveSubjectIds.length > 0) {
          params.set('subjects', effectiveSubjectIds.join(','));
        }
        if (effectiveTopicIds.length > 0) {
          params.set('topics', effectiveTopicIds.join(','));
        }
        params.set('take', '8');
        const res = await fetch(`/api/materials/search?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, textQuery, effectiveSubjectIds, effectiveTopicIds, showTagSuggestions]);

  const showMenu = focused && query.trim().length > 0 && !showTagSuggestions;

  const isTopicMode = tagMode === 'topic';
  const placeholder = isTopicMode
    ? 'Search materials or use #topic (e.g., #fractions)'
    : 'Search materials or use #subject (e.g., #mathematics)';
  const helperText = isTopicMode
    ? 'Filter by topic with #topic, like #fractions or #linear-equations.'
    : 'Filter by subject with #subject, like #physics or #azerbaijani-language.';

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex w-full items-stretch">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 150);
            }}
            className="rounded-r-none"
            placeholder={placeholder}
            aria-label="Search materials by title, subject, or topic"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-r-md border border-l-0 border-input bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
            aria-label="Search materials"
          >
            <SearchIcon className="h-4 w-4" />
            Search
          </button>
        </div>
        {selectedTags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTags.map((tagId) => {
              const tag = tagSource.find((s) => s.id === tagId);
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground"
                >
                  #{tagId}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => removeTag(tagId)}
                    aria-label={`Remove ${tag?.name ?? tagId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        {showTagSuggestions ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-border bg-background shadow-sm">
            <div className="border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
              {tagMode === 'topic' ? 'Topics' : 'Subjects'}
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTag(tag.id)}
                >
                  <div className="min-w-0">
                    <div className="font-medium">#{tag.id}</div>
                    <div className="text-xs text-muted-foreground">{tag.name}</div>
                  </div>
                  {selectedTags.includes(tag.id) ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Added
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showMenu ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No results yet.
                </div>
              ) : (
                <ul className="py-2">
                  {results.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/catalog/${item.subjectId}/${item.topicId}/${item.id}`}
                        className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                      >
                      <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate">
                              {item.subjectName} · {item.topicName}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span>{item.materialType === 'PRACTICE_TEST' ? 'Practice test' : 'Notes'}</span>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className="truncate">by {item.authorName}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
