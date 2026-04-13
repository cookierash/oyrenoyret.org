'use client';

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import Link from 'next/link';
import { PiWarningCircle as AlertCircle, PiCalendar as Calendar, PiClock as Clock, PiCoins as Coins, PiChatCircle as MessageSquare, PiShieldCheck as ShieldCheck, PiArrowCircleUp as CreditUp, PiArrowCircleDown as CreditDown } from 'react-icons/pi';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectItem } from '@/components/ui/select';
import { dispatchCreditsUpdated } from '@/src/lib/credits-events';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';
import { useSettings } from '@/src/components/settings/settings-provider';
import { getLocaleCode } from '@/src/i18n';

type ReplyNotificationItem = {
  type: 'reply';
  id: string;
  discussionId: string;
  replyId: string;
  createdAt: string;
  authorName: string;
  discussionTitle: string;
  contextType: 'reply' | 'discussion';
  contentPreview: string;
};

type CreditActivityItem = {
  type: 'credit';
  id: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  label: string;
};

type SprintEnrollmentItem = {
  type: 'sprint';
  id: string;
  liveEventId: string;
  topic: string;
  date: string;
  creditCost: number;
  durationMinutes: number;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null;
  createdAt: string;
};

type ModerationNoticeItem = {
  type: 'moderation';
  id: string;
  noticeType: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  createdAt: string;
};

type CombinedMessageItem =
  | ReplyNotificationItem
  | CreditActivityItem
  | SprintEnrollmentItem
  | ModerationNoticeItem;

function SprintEnrollmentRow({
  item,
  onRefresh,
}: {
  item: SprintEnrollmentItem;
  onRefresh?: () => void;
}) {
  const { locale, messages, t } = useI18n();
  const { timeFormat } = useSettings();
  const copy = messages.recentActivities.sprint;
  const localeCode = getLocaleCode(locale);
  const hour12 =
    timeFormat === '12-hour' ? true : timeFormat === '24-hour' ? false : undefined;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [localeCode],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        hour: 'numeric',
        minute: '2-digit',
        ...(hour12 === undefined ? {} : { hour12 }),
      }),
    [localeCode, hour12],
  );
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [rulesRead, setRulesRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isCancelled = item.status === 'CANCELLED';
  const eventDate = new Date(item.date);
  const createdTime = new Date(item.createdAt);
  const rulesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = rulesRef.current;
    if (!node) return;
    if (node.scrollHeight <= node.clientHeight + 2) {
      setRulesRead(true);
    }
  }, [open, item.id]);

  const handleRulesScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 4) {
      setRulesRead(true);
    }
  };

  const handleConfirm = async () => {
    if (submitting) return;
    if (isCancelled) {
      toast.error(copy.cancelledToast);
      return;
    }
    if (!accepted) {
      toast.error(copy.acceptRulesToast);
      return;
    }
    if (!item.liveEventId) {
      toast.error(copy.missingInfoToast);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/live-events/${item.liveEventId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, liveEventId: item.liveEventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = extractErrorMessage(data);
        if (res.status === 402) {
          toast.error(formatErrorToast(copy.insufficientCreditsToast, reason));
        } else {
          toast.error(formatErrorToast(copy.completeFailedToast, reason));
        }
        return;
      }
      if (typeof data.balanceAfter === 'number') {
        dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success(copy.completedToast);
      setOpen(false);
      setAccepted(false);
      onRefresh?.();
    } catch (error) {
      toast.error(
        formatErrorToast(
          copy.completeFailedToast,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li>
      <div className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/20">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isCancelled ? copy.cancelledTitle : copy.pendingTitle}
          </p>
          <p className="text-xs text-muted-foreground">{item.topic}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Calendar className="h-3 w-3" />
              {dateFormatter.format(eventDate)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Clock className="h-3 w-3" />
              {timeFormatter.format(eventDate)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Clock className="h-3 w-3" />
              {t('recentActivities.sprint.durationLabel', { count: item.durationMinutes })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Coins className="h-3 w-3" />
              {t('recentActivities.sprint.creditsLabel', {
                count: Math.round(item.creditCost),
              })}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isCancelled
              ? copy.cancelledHint
              : copy.pendingHint}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Button
            size="sm"
            variant={isCancelled ? 'outline' : 'secondary'}
            onClick={() => setOpen(true)}
          >
            {isCancelled ? copy.viewDetails : copy.completeRegistration}
          </Button>
          <p suppressHydrationWarning className="mt-1 text-[10px] text-muted-foreground">
            {timeFormatter.format(createdTime)}
          </p>
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setAccepted(false);
            setRulesRead(false);
          } else {
            setRulesRead(false);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
          <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {isCancelled
              ? copy.cancelledToast
              : copy.confirmDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{copy.summaryTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('recentActivities.sprint.summaryLine', {
                      topic: item.topic,
                      date: dateFormatter.format(eventDate),
                      time: timeFormatter.format(eventDate),
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('recentActivities.sprint.creditsRequired', {
                      count: Math.round(item.creditCost),
                    })}
                  </p>
                </div>
              </div>
              {isCancelled ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {copy.cancelledSummary}
                </p>
              ) : (
                <>
                  <div
                    ref={rulesRef}
                    onScroll={handleRulesScroll}
                    className="mt-3 max-h-40 overflow-auto rounded-lg border border-border/60 bg-background/60 p-3"
                  >
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {copy.rulesText}
                    </p>
                  </div>
                  {!rulesRead ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {copy.scrollHint}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {isCancelled ? null : (
              <div
                className={cn(
                  'rounded-xl border p-4 transition',
                  accepted ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={setAccepted}
                    className="mt-1"
                    disabled={!rulesRead}
                  />
                  <div className="space-y-1 leading-none flex-1">
                    <p className="text-sm font-medium">
                      {copy.agreeTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {copy.agreeHint}
                    </p>
                    {!rulesRead ? (
                      <p className="text-[11px] text-muted-foreground">
                        {copy.agreeLocked}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {copy.required}
                  </span>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setOpen(false)}>
              {isCancelled ? copy.close : copy.notNow}
            </AlertDialogCancel>
            {isCancelled ? null : (
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={!rulesRead || !accepted || submitting}
              >
                {submitting ? copy.completing : copy.confirmAction}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

interface CombinedMessagesListProps {
  items: CombinedMessageItem[];
  onRefresh?: () => void;
}

export function CombinedMessagesList({ items, onRefresh }: CombinedMessagesListProps) {
  const { locale, messages, t } = useI18n();
  const { timeFormat } = useSettings();
  const copy = messages.recentActivities;
  const localeCode = getLocaleCode(locale);
  const hour12 =
    timeFormat === '12-hour' ? true : timeFormat === '24-hour' ? false : undefined;
  const dateLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [localeCode],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        hour: '2-digit',
        minute: '2-digit',
        ...(hour12 === undefined ? {} : { hour12 }),
      }),
    [localeCode, hour12],
  );
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const isEmpty = items.length === 0;

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });

    const groups: { dateKey: string; dateLabel: string; items: CombinedMessageItem[] }[] = [];
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; items: CombinedMessageItem[] }>();

    for (const item of sorted) {
      const d = new Date(item.createdAt);
      const dateKey = d.toLocaleDateString('en-CA');
      const dateLabel = dateLabelFormatter.format(d);

      let group = groupMap.get(dateKey);
      if (!group) {
        group = { dateKey, dateLabel, items: [] };
        groupMap.set(dateKey, group);
        groups.push(group);
      }
      group.items.push(item);
    }

    return groups;
  }, [items, sortOrder, dateLabelFormatter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor="recent-activities-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            {copy.sortLabel}
          </label>
          <Select
            id="recent-activities-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="w-[180px]"
            aria-label={copy.sortLabel}
          >
            <SelectItem value="newest">{copy.sortNewest}</SelectItem>
            <SelectItem value="oldest">{copy.sortOldest}</SelectItem>
          </Select>
        </div>
      </div>
      {isEmpty ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <MessageSquare className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">{copy.emptyTitle}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {copy.emptyDescription}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div>
              {grouped.map((group, index) => (
                <div
                  key={group.dateKey}
                  className={cn(index > 0 && 'border-t border-border/80')}
                >
                  <div
                    suppressHydrationWarning
                    className={cn(
                      'px-4 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/80 bg-muted/40',
                    )}
                  >
                    {group.dateLabel}
                  </div>
                  <ul className="divide-y divide-border">
                    {group.items.map((item) => {
                      if (item.type === 'moderation') {
                        const preview = String(item.body || '')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .slice(0, 220);
                        return (
                          <li key={`moderation-${item.id}`}>
                            <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                                <ShieldCheck className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {item.title || 'Moderator update'}
                                </p>
                                <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                                  {preview || copy.noContent}
                                </p>
                                {item.linkUrl ? (
                                  <div className="mt-1">
                                    <Link
                                      href={item.linkUrl}
                                      className="text-[11px] text-primary hover:underline underline-offset-2"
                                    >
                                      Contact support
                                    </Link>
                                  </div>
                                ) : null}
                              </div>
                              <div className="shrink-0 text-[11px] text-muted-foreground">
                                {timeFormatter.format(new Date(item.createdAt))}
                              </div>
                            </div>
                          </li>
                        );
                      }
                      if (item.type === 'reply') {
                        const contextLabel =
                          item.contextType === 'reply'
                            ? copy.replyContext.reply
                            : copy.replyContext.discussion;
                        const authorName = item.authorName || messages.materials.authorFallback;
                        return (
                          <li key={`reply-${item.id}`}>
                            <Link
                              href={`/discussions/${item.discussionId}/replies/${item.replyId}`}
                              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {authorName} {contextLabel}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {item.discussionTitle}
                                </p>
                                <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                                  {item.contentPreview || copy.noContent}
                                </p>
                              </div>
                              <div className="shrink-0 text-[11px] text-muted-foreground">
                                {timeFormatter.format(new Date(item.createdAt))}
                              </div>
                            </Link>
                          </li>
                        );
                      }
                      if (item.type === 'sprint') {
                        return (
                          <SprintEnrollmentRow
                            key={`sprint-${item.id}`}
                            item={item}
                            onRefresh={onRefresh}
                          />
                        );
                      }

                      const isGain = item.amount > 0;
                      const absAmount = Math.abs(item.amount);
                      const label = copy.transactions[item.label as keyof typeof copy.transactions] ?? item.label;
                      const creditMessage = isGain ? copy.credits.added : copy.credits.spent;
                      const creditTime = timeFormatter.format(new Date(item.createdAt));

                      return (
                        <li key={`credit-${item.id}`}>
                          <div className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/20">
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                                isGain
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-destructive/10 text-destructive',
                              )}
                            >
                              {isGain ? <CreditUp className="h-4 w-4" /> : <CreditDown className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{creditMessage}</p>
                              <p suppressHydrationWarning className="text-[11px] text-muted-foreground truncate">
                                {label} · {creditTime}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  isGain ? 'text-primary' : 'text-destructive',
                                )}
                              >
                                {isGain ? '+' : '−'}
                                {t('recentActivities.credits.creditsLabel', { count: Math.round(absAmount) })}
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                {t('recentActivities.credits.balance', {
                                  count: Math.round(item.balanceAfter),
                                })}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
