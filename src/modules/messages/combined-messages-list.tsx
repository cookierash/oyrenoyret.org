'use client';

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, Calendar, Clock, Coins, MessageSquare, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectItem } from '@/components/ui/select';
import { dispatchCreditsUpdated } from '@/src/lib/credits-events';
import { cn } from '@/src/lib/utils';

type ReplyNotificationItem = {
  type: 'reply';
  id: string;
  discussionId: string;
  replyId: string;
  createdAt: string;
  authorName: string;
  discussionTitle: string;
  contextLabel: string;
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

type CombinedMessageItem = ReplyNotificationItem | CreditActivityItem | SprintEnrollmentItem;

const TRANSACTION_LABELS: Record<string, string> = {
  REGISTRATION: 'Registration bonus',
  MATERIAL_PUBLISH: 'Material published',
  MATERIAL_PASSIVE: 'Earned from material unlock',
  MATERIAL_UNLOCK: 'Unlocked material',
  DISCUSSION_CREATE: 'Created discussion',
  DISCUSSION_HELP: 'Helpful reply reward',
  GROUP_SESSION_PARTICIPATE: 'Group session participation',
  GROUP_SESSION_FACILITATE: 'Group session facilitation',
  SPRINT_ENTRY: 'Sprint entry',
  SPRINT_PAYOUT: 'Sprint payout',
  SPECIAL_EVENT: 'Special event',
};

const SPRINT_RULES_TEXT = `
Please review the sprint procedures and policies before confirming:

1. Your spot is reserved only after confirmation.
2. Credits are deducted immediately after confirmation.
3. Credits are non-refundable once the sprint is confirmed.
4. Join on time; missed sessions are not refunded.
5. Keep communication respectful and focused.
6. You are responsible for stable internet and a working device.
`;

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SprintEnrollmentRow({
  item,
  onRefresh,
}: {
  item: SprintEnrollmentItem;
  onRefresh?: () => void;
}) {
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
      toast.error('This registration was cancelled. Please register again from Live Activities.');
      return;
    }
    if (!accepted) {
      toast.error('Please accept the sprint rules to continue.');
      return;
    }
    if (!item.liveEventId) {
      toast.error('Missing sprint information. Please refresh the page.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/live-events/${item.liveEventId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, liveEventId: item.liveEventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('Insufficient credits to complete registration.');
        } else {
          toast.error(data.error ?? 'Failed to complete registration.');
        }
        return;
      }
      if (typeof data.balanceAfter === 'number') {
        dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success('Registration completed. See you at the sprint!');
      setOpen(false);
      setAccepted(false);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete registration.');
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
            {isCancelled ? 'Registration cancelled' : 'Complete your sprint registration'}
          </p>
          <p className="text-xs text-muted-foreground">{item.topic}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(eventDate)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(eventDate)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Clock className="h-3 w-3" />
              {item.durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
              <Coins className="h-3 w-3" />
              {Math.round(item.creditCost)} credits
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isCancelled
              ? 'This registration was cancelled. Return to Live Activities to register again.'
              : 'A confirmation is required before credits are deducted.'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Button
            size="sm"
            variant={isCancelled ? 'outline' : 'secondary'}
            onClick={() => setOpen(true)}
          >
            {isCancelled ? 'View details' : 'Complete registration'}
          </Button>
          <p suppressHydrationWarning className="mt-1 text-[10px] text-muted-foreground">
            {formatTime(createdTime)}
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
          <AlertDialogTitle>Confirm sprint registration</AlertDialogTitle>
          <AlertDialogDescription>
            {isCancelled
              ? 'This registration was cancelled. Please register again from Live Activities.'
              : 'Review the rules and policies before completing your registration.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Sprint summary</p>
                  <p className="text-xs text-muted-foreground">
                    {item.topic} on {formatDate(eventDate)} at {formatTime(eventDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Credits required: {Math.round(item.creditCost)} (no refunds)
                  </p>
                </div>
              </div>
              {isCancelled ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  This request was cancelled and cannot be confirmed. Visit Live Activities to
                  register again.
                </p>
              ) : (
                <>
                  <div
                    ref={rulesRef}
                    onScroll={handleRulesScroll}
                    className="mt-3 max-h-40 overflow-auto rounded-lg border border-border/60 bg-background/60 p-3"
                  >
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {SPRINT_RULES_TEXT}
                    </p>
                  </div>
                  {!rulesRead ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Scroll to the end to enable confirmation.
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
                      I have read and agree to the sprint rules and policies
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Credits will be deducted immediately and are non-refundable.
                    </p>
                    {!rulesRead ? (
                      <p className="text-[11px] text-muted-foreground">
                        Read all rules to unlock the confirmation checkbox.
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Required
                  </span>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setOpen(false)}>
              {isCancelled ? 'Close' : 'Not now'}
            </AlertDialogCancel>
            {isCancelled ? null : (
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={!rulesRead || !accepted || submitting}
              >
                {submitting ? 'Completing...' : 'Complete registration'}
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
      const dateLabel = d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let group = groupMap.get(dateKey);
      if (!group) {
        group = { dateKey, dateLabel, items: [] };
        groupMap.set(dateKey, group);
        groups.push(group);
      }
      group.items.push(item);
    }

    return groups;
  }, [items, sortOrder]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor="messages-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            Sort by
          </label>
          <Select
            id="messages-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="w-[180px]"
            aria-label="Sort messages"
          >
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </Select>
        </div>
      </div>
      {isEmpty ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
          <MessageSquare className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No messages yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Notifications and credit activity will appear here.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div>
              {grouped.map((group) => (
                <div key={group.dateKey}>
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
                      if (item.type === 'reply') {
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
                                  {item.authorName} {item.contextLabel}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {item.discussionTitle}
                                </p>
                                <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                                  {item.contentPreview}
                                </p>
                              </div>
                              <div className="shrink-0 text-[11px] text-muted-foreground">
                                {new Date(item.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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
                      const label = TRANSACTION_LABELS[item.label] ?? item.label;

                      return (
                        <li key={`credit-${item.id}`}>
                          <div className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/20">
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                isGain
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-destructive/10 text-destructive',
                              )}
                            >
                              {isGain ? '+' : '−'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{label}</p>
                              <p suppressHydrationWarning className="text-[11px] text-muted-foreground">
                                {new Date(item.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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
                                {Math.round(absAmount)} credits
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Balance: {Math.round(item.balanceAfter)}
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
