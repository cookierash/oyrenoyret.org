/**
 * Discussion Detail Page
 *
 * Single post with replies and voting.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Button } from '@/components/ui/button';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { PiArrowFatUpBold as ArrowBigUp, PiArrowFatDownBold as ArrowBigDown, PiChatCircle as MessageSquare, PiArrowLeft as ArrowLeft } from 'react-icons/pi';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocaleCode, type Locale } from '@/src/i18n';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { CompactRichText, type CompactRichTextStats } from '@/src/components/rich-text/compact-rich-text';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';
import { discussionRichTextHasContent } from '@/src/lib/discussion-rich-text';
import { appendDiscussionAttachmentsToHtml } from '@/src/lib/discussion-attachments';
import { MAX_DISCUSSION_IMAGES } from '@/src/config/uploads';
import type { CompactRichTextImage } from '@/src/components/rich-text/compact-rich-text';
import { DiscussionRichText } from '@/src/modules/discussions/components/discussion-rich-text';
import { ReportButton } from '@/src/modules/reports/report-user-button';
import { AdminRemoveContentButton } from '@/src/modules/moderation/admin-remove-content-button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';

interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  removedAt?: string | null;
  removedReason?: string | null;
  childReplies?: Reply[];
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  replies: Reply[];
  archivedAt?: string | null;
  acceptedReplyId?: string | null;
  currentUserId?: string | null;
  removedAt?: string | null;
  removedReason?: string | null;
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

export default function DiscussionDetailPage() {
  const MAX_REPLY_LENGTH = 2000;
  const params = useParams();
  const router = useRouter();
  const { locale, messages } = useI18n();
  const copy = messages.discussions.detail;
  const { user: currentUser, canWrite, writeRestriction } = useCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';
  const id = params.id as string;
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingReplyId, setAcceptingReplyId] = useState<string | null>(null);
  const [inlineReply, setInlineReply] = useState('');
  const [inlineReplyStats, setInlineReplyStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [inlineAttachments, setInlineAttachments] = useState<CompactRichTextImage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [dialogReplyStats, setDialogReplyStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [dialogAttachments, setDialogAttachments] = useState<CompactRichTextImage[]>([]);
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [deleteDiscussionOpen, setDeleteDiscussionOpen] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canInteract = canWrite && !discussion?.removedAt;

  const fetchDiscussion = useCallback(async () => {
    try {
      const res = await fetch(`/api/discussions/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          setDiscussion(null);
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setDiscussion(data);
      setCurrentUserId(data?.currentUserId ?? null);
    } catch {
      setDiscussion(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDiscussion();
  }, [fetchDiscussion]);

  const handleVote = async (target: 'discussion' | 'reply', targetId: string, value: 1 | -1) => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (discussion?.removedAt) {
      toast.error('This post was removed by moderators.');
      return;
    }
    if (!discussion || voteLoading) return;

    let previousVote: 1 | -1 | null = null;
    let newVote: 1 | -1 | null = null;

    // Optimistic update
    const newDiscussion = { ...discussion };
    if (target === 'discussion') {
      previousVote = newDiscussion.userVote ?? null;
      newVote = previousVote === value ? null : value;
      const delta = (newVote ?? 0) - (previousVote ?? 0);
      newDiscussion.voteScore += delta;
      newDiscussion.userVote = newVote;
    } else {
      newDiscussion.replies = newDiscussion.replies.map((r) => {
        if (r.id === targetId) {
          previousVote = r.userVote ?? null;
          newVote = previousVote === value ? null : value;
          const delta = (newVote ?? 0) - (previousVote ?? 0);
          return { ...r, voteScore: r.voteScore + delta, userVote: newVote };
        }
        return r;
      });
    }

    setDiscussion(newDiscussion);
    setVoteLoading(targetId);

    try {
      const url =
        target === 'discussion'
          ? `/api/discussions/${targetId}/vote`
          : `/api/discussions/replies/${targetId}/vote`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newVote ?? 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
    } catch (error) {
      toast.error(formatErrorToast(copy.failedVote, error instanceof Error ? error.message : null));
      setDiscussion(discussion);
    } finally {
      setVoteLoading(null);
    }
  };

  const handleAcceptReply = async (replyId: string) => {
    setAcceptingReplyId(replyId);
    try {
      const res = await fetch(`/api/discussions/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      router.refresh();
      fetchDiscussion();
      toast.success(copy.markedBest);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.failedAccept, error instanceof Error ? error.message : null),
      );
    } finally {
      setAcceptingReplyId(null);
    }
  };

  const deleteDiscussion = async () => {
    if (!discussion || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      toast.success(copy.deletedPost);
      setDeleteDiscussionOpen(false);
      router.push('/discussions');
      router.refresh();
    } catch (error) {
      toast.error(formatErrorToast(copy.failedDelete, error instanceof Error ? error.message : null));
    } finally {
      setDeleting(false);
    }
  };

  const deleteReply = async () => {
    if (!deleteReplyId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discussions/replies/${deleteReplyId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      toast.success(copy.deletedReply);
      setDeleteReplyId(null);
      router.refresh();
      fetchDiscussion();
    } catch (error) {
      toast.error(formatErrorToast(copy.failedDelete, error instanceof Error ? error.message : null));
    } finally {
      setDeleting(false);
    }
  };

  const submitReply = async (content: string, parentReplyId?: string | null) => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (discussion?.removedAt) {
      toast.error('This post was removed by moderators.');
      return;
    }
    if (!discussionRichTextHasContent(content)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: String(content ?? '').trim(),
          parentReplyId: parentReplyId || undefined,
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(created) ?? '');
      setInlineReply('');
      setInlineReplyStats({ words: 0, characters: 0 });
      setInlineAttachments([]);
      setDialogContent('');
      setDialogReplyStats({ words: 0, characters: 0 });
      setDialogAttachments([]);
      setDialogOpen(false);
      router.refresh();
      if (created?.id) {
        router.push(`/discussions/${id}/replies/${created.id}`);
      } else {
        fetchDiscussion();
      }
    } catch (error) {
      toast.error(
        formatErrorToast(copy.failedReply, error instanceof Error ? error.message : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openReplyDialog = (parentReplyId?: string) => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (discussion?.removedAt) {
      toast.error('This post was removed by moderators.');
      return;
    }
    setDialogParentId(parentReplyId ?? null);
    setDialogOpen(true);
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
              <Skeleton className="h-7 w-2/3" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
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

  if (!discussion) {
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

  const replyCount = discussion.replies?.length ?? 0;
  const replyVoteTotal = (discussion.replies ?? []).reduce((total, reply) => {
    const childTotal = (reply.childReplies ?? []).reduce(
      (childSum, child) => childSum + (child.voteScore ?? 0),
      0
    );
    return total + (reply.voteScore ?? 0) + childTotal;
  }, 0);
  const netPopularity = discussion.voteScore + replyVoteTotal;

  return (
    <DashboardShell>
      <main className="lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:overflow-hidden">
          <div className="space-y-6 min-w-0 pb-12 lg:h-full lg:overflow-y-auto">
            <div className="border-b border-border/60 py-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href="/discussions" className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {copy.back}
                </Link>
              </Button>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2">
                <PostAvatar
                  userId={discussion.authorId}
                  authorName={discussion.authorName}
                  size="xs"
                />
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">
                    {discussion.authorName}
                  </span>
                  <span className="px-1">·</span>
                  <span>{formatDateTime(discussion.createdAt, locale)}</span>
                </div>
              </div>
              <h1 className="text-[15px] font-semibold text-foreground break-words">
                {discussion.title}
              </h1>
              <DiscussionRichText content={discussion.content} />
              {discussion.removedAt ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                  <div className="font-medium">Removed by moderators</div>
                  {discussion.removedReason ? (
                    <div className="mt-1 text-muted-foreground">
                      Message from the moderators: {discussion.removedReason}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReplyDialog()}
                  disabled={!canInteract}
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {copy.replyAction}
                </Button>
                <div className="flex items-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote('discussion', discussion.id, 1)}
                    disabled={!!voteLoading || !canInteract}
                    aria-label={copy.upvote}
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      discussion.userVote === 1 && 'text-primary bg-primary/10'
                    )}
                  >
                    <ArrowBigUp className={cn('h-4 w-4', discussion.userVote === 1 && 'fill-current')} />
                  </Button>
                  <span
                    className={cn(
                      'min-w-[2rem] px-2 text-center text-xs font-medium',
                      netPopularity > 0
                        ? 'text-primary'
                        : netPopularity < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {netPopularity}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleVote('discussion', discussion.id, -1)}
                    disabled={!!voteLoading || !canInteract}
                    aria-label={copy.downvote}
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      discussion.userVote === -1 && 'text-destructive bg-destructive/10'
                    )}
                  >
                    <ArrowBigDown className={cn('h-4 w-4', discussion.userVote === -1 && 'fill-current')} />
                  </Button>
                </div>

                <ReportButton
                  reportedUserId={discussion.authorId}
                  reportedUserPublicId={null}
                  reportedUserName={discussion.authorName}
                  targetType="DISCUSSION"
                  targetId={discussion.id}
                  buttonVariant="danger"
                  buttonClassName="h-8 px-2 text-xs"
                />
                {currentUserId === discussion.authorId ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteDiscussionOpen(true)}
                    disabled={deleting}
                    className="h-8 px-2 text-xs"
                  >
                    {copy.deletePost}
                  </Button>
                ) : null}
                {isAdmin ? (
                  <AdminRemoveContentButton
                    targetType="DISCUSSION"
                    targetId={discussion.id}
                    label="Remove"
                    buttonVariant="outline"
                    onRemoved={() => fetchDiscussion()}
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t border-border/60 pt-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-3">
                    <CompactRichText
                      value={inlineReply}
                      onChange={setInlineReply}
                      onStatsChange={setInlineReplyStats}
                      placeholder={copy.replyPlaceholder}
                      ariaLabel={copy.replyPlaceholder}
                      minHeightClass="min-h-[96px]"
                      toolbarVisibility="always"
                      countsVisibility="none"
                      // Moderation removal makes the post read-only.
                      // Server already filters access; this is a UX guard.
                      disabled={!canInteract}
                      imageUploadEndpoint="/api/uploads/discussions/sign"
                      imageMode="attachments"
                      imageMaxImages={MAX_DISCUSSION_IMAGES}
                      attachments={inlineAttachments}
                      onAttachmentsChange={setInlineAttachments}
                    />
                    <div className="flex items-center justify-between">
                      <div />
                      <Button
                        size="sm"
                        onClick={() => submitReply(appendDiscussionAttachmentsToHtml(inlineReply, inlineAttachments))}
                        disabled={
                          !canInteract ||
                          submitting ||
                          !discussionRichTextHasContent(appendDiscussionAttachmentsToHtml(inlineReply, inlineAttachments)) ||
                          inlineReplyStats.characters > MAX_REPLY_LENGTH
                        }
                      >
                        {copy.replyAction}
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-foreground">{copy.repliesTitle}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {copy.repliesSubtitle}
                  </p>
                </div>

                {replyCount > 0 ? (
                  <div className="space-y-3">
                    {discussion.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg border border-border/60 bg-muted/10 p-3 transition-colors hover:bg-muted/20 cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/discussions/${id}/replies/${reply.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/discussions/${id}/replies/${reply.id}`);
                          }
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <PostAvatar
                              userId={reply.authorId}
                              authorName={reply.authorName}
                              size="xs"
                            />
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">
                                {reply.authorName}
                              </span>
                              <span className="px-1">·</span>
                              <span>{formatDateTime(reply.createdAt, locale)}</span>
                            </div>
                            <div
                              className="ml-auto"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              role="presentation"
                            >
                              <div className="flex items-center gap-2">
                                <ReportButton
                                  reportedUserId={reply.authorId}
                                  reportedUserPublicId={null}
                                  reportedUserName={reply.authorName}
                                  targetType="DISCUSSION_REPLY"
                                  targetId={reply.id}
                                  buttonVariant="danger"
                                  buttonClassName="h-7 px-2 text-[11px]"
                                />
                                {currentUserId === reply.authorId ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setDeleteReplyId(reply.id)}
                                    disabled={deleting}
                                    className="h-7 px-2 text-[11px]"
                                  >
                                    {copy.deleteReply}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <DiscussionRichText content={reply.content} />
                          {reply.removedAt ? (
                            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                              <div className="font-medium">Removed by moderators</div>
                              {reply.removedReason ? (
                                <div className="mt-1 text-muted-foreground">
                                  Message from the moderators: {reply.removedReason}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {currentUserId === discussion?.authorId &&
                            reply.authorId !== discussion.authorId &&
                            !reply.removedAt &&
                            !discussion?.archivedAt && (
                              <div className="pt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptReply(reply.id);
                                  }}
                                  disabled={acceptingReplyId === reply.id}
                                  className={cn(
                                    'text-xs font-medium transition-colors',
                                    discussion?.acceptedReplyId === reply.id
                                      ? 'text-primary'
                                      : 'text-muted-foreground hover:text-primary'
                                  )}
                                >
                                  {discussion?.acceptedReplyId === reply.id
                                    ? copy.bestAnswer
                                    : copy.acceptBestAnswer}
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{copy.noReplies}</p>
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
              <CompactRichText
                value={dialogContent}
                onChange={setDialogContent}
                onStatsChange={setDialogReplyStats}
                placeholder={copy.dialogPlaceholder}
                ariaLabel={copy.dialogPlaceholder}
                minHeightClass="min-h-[180px]"
                toolbarVisibility="always"
                countsVisibility="none"
                imageUploadEndpoint="/api/uploads/discussions/sign"
                imageMode="attachments"
                imageMaxImages={MAX_DISCUSSION_IMAGES}
                attachments={dialogAttachments}
                onAttachmentsChange={setDialogAttachments}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {copy.cancel}
                </Button>
                <Button
                  onClick={() =>
                    submitReply(
                      appendDiscussionAttachmentsToHtml(dialogContent, dialogAttachments),
                      dialogParentId
                    )
                  }
                  disabled={
                    submitting ||
                    !discussionRichTextHasContent(
                      appendDiscussionAttachmentsToHtml(dialogContent, dialogAttachments)
                    ) ||
                    dialogReplyStats.characters > MAX_REPLY_LENGTH
                  }
                >
                  {copy.postReply}
                </Button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteDiscussionOpen} onOpenChange={setDeleteDiscussionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.deleteDialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction variant="danger" onClick={deleteDiscussion} disabled={deleting}>
                {deleting ? copy.deleting : copy.deleteConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(deleteReplyId)}
          onOpenChange={(open) => {
            if (!open) setDeleteReplyId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.deleteReplyDialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteReplyDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction variant="danger" onClick={deleteReply} disabled={deleting || !deleteReplyId}>
                {deleting ? copy.deleting : copy.deleteConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </DashboardShell>
  );
}
