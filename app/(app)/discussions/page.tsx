/**
 * Discussions Page
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/src/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { PiMagnifyingGlass as Search, PiX as X } from 'react-icons/pi';
import { CreateDiscussionDialog } from '@/src/modules/discussions/create-discussion-dialog';
import { DiscussionList } from '@/src/modules/discussions/discussion-list';
import { SUBJECTS } from '@/src/config/constants';

export default function DiscussionsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let active = true;
    const runCleanup = async () => {
      try {
        await fetch('/api/cron/archive-discussions', { cache: 'no-store' });
      } catch {
        return;
      }
      if (active) {
        setRefreshKey((prev) => prev + 1);
      }
    };
    runCleanup();
    return () => {
      active = false;
    };
  }, []);

  const tagMatch = useMemo(() => searchQuery.match(/(?:^|\s)#([a-z0-9-]*)$/i), [searchQuery]);
  const tagQuery = tagMatch?.[1]?.toLowerCase() ?? '';
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const activeSubjects = useMemo(
    () => SUBJECTS.filter((s) => selectedSubjects.includes(s.id)),
    [selectedSubjects]
  );

  const subjectSuggestions = useMemo(() => {
    if (!tagMatch) return [];
    return SUBJECTS
      .filter((s) => {
        if (!tagQuery) return true;
        return (
          s.id.includes(tagQuery) ||
          s.name.toLowerCase().includes(tagQuery)
        );
      })
      .slice(0, 8);
  }, [tagMatch, tagQuery]);

  const showSuggestions = Boolean(tagMatch) && subjectSuggestions.length > 0;

  const applySubjectTag = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSelectedSubjects((prev) => [...prev, subjectId]);
    setSearchQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeSubjectTag = (subjectId: string) => {
    setSelectedSubjects((prev) => prev.filter((id) => id !== subjectId));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitSearch = () => {
    setSubmittedQuery(searchQuery.trim());
  };
  const clearSearch = () => {
    setSearchQuery('');
    setSubmittedQuery('');
    setSelectedSubjects([]);
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Discussions"
        description="Ask questions, share knowledge."
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            New post
          </Button>
        }
      />

      <main className="min-w-0 space-y-4 pt-2">
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
                placeholder="Search discussions or use #subject (e.g., #mathematics)"
              />
              <button
                type="button"
                onClick={submitSearch}
                className="inline-flex items-center gap-1 rounded-r-md border border-l-0 border-input bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                aria-label="Search discussions"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
            {activeSubjects.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeSubjects.map((subject) => (
                  <span
                    key={subject.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground"
                  >
                    #{subject.id}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => removeSubjectTag(subject.id)}
                      aria-label={`Remove ${subject.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {showSuggestions ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-md border border-border bg-popover shadow-sm">
                <div className="border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  Subjects
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {subjectSuggestions.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySubjectTag(subject.id)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium">#{subject.id}</div>
                        <div className="text-xs text-muted-foreground">{subject.name}</div>
                      </div>
                      {selectedSubjects.includes(subject.id) ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Added
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Filter by subject with #subject, like #physics or #azerbaijani-language.
          </p>
        </div>
        <DiscussionList
          refreshKey={refreshKey}
          query={submittedQuery}
          subjectIds={selectedSubjects}
          onClearSearch={clearSearch}
        />
      </main>

      <CreateDiscussionDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </DashboardShell>
  );
}
