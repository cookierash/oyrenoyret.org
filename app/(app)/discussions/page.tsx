/**
 * Discussions Page
 *
 * X-like discussions: create, list, reply, vote.
 * Uses a content + right sidebar layout within the app's main content area.
 */

'use client';

import { useState } from 'react';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { CreateDiscussionDialog } from '@/src/modules/discussions/create-discussion-dialog';
import { DiscussionList } from '@/src/modules/discussions/discussion-list';
import { Info, TrendingUp } from 'lucide-react';

export default function DiscussionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Main Feed */}
        <div className="min-w-0 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
              <p className="text-sm text-muted-foreground mt-1">Ask questions and share knowledge.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="rounded-full px-5 font-bold"
              onClick={() => setShowCreate(true)}
            >
              New post
            </Button>
          </div>

          <main className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
            <DiscussionList refreshKey={refreshKey} />
          </main>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden lg:block space-y-6 sticky top-6">
          <section className="bg-muted/30 rounded-xl p-5 border border-border/50">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-primary" />
              Community Rules
            </h2>
            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <p>Be respectful and professional to other students.</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <p>Keep discussions academic or career-focused.</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <p>Search for existing topics before creating a new post.</p>
              </div>
            </div>
          </section>

          <section className="bg-muted/30 rounded-xl p-5 border border-border/50">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trending Discussions
            </h2>
            <div className="space-y-4 font-medium">
              <div className="space-y-1 group cursor-pointer">
                <p className="text-[13px] line-clamp-2 group-hover:text-primary transition-colors">How to handle React hydration mismatch?</p>
                <p className="text-[11px] text-muted-foreground">12 upvotes · 5 replies</p>
              </div>
              <div className="space-y-1 group cursor-pointer">
                <p className="text-[13px] line-clamp-2 group-hover:text-primary transition-colors">Best practices for Prisma types in Next.js</p>
                <p className="text-[11px] text-muted-foreground">8 upvotes · 3 replies</p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <CreateDiscussionDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </DashboardShell>
  );
}
