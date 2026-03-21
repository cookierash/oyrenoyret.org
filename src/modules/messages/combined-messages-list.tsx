'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectItem } from '@/components/ui/select';
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

type CombinedMessageItem = ReplyNotificationItem | CreditActivityItem;

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

interface CombinedMessagesListProps {
  items: CombinedMessageItem[];
}

export function CombinedMessagesList({ items }: CombinedMessagesListProps) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor="messages-sort" className="text-xs text-muted-foreground whitespace-nowrap">
            Sort
          </label>
          <Select
            id="messages-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="w-[160px] text-xs"
            aria-label="Sort messages"
          >
            <SelectItem value="newest">Newest to oldest</SelectItem>
            <SelectItem value="oldest">Oldest to newest</SelectItem>
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
                                {absAmount.toFixed(2)} credits
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Balance: {item.balanceAfter.toFixed(2)}
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
