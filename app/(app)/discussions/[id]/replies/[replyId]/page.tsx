'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PiArrowFatUpBold as ArrowBigUp, PiArrowFatDownBold as ArrowBigDown, PiArrowLeft as ArrowLeft, PiChatCircle as MessageSquare } from 'react-icons/pi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/src/lib/utils';
import { getLocaleCode, type Locale } from '@/src/i18n';
import { useI18n } from '@/src/i18n/i18n-provider';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  discussionId?: string;
  parentReplyId?: string | null;
  childReplies?: Reply[];
}

interface DiscussionSummary {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

const formatDateTime = (iso: string, locale: Locale) => {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat(getLocaleCode(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const day = new Intl.DateTimeFormat(getLocaleCode(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${time} · ${day}`;
};

export default function ReplyPage() {
  const MAX_REPLY_LENGTH = 2000;
  const { id: rawId, replyId: rawReplyId } = useParams();
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const replyId = typeof rawReplyId === 'string' ? rawReplyId : Array.isArray(rawReplyId) ? rawReplyId[0] : '';
  const router = useRouter();
  const { locale, messages } = useI18n();
  const copy = messages.discussions.replyDetail;

  const [parentReply, setParentReply] = useState<Reply | null>(null);
  const [previousReply, setPreviousReply] = useState<Reply | null>(null);
  const [discussionInfo, setDiscussionInfo] = useState<DiscussionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadPath, setThreadPath] = useState<string[]>([]);
  const [childReplies, setChildReplies] = useState<Reply[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const replyRemaining = MAX_REPLY_LENGTH - replyContent.length;
  const dialogRemaining = MAX_REPLY_LENGTH - dialogContent.length;

  useEffect(() => {
    if (!id || !replyId) return;
    setLoading(true);
    fetch(`/api/discussions/replies/${replyId}?discussionId=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!data?.reply || data.reply.discussionId !== id) {
        throw new Error('Reply not found');
        }
        setParentReply(data.reply);
        setPreviousReply(data.parentReply ?? null);
        setDiscussionInfo(data.discussion ?? null);
        setThreadPath(Array.isArray(data.threadPath) ? data.threadPath : [replyId]);
      })
      .catch(() => {
        toast.error(copy.failedLoadReply);
        setParentReply(null);
        setPreviousReply(null);
        setDiscussionInfo(null);
        setThreadPath([]);
      })
      .finally(() => setLoading(false));
  }, [id, replyId]);

  const loadChildReplies = useCallback(async () => {
    if (!id || !replyId) return;
    setChildLoading(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies?parentReplyId=${replyId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChildReplies(data.replies ?? []);
    } catch {
      toast.error(copy.failedLoadReplies);
      setChildReplies([]);
    } finally {
      setChildLoading(false);
    }
  }, [id, replyId]);

  useEffect(() => {
    loadChildReplies();
  }, [loadChildReplies]);

  const handleVote = async (value: 1 | -1) => {
    if (!parentReply || voteLoading) return;

    const previousVote = parentReply.userVote ?? null;
    const newVote = previousVote === value ? null : value;
    const delta = (newVote ?? 0) - (previousVote ?? 0);

    const newReply = {
      ...parentReply,
      voteScore: parentReply.voteScore + delta,
      userVote: newVote,
    };
    setParentReply(newReply);
    setVoteLoading(true);

    try {
      const res = await fetch(`/api/discussions/replies/${replyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newVote ?? 0 }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(copy.failedVote);
      setParentReply(parentReply);
    } finally {
      setVoteLoading(false);
    }
  };

  const submitReply = async (content: string) => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          parentReplyId: replyId,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error('Failed to reply');
      setReplyContent('');
      setDialogContent('');
      setDialogOpen(false);
      if (created?.id) {
        router.push(`/discussions/${id}/replies/${created.id}`);
      } else {
        router.refresh();
        await loadChildReplies();
      }
    } catch {
      toast.error(copy.failedPostReply);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <main className="min-w-0 space-y-6 pb-12">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href="/discussions" className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {copy.back}
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-24 ml-auto" />
              <Skeleton className="h-4 w-32" />
            </div>
          </main>
      </DashboardShell>
    );
  }

  if (!parentReply) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div className="border-b border-border/60 py-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/discussions" className="inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                {copy.back}
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{copy.notFound}</p>
        </div>
      </DashboardShell>
    );
  }

  const pathIds = threadPath.length ? threadPath : replyId ? [replyId] : [];
  const backHref =
    pathIds.length > 1 ? `/discussions/${id}/replies/${pathIds[pathIds.length - 2]}` : `/discussions/${id}`;
  const threadSteps = [
    { label: copy.threadPost, href: `/discussions/${id}` },
    ...pathIds.map((stepId, index) => ({
      label: copy.threadReply.replace('{{count}}', String(index + 1)),
      href: `/discussions/${id}/replies/${stepId}`,
    })),
  ];

  return (
    <DashboardShell>
      <main className="lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:overflow-hidden">
          <div className="space-y-6 min-w-0 pb-12 lg:h-full lg:overflow-y-auto">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href={backHref} className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {copy.back}
                </Link>
              </Button>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 overflow-x-auto">
                {threadSteps.map((step, index) => (
                  <div
                    key={step.href}
                    className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border border-border/70',
                        index === threadSteps.length - 1
                          ? 'bg-foreground/70'
                          : 'bg-background'
                      )}
                    />
                    <Link
                      href={step.href}
                      className={cn(
                        'font-medium transition-colors',
                        index === threadSteps.length - 1
                          ? 'text-foreground'
                          : 'text-foreground/70 hover:text-foreground'
                      )}
                    >
                      {step.label}
                    </Link>
                    {index < threadSteps.length - 1 && (
                      <span className="h-px w-6 bg-border/60" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 min-w-0">
              {((previousReply ?? discussionInfo)) ? (
                previousReply ? (
                  <div className="relative pl-6">
                    <span className="absolute left-3 top-0 bottom-0 w-px bg-border/60" />
                    <Link
                      href={`/discussions/${id}/replies/${previousReply.id}`}
                      className="block py-2 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(previousReply.createdAt, locale)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <PostAvatar
                          userId={previousReply.authorId}
                          authorName={previousReply.authorName}
                          size="xs"
                        />
                        <span className="text-xs font-semibold text-foreground/80">
                          {previousReply.authorName}
                        </span>
                      </div>
                      <p className="mt-2 max-h-24 overflow-hidden text-sm text-foreground/80 whitespace-pre-wrap break-words">
                        {previousReply.content}
                      </p>
                    </Link>
                  </div>
                ) : discussionInfo ? (
                  <div className="relative pl-6">
                    <span className="absolute left-3 top-0 bottom-0 w-px bg-border/60" />
                    <Link
                      href={`/discussions/${id}`}
                      className="block py-2 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(discussionInfo.createdAt, locale)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <PostAvatar
                          userId={discussionInfo.authorId}
                          authorName={discussionInfo.authorName}
                          size="xs"
                        />
                        <span className="text-xs font-semibold text-foreground/80">
                          {discussionInfo.authorName}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground/90 line-clamp-2 break-words">
                        {discussionInfo.title}
                      </p>
                      <p className="mt-1 max-h-20 overflow-hidden text-sm text-foreground/80 whitespace-pre-wrap break-words">
                        {discussionInfo.content}
                      </p>
                    </Link>
                  </div>
                ) : null
              ) : null}
              <div className="flex items-center gap-2">
                <PostAvatar
                  userId={parentReply.authorId}
                  authorName={parentReply.authorName}
                  size="xs"
                />
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/70">
                    {parentReply.authorName}
                  </span>
                  <span className="px-1">·</span>
                  <span>{formatDateTime(parentReply.createdAt, locale)}</span>
                </div>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
                {parentReply.content}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialogOpen(true)}
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {copy.replyAction}
                </Button>
                <div className="flex items-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote(1)}
                    disabled={voteLoading}
                    aria-label={copy.upvote}
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      parentReply.userVote === 1 && 'text-primary bg-primary/10'
                    )}
                  >
                    <ArrowBigUp className={cn('h-4 w-4', parentReply.userVote === 1 && 'fill-current')} />
                  </Button>
                  <span
                    className={cn(
                      'min-w-[2rem] px-2 text-center text-xs font-semibold',
                      parentReply.voteScore > 0
                        ? 'text-primary'
                        : parentReply.voteScore < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {parentReply.voteScore}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote(-1)}
                    disabled={voteLoading}
                    aria-label={copy.downvote}
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      parentReply.userVote === -1 && 'text-destructive bg-destructive/10'
                    )}
                  >
                    <ArrowBigDown className={cn('h-4 w-4', parentReply.userVote === -1 && 'fill-current')} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-6">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-3">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={copy.replyPlaceholder}
                      className="w-full min-h-[96px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      maxLength={MAX_REPLY_LENGTH}
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {replyRemaining <= 100
                          ? copy.charactersLeft.replace('{{count}}', String(replyRemaining))
                          : ''}
                      </div>
                      <Button size="sm" onClick={() => submitReply(replyContent)} disabled={submitting || !replyContent.trim()}>
                        {copy.replyAction}
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">{copy.repliesTitle}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {copy.repliesSubtitle}
                  </p>
                </div>
                {childLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : childReplies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noReplies}</p>
                ) : (
                  <div className="space-y-3">
                    {childReplies.map((reply) => (
                      <Link
                        key={reply.id}
                        href={`/discussions/${id}/replies/${reply.id}`}
                        className="block rounded-lg border border-border/60 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <PostAvatar
                              userId={reply.authorId}
                              authorName={reply.authorName}
                              size="xs"
                            />
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground/70">
                                {reply.authorName}
                              </span>
                              <span className="px-1">·</span>
                              <span>{formatDateTime(reply.createdAt, locale)}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                            {reply.content}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {copy.dialogDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <textarea
                value={dialogContent}
                onChange={(e) => setDialogContent(e.target.value)}
                placeholder={copy.dialogPlaceholder}
                className="w-full h-[180px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={MAX_REPLY_LENGTH}
              />
              {dialogRemaining <= 100 ? (
                <div className="text-right text-xs text-muted-foreground">
                  {copy.charactersLeft.replace('{{count}}', String(dialogRemaining))}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {copy.cancel}
                </Button>
                <Button
                  onClick={() => submitReply(dialogContent)}
                  disabled={submitting || !dialogContent.trim()}
                >
                  {copy.postReply}
                </Button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>
    </DashboardShell>
  );
}
