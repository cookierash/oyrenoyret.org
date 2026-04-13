'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PiArrowFatDownBold as ArrowBigDown, PiArrowFatUpBold as ArrowBigUp, PiChatCircle as MessageSquare } from 'react-icons/pi';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CompactRichText, type CompactRichTextStats } from '@/src/components/rich-text/compact-rich-text';
import { StarRating } from '@/src/components/ui/star-rating';
import { PostAvatar } from '@/src/modules/discussions/post-avatar';
import { formatRelativeTime } from '@/src/modules/discussions/relative-time';
import { cn } from '@/src/lib/utils';
import { richTextHasContent } from '@/src/lib/rich-text';
import { sanitizeRichTextHtml } from '@/src/security/validation';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useCurrentUser } from '@/src/modules/auth/components/current-user-context';
import { ReportButton } from '@/src/modules/reports/report-user-button';
import { getWriteRestrictionMessage } from '@/src/lib/write-restriction';
import { AdminRemoveContentButton } from '@/src/modules/moderation/admin-remove-content-button';

interface MaterialReply {
  id: string;
  content: string;
  rating: number | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  voteScore: number;
  userVote?: 1 | -1 | null;
  removedAt?: string | null;
  removedReason?: string | null;
}

interface MaterialComment extends MaterialReply {
  replies: MaterialReply[];
}

type CommentsResponse = {
  comments?: MaterialComment[];
  ratingAvg?: number;
  ratingCount?: number;
  currentUserId?: string | null;
  materialAuthorId?: string | null;
  canComment?: boolean;
  canReview?: boolean;
};

const MAX_COMMENT_LENGTH = 2000;
type SortOption = 'newest' | 'oldest' | 'top';

function updateVoteInTree(
  comments: MaterialComment[],
  targetId: string,
  updater: (prevVote: 1 | -1 | null, prevScore: number) => { userVote: 1 | -1 | null; voteScore: number },
): MaterialComment[] {
  return comments.map((c) => {
    if (c.id === targetId) {
      const next = updater(c.userVote ?? null, c.voteScore);
      return { ...c, ...next };
    }
    const replies = c.replies.map((r) => {
      if (r.id !== targetId) return r;
      const next = updater(r.userVote ?? null, r.voteScore);
      return { ...r, ...next };
    });
    return replies === c.replies ? c : { ...c, replies };
  });
}

interface MaterialCommentsSectionProps {
  materialId: string;
  initialRatingAvg?: number;
  initialRatingCount?: number;
  initialCanComment?: boolean;
  initialCanReview?: boolean;
  /** Preview/read-only mode: viewers can only read existing comments. */
  readOnly?: boolean;
}

export function MaterialCommentsSection({
  materialId,
  initialRatingAvg = 0,
  initialRatingCount = 0,
  initialCanComment = false,
  initialCanReview = false,
  readOnly = false,
}: MaterialCommentsSectionProps) {
  const { locale, messages } = useI18n();
  const copy = messages.materials.comments;
  const { canWrite, writeRestriction } = useCurrentUser();
  const mountedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<MaterialComment[]>([]);
  const [, setRatingAvg] = useState(initialRatingAvg);
  const [, setRatingCount] = useState(initialRatingCount);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [materialAuthorId, setMaterialAuthorId] = useState<string | null>(null);
  const [canComment, setCanComment] = useState(initialCanComment);
  const [canReview, setCanReview] = useState(initialCanReview);
  const [sort, setSort] = useState<SortOption>('newest');

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewStats, setReviewStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });
  const [submitting, setSubmitting] = useState(false);

  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [dialogContent, setDialogContent] = useState('');
  const [dialogStats, setDialogStats] = useState<CompactRichTextStats>({ words: 0, characters: 0 });

  const reviewRemaining = MAX_COMMENT_LENGTH - reviewStats.characters;
  const dialogRemaining = MAX_COMMENT_LENGTH - dialogStats.characters;
  const canInteract = !readOnly && Boolean(currentUserId) && canComment && canWrite;
  const isMaterialAuthor = Boolean(currentUserId) && Boolean(materialAuthorId) && currentUserId === materialAuthorId;
  const canReplyAsAuthor = canInteract && isMaterialAuthor;
  const hasReviewed = Boolean(currentUserId) && comments.some((c) => c.authorId === currentUserId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchComments = useCallback(async () => {
    if (mountedRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/comments`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as CommentsResponse;
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      if (!mountedRef.current) return;
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setRatingAvg(typeof data.ratingAvg === 'number' ? data.ratingAvg : 0);
      setRatingCount(typeof data.ratingCount === 'number' ? data.ratingCount : 0);
      setCurrentUserId(data.currentUserId ?? null);
      setMaterialAuthorId(data.materialAuthorId ?? null);
      setCanComment(Boolean(data.canComment));
      setCanReview(Boolean(data.canReview));
    } catch (error) {
      if (!mountedRef.current) return;
      setComments([]);
      setCurrentUserId(null);
      setMaterialAuthorId(null);
      setCanComment(false);
      setCanReview(false);
      toast.error(formatErrorToast(copy.failedLoad, error instanceof Error ? error.message : null));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [materialId, copy.failedLoad]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const openReplyDialog = (parentCommentId: string) => {
    if (readOnly) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (!canReplyAsAuthor) return;
    setDialogParentId(parentCommentId);
    setDialogOpen(true);
  };

  const postReview = async () => {
    if (readOnly) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (!richTextHasContent(reviewContent)) return;
    if (canReview && !reviewRating) return;
    if (mountedRef.current) setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        content: String(reviewContent ?? '').trim(),
      };
      if (canReview) payload.rating = reviewRating;
      const res = await fetch(`/api/materials/${materialId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      if (!mountedRef.current) return;
      setReviewRating(0);
      setReviewContent('');
      setReviewStats({ words: 0, characters: 0 });
      await fetchComments();
      if (mountedRef.current) toast.success(copy.posted);
    } catch (error) {
      if (mountedRef.current) {
        toast.error(formatErrorToast(copy.failedPost, error instanceof Error ? error.message : null));
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const postReply = async () => {
    if (readOnly) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (!canReplyAsAuthor) return;
    if (!richTextHasContent(dialogContent)) return;
    if (!dialogParentId) return;
    if (mountedRef.current) setSubmitting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: String(dialogContent ?? '').trim(),
          parentCommentId: dialogParentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      if (!mountedRef.current) return;
      setDialogContent('');
      setDialogStats({ words: 0, characters: 0 });
      setDialogOpen(false);
      setDialogParentId(null);
      await fetchComments();
      if (mountedRef.current) toast.success(copy.replyPosted);
    } catch (error) {
      if (mountedRef.current) {
        toast.error(formatErrorToast(copy.failedReply, error instanceof Error ? error.message : null));
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleVote = async (commentId: string, value: 1 | -1) => {
    if (readOnly) return;
    if (!canWrite) {
      toast.error(getWriteRestrictionMessage(writeRestriction, messages.auth.errors.emailNotVerified));
      return;
    }
    if (voteLoading) return;
    const previous = comments;

    const optimistic = updateVoteInTree(comments, commentId, (prevVote, prevScore) => {
      const newVote = prevVote === value ? null : value;
      const delta = (newVote ?? 0) - (prevVote ?? 0);
      return { userVote: newVote, voteScore: prevScore + delta };
    });

    setComments(optimistic);
    setVoteLoading(commentId);
    try {
      const target = optimistic.find((c) => c.id === commentId) ?? null;
      const inReply = optimistic.some((c) => c.replies.some((r) => r.id === commentId));
      // Determine newVote by reading the optimistic state.
      let newVote: 1 | -1 | null = null;
      if (target) newVote = target.userVote ?? null;
      if (!target && inReply) {
        for (const c of optimistic) {
          const r = c.replies.find((x) => x.id === commentId);
          if (r) {
            newVote = r.userVote ?? null;
            break;
          }
        }
      }

      const res = await fetch(`/api/materials/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newVote ?? 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
    } catch (error) {
      if (mountedRef.current) {
        setComments(previous);
        toast.error(formatErrorToast(copy.failedVote, error instanceof Error ? error.message : null));
      }
    } finally {
      if (mountedRef.current) setVoteLoading(null);
    }
  };

  const deleteComment = async () => {
    if (readOnly) return;
    if (!deleteTargetId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/materials/comments/${deleteTargetId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? '');
      toast.success(copy.deleted);
      setDeleteTargetId(null);
      await fetchComments();
    } catch (error) {
      toast.error(formatErrorToast(copy.failedDelete, error instanceof Error ? error.message : null));
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  };

  const sortedComments = useMemo(() => {
    const cloned = comments.slice();
    const byCreatedAt = (a: MaterialComment, b: MaterialComment) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const byTop = (a: MaterialComment, b: MaterialComment) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    if (sort === 'oldest') cloned.sort(byCreatedAt);
    else if (sort === 'top') cloned.sort(byTop);
    else cloned.sort((a, b) => byCreatedAt(b, a)); // newest

    return cloned.map((c) => ({
      ...c,
      replies: c.replies
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }));
  }, [comments, sort]);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-px w-full bg-border/70" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-full sm:w-52" />
        </div>
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  return (
    <>
      <section className="space-y-4">
        <div className="h-px w-full bg-border/70" />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-xl font-medium tracking-tight">{copy.title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="w-full sm:w-56">
            <Select
              aria-label={copy.sortLabel}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
            >
              <SelectItem value="newest">{copy.sortOptions.newest}</SelectItem>
              <SelectItem value="oldest">{copy.sortOptions.oldest}</SelectItem>
              <SelectItem value="top">{copy.sortOptions.top}</SelectItem>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
          {canInteract && !hasReviewed ? (
            <div className="flex gap-3 px-4 py-4 border-b border-border/60">
              <PostAvatar userId={currentUserId ?? undefined} authorName={copy.youLabel} size="sm" />
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {canReview ? (
                    <div className="flex items-center gap-2">
                      <StarRating value={reviewRating} onChange={setReviewRating} ariaLabel={copy.yourRating} />
                      <span className="text-xs text-muted-foreground">
                        {reviewRating
                          ? copy.starsSelected.replace('{{count}}', String(reviewRating))
                          : copy.ratingRequired}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {copy.subtitle}
                    </div>
                  )}
                  <Button
                    size="sm"
                    onClick={postReview}
                    disabled={
                      submitting ||
                      (canReview ? !reviewRating : false) ||
                      !richTextHasContent(reviewContent) ||
                      reviewStats.characters > MAX_COMMENT_LENGTH
                    }
                  >
                    {copy.post}
                  </Button>
                </div>

                <CompactRichText
                  value={reviewContent}
                  onChange={setReviewContent}
                  onStatsChange={setReviewStats}
                  placeholder={copy.placeholder}
                  ariaLabel={copy.placeholder}
                  minHeightClass="min-h-[120px]"
                  toolbarVisibility="always"
                />

                {reviewRemaining <= 0 ? (
                  <div className="text-right text-xs text-destructive">
                    {copy.charactersLeft.replace('{{count}}', String(reviewRemaining))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {sortedComments.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">{copy.empty}</div>
          ) : (
            sortedComments.map((c) => (
              <div
                key={c.id}
                className="group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30 border-b border-border last:border-0"
              >
                <PostAvatar userId={c.authorId} authorName={c.authorName} size="sm" />

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground text-sm">{c.authorName}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatRelativeTime(c.createdAt, locale)}</span>
                    {c.rating ? (
                      <span className="ml-1 inline-flex items-center gap-2">
                        <StarRating
                          value={c.rating}
                          ariaLabel={copy.ratingAria.replace('{{count}}', String(c.rating))}
                          sizeClass="h-3.5 w-3.5"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {copy.starsSelected.replace('{{count}}', String(c.rating))}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="document-editor-content text-[13px] text-foreground/90 leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(c.content) }}
                  />

                  <div className="flex items-center gap-2 -ml-1">
                    <div className="flex items-center bg-muted/50 rounded-md border border-border/50 overflow-hidden">
                      <button
                        onClick={() => handleVote(c.id, 1)}
                        disabled={!!voteLoading || !canInteract || Boolean(c.removedAt)}
                        aria-label={copy.upvote}
                        className={cn(
                          'flex items-center justify-center p-1.5 transition-colors',
                          c.userVote === 1
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-primary',
                        )}
                      >
                        <ArrowBigUp className={cn('h-4 w-4', c.userVote === 1 && 'fill-current')} />
                      </button>

                      <span
                        className={cn(
                          'px-1 text-[13px] font-medium min-w-[1.5rem] text-center',
                          c.voteScore > 0
                            ? 'text-primary'
                            : c.voteScore < 0
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        )}
                      >
                        {c.voteScore}
                      </span>

                      <button
                        onClick={() => handleVote(c.id, -1)}
                        disabled={!!voteLoading || !canInteract || Boolean(c.removedAt)}
                        aria-label={copy.downvote}
                        className={cn(
                          'flex items-center justify-center p-1.5 transition-colors',
                          c.userVote === -1
                            ? 'text-destructive bg-destructive/10'
                            : 'text-muted-foreground hover:text-destructive',
                        )}
                      >
                        <ArrowBigDown className={cn('h-4 w-4', c.userVote === -1 && 'fill-current')} />
                      </button>
                    </div>

                    {canReplyAsAuthor && !c.removedAt ? (
                      <button
                        onClick={() => openReplyDialog(c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{copy.replyAction}</span>
                      </button>
                    ) : null}

                    <div className="ml-auto">
                      <div className="flex items-center gap-2">
                        <ReportButton
                          reportedUserId={c.authorId}
                          reportedUserPublicId={null}
                          reportedUserName={c.authorName}
                          targetType="MATERIAL_COMMENT"
                          targetId={c.id}
                          buttonVariant="danger"
                          buttonClassName="h-7 px-2 text-[11px]"
                        />
                        {!readOnly && currentUserId === c.authorId ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTargetId(c.id)}
                            disabled={deleting}
                            className="h-7 px-2 text-[11px]"
                          >
                            {copy.delete}
                          </Button>
                        ) : null}
                        <AdminRemoveContentButton
                          targetType="MATERIAL_COMMENT"
                          targetId={c.id}
                          label="Remove"
                          buttonVariant="ghost"
                          onRemoved={() => fetchComments()}
                        />
                      </div>
                    </div>
                  </div>

                  {c.removedAt ? (
                    <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                      <div className="font-medium">Removed by moderators</div>
                      {c.removedReason ? (
                        <div className="mt-1 text-muted-foreground">
                          Message from the moderators: {c.removedReason}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {c.replies.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l border-border/60 pl-3">
                      {c.replies.map((r) => (
                        <div key={r.id} className="rounded-md bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <PostAvatar userId={r.authorId} authorName={r.authorName} size="xs" />
                            <span className="font-medium text-foreground/90">{r.authorName}</span>
                            {materialAuthorId && r.authorId === materialAuthorId ? (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {copy.authorBadge}
                              </span>
                            ) : null}
                            <span className="opacity-40">·</span>
                            <span>{formatRelativeTime(r.createdAt, locale)}</span>
                          </div>

                          <div
                            className="document-editor-content text-[13px] text-foreground/90 leading-relaxed break-words mt-2"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(r.content) }}
                          />
                          {r.removedAt ? (
                            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                              <div className="font-medium">Removed by moderators</div>
                              {r.removedReason ? (
                                <div className="mt-1 text-muted-foreground">
                                  Message from the moderators: {r.removedReason}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="flex items-center gap-2 -ml-1 mt-2">
                            <div className="flex items-center bg-muted/50 rounded-md border border-border/50 overflow-hidden">
                              <button
                                onClick={() => handleVote(r.id, 1)}
                                disabled={!!voteLoading || !canInteract || Boolean(r.removedAt)}
                                aria-label={copy.upvote}
                                className={cn(
                                  'flex items-center justify-center p-1.5 transition-colors',
                                  r.userVote === 1
                                    ? 'text-primary bg-primary/10'
                                    : 'text-muted-foreground hover:text-primary',
                                )}
                              >
                                <ArrowBigUp className={cn('h-4 w-4', r.userVote === 1 && 'fill-current')} />
                              </button>

                              <span
                                className={cn(
                                  'px-1 text-[13px] font-medium min-w-[1.5rem] text-center',
                                  r.voteScore > 0
                                    ? 'text-primary'
                                    : r.voteScore < 0
                                      ? 'text-destructive'
                                      : 'text-muted-foreground',
                                )}
                              >
                                {r.voteScore}
                              </span>

                              <button
                                onClick={() => handleVote(r.id, -1)}
                                disabled={!!voteLoading || !canInteract || Boolean(r.removedAt)}
                                aria-label={copy.downvote}
                                className={cn(
                                  'flex items-center justify-center p-1.5 transition-colors',
                                  r.userVote === -1
                                    ? 'text-destructive bg-destructive/10'
                                    : 'text-muted-foreground hover:text-destructive',
                                )}
                              >
                                <ArrowBigDown className={cn('h-4 w-4', r.userVote === -1 && 'fill-current')} />
                              </button>
                            </div>
                            <div className="ml-auto">
                              <div className="flex items-center gap-2">
                                <ReportButton
                                  reportedUserId={r.authorId}
                                  reportedUserPublicId={null}
                                  reportedUserName={r.authorName}
                                  targetType="MATERIAL_COMMENT"
                                  targetId={r.id}
                                  buttonVariant="danger"
                                  buttonClassName="h-7 px-2 text-[11px]"
                                />
                                {!readOnly && currentUserId === r.authorId ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setDeleteTargetId(r.id)}
                                    disabled={deleting}
                                    className="h-7 px-2 text-[11px]"
                                  >
                                    {copy.delete}
                                  </Button>
                                ) : null}
                                <AdminRemoveContentButton
                                  targetType="MATERIAL_COMMENT"
                                  targetId={r.id}
                                  label="Remove"
                                  buttonVariant="ghost"
                                  onRemoved={() => fetchComments()}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.dialogDescription}</AlertDialogDescription>
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
                onClick={postReply}
                disabled={submitting || !richTextHasContent(dialogContent) || dialogStats.characters > MAX_COMMENT_LENGTH}
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
            <AlertDialogAction variant="danger" onClick={deleteComment} disabled={deleting || !deleteTargetId}>
              {deleting ? copy.deleting : copy.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
