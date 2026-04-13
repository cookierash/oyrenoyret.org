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
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { CompactRichText, type CompactRichTextImage, type CompactRichTextStats } from '@/src/components/rich-text/compact-rich-text';
import { richTextHtmlToPlainText } from '@/src/lib/rich-text';
import { discussionRichTextHasContent } from '@/src/lib/discussion-rich-text';
import { appendDiscussionAttachmentsToHtml } from '@/src/lib/discussion-attachments';
import { MAX_DISCUSSION_IMAGES } from '@/src/config/uploads';
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
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { DiscussionRichText } from '@/src/modules/discussions/components/discussion-rich-text';
import { ReportButton } from '@/src/modules/reports/report-user-button';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';
import { AdminRemoveContentButton } from '@/src/modules/moderation/admin-remove-content-button';

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
  removedAt?: string | null;
  removedReason?: string | null;
  childReplies?: Reply[];
}

interface DiscussionSummary {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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

export default function ReplyPage() {
  const MAX_REPLY_LENGTH = 2000;
  const { id: rawId, replyId: rawReplyId } = useParams();
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const replyId = typeof rawReplyId === 'string' ? rawReplyId : Array.isArray(rawReplyId) ? rawReplyId[0] : '';
  const router = useRouter();
  const { locale, messages } = useI18n();
  const copy = messages.discussions.replyDetail;
  const { user: currentUser, canWrite, writeRestriction } = useCurrentUser();
  const isAdmin = currentUser.role === 'ADMIN';

  const [parentReply, setParentReply] = useState<Reply | null>(null);
  const [previousReply, setPreviousReply] = useState<Reply | null>(null);
  const [discussionInfo, setDiscussionInfo] = useState<DiscussionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadPath, setThreadPath] = useState<string[]>([]);
  const [childReplies, setChildReplies] = useState<Reply[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyStats, setReplyStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [replyAttachments, setReplyAttachments] = useState<CompactRichTextImage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [dialogStats, setDialogStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [dialogAttachments, setDialogAttachments] = useState<CompactRichTextImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canInteract = canWrite && !parentReply?.removedAt && !discussionInfo?.removedAt;

  useEffect(() => {
    if (!id || !replyId) return;
    setLoading(true);
    fetch(`/api/discussions/replies/${replyId}?discussionId=${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
        return data;
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
      .catch((error) => {
        toast.error(
          formatErrorToast(copy.failedLoadReply, error instanceof Error ? error.message : null),
        );
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      setChildReplies(data.replies ?? []);
    } catch (error) {
      toast.error(
        formatErrorToast(copy.failedLoadReplies, error instanceof Error ? error.message : null),
      );
      setChildReplies([]);
    } finally {
      setChildLoading(false);
    }
  }, [id, replyId]);

  useEffect(() => {
    loadChildReplies();
  }, [loadChildReplies]);

  const handleVote = async (value: 1 | -1) => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (parentReply?.removedAt) {
      toast.error(copy.removedReplyByModerators);
      return;
    }
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
    } catch (error) {
      toast.error(formatErrorToast(copy.failedVote, error instanceof Error ? error.message : null));
      setParentReply(parentReply);
    } finally {
      setVoteLoading(false);
    }
  };

  const deleteReply = async () => {
    if (!deleteTargetId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discussions/replies/${deleteTargetId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      toast.success(copy.deletedReply);
      const deletingCurrent = deleteTargetId === replyId;
      setDeleteTargetId(null);
      if (deletingCurrent) {
        const pathIds = threadPath.length ? threadPath : replyId ? [replyId] : [];
        const backHref =
          pathIds.length > 1
            ? `/discussions/${id}/replies/${pathIds[pathIds.length - 2]}`
            : `/discussions/${id}`;
        router.push(backHref);
        router.refresh();
        return;
      }
      await loadChildReplies();
      router.refresh();
    } catch (error) {
      toast.error(formatErrorToast(copy.failedDelete, error instanceof Error ? error.message : null));
    } finally {
      setDeleting(false);
    }
  };

  const submitReply = async (content: string) => {
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (parentReply?.removedAt || discussionInfo?.removedAt) {
      toast.error(copy.removedThreadByModerators);
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
          parentReplyId: replyId,
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(created) ?? '');
      setReplyContent('');
      setReplyStats({ words: 0, characters: 0 });
      setReplyAttachments([]);
      setDialogContent('');
      setDialogStats({ words: 0, characters: 0 });
      setDialogAttachments([]);
      setDialogOpen(false);
      if (created?.id) {
        router.push(`/discussions/${id}/replies/${created.id}`);
      } else {
        router.refresh();
        await loadChildReplies();
      }
    } catch (error) {
      toast.error(
        formatErrorToast(copy.failedPostReply, error instanceof Error ? error.message : null),
      );
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
                        <span className="text-xs font-medium text-foreground/80">
                          {previousReply.authorName}
                        </span>
                      </div>
                      <p className="mt-2 max-h-24 overflow-hidden text-sm text-foreground/80 whitespace-pre-wrap break-words">
                        {richTextHtmlToPlainText(previousReply.content)}
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
                        <span className="text-xs font-medium text-foreground/80">
                          {discussionInfo.authorName}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground/90 line-clamp-2 break-words">
                        {discussionInfo.title}
                      </p>
                      <p className="mt-1 max-h-20 overflow-hidden text-sm text-foreground/80 whitespace-pre-wrap break-words">
                        {richTextHtmlToPlainText(discussionInfo.content)}
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
                  <span className="font-medium text-foreground/70">
                    {parentReply.authorName}
                  </span>
                  <span className="px-1">·</span>
                  <span>{formatDateTime(parentReply.createdAt, locale)}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <ReportButton
                    reportedUserId={parentReply.authorId}
                    reportedUserPublicId={null}
                    reportedUserName={parentReply.authorName}
                    targetType="DISCUSSION_REPLY"
                    targetId={parentReply.id}
                    buttonVariant="danger"
                    buttonClassName="h-7 px-2 text-[11px]"
                  />
                  {currentUser.id === parentReply.authorId ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTargetId(parentReply.id)}
                      disabled={deleting}
                      className="h-7 px-2 text-[11px]"
                    >
                      {copy.deleteReply}
                    </Button>
                  ) : null}
                </div>
              </div>
              <DiscussionRichText content={parentReply.content} />
              {parentReply.removedAt ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                  <div className="font-medium">Removed by moderators</div>
                  {parentReply.removedReason ? (
                    <div className="mt-1 text-muted-foreground">
                      Message from the moderators: {parentReply.removedReason}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialogOpen(true)}
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
                    onClick={() => handleVote(1)}
                    disabled={voteLoading || !canInteract}
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
                      'min-w-[2rem] px-2 text-center text-xs font-medium',
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
                    disabled={voteLoading || !canInteract}
                    aria-label={copy.downvote}
                    className={cn(
                      'h-8 w-8 rounded-none text-muted-foreground hover:bg-muted/60',
                      parentReply.userVote === -1 && 'text-destructive bg-destructive/10'
                    )}
                  >
                    <ArrowBigDown className={cn('h-4 w-4', parentReply.userVote === -1 && 'fill-current')} />
                  </Button>
                </div>
                <ReportButton
                  reportedUserId={parentReply.authorId}
                  reportedUserPublicId={null}
                  reportedUserName={parentReply.authorName}
                  targetType="DISCUSSION_REPLY"
                  targetId={parentReply.id}
                  buttonVariant="danger"
                  buttonClassName="h-8 px-2 text-xs"
                />
                {isAdmin ? (
                  <AdminRemoveContentButton
                    targetType="DISCUSSION_REPLY"
                    targetId={parentReply.id}
                    label="Remove"
                    buttonVariant="outline"
                    onRemoved={() => router.refresh()}
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t border-border/60 pt-6">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-3">
			                    <CompactRichText
			                      value={replyContent}
			                      onChange={setReplyContent}
			                      onStatsChange={setReplyStats}
			                      placeholder={copy.replyPlaceholder}
			                      ariaLabel={copy.replyPlaceholder}
		                      minHeightClass="min-h-[96px]"
		                      toolbarVisibility="always"
		                      countsVisibility="none"
                          disabled={!canInteract}
		                      imageUploadEndpoint="/api/uploads/discussions/sign"
		                      imageMode="attachments"
		                      imageMaxImages={MAX_DISCUSSION_IMAGES}
			                      attachments={replyAttachments}
			                      onAttachmentsChange={setReplyAttachments}
		                    />
	                    <div className="flex items-center justify-between">
	                      <div />
			                      <Button
			                        size="sm"
			                        onClick={() =>
                                submitReply(
                                  appendDiscussionAttachmentsToHtml(replyContent, replyAttachments)
                                )
                              }
			                        disabled={
                                !canInteract ||
                                submitting ||
                                !discussionRichTextHasContent(
                                  appendDiscussionAttachmentsToHtml(replyContent, replyAttachments)
                                ) ||
                                replyStats.characters > MAX_REPLY_LENGTH
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
                              <span className="font-medium text-foreground/70">
                                {reply.authorName}
                              </span>
                              <span className="px-1">·</span>
                              <span>{formatDateTime(reply.createdAt, locale)}</span>
                            </div>
                            <div
                              className="ml-auto"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
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
                                {currentUser.id === reply.authorId ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setDeleteTargetId(reply.id)}
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
			              <CompactRichText
			                value={dialogContent}
			                onChange={setDialogContent}
			                onStatsChange={setDialogStats}
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
                          appendDiscussionAttachmentsToHtml(dialogContent, dialogAttachments)
                        )
                      }
		                  disabled={
                        submitting ||
                        !discussionRichTextHasContent(
                          appendDiscussionAttachmentsToHtml(dialogContent, dialogAttachments)
                        ) ||
                        dialogStats.characters > MAX_REPLY_LENGTH
                      }
		                >
		                  {copy.postReply}
		                </Button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(deleteTargetId)}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.deleteDialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction variant="danger" onClick={deleteReply} disabled={deleting || !deleteTargetId}>
                {deleting ? copy.deleting : copy.deleteConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </DashboardShell>
  );
}
