'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { Select, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

type MessageTransaction = {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  createdAt: string;
};

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

type SortOrder = 'newest' | 'oldest';

interface MessagesListProps {
  transactions: MessageTransaction[];
}

export function MessagesList({ transactions }: MessagesListProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const grouped = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });

    const groups: { dateKey: string; dateLabel: string; items: MessageTransaction[] }[] = [];

    for (const tx of sorted) {
      const d = new Date(tx.createdAt);
      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const dateLabel = d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let group = groups.find((g) => g.dateKey === dateKey);
      if (!group) {
        group = { dateKey, dateLabel, items: [] };
        groups.push(group);
      }
      group.items.push(tx);
    }

    return groups;
  }, [transactions, sortOrder]);

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <label
            htmlFor="messages-sort"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            Sort
          </label>
          <Select
            id="messages-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="w-[160px] text-xs"
            aria-label="Sort messages"
          >
            <SelectItem value="newest">Newest to oldest</SelectItem>
            <SelectItem value="oldest">Oldest to newest</SelectItem>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div>
            {grouped.map((group) => (
              <div key={group.dateKey}>
                <div
                  suppressHydrationWarning
                  className={cn(
                    'px-4 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/80 bg-muted/40'
                  )}
                >
                  {group.dateLabel}
                </div>
                <ul className="divide-y divide-border">
                  {group.items.map((tx) => {
                    const isGain = tx.amount > 0;
                    const absAmount = Math.abs(tx.amount);
                    const label = TRANSACTION_LABELS[tx.type] ?? tx.type;

                    return (
                      <li
                        key={tx.id}
                        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/20"
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            isGain
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {isGain ? '+' : '−'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{label}</p>
                          <p suppressHydrationWarning className="text-[11px] text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isGain ? 'text-primary' : 'text-destructive'
                            )}
                          >
                            {isGain ? '+' : '−'}
                            {absAmount.toFixed(2)} credits
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            Balance: {tx.balanceAfter.toFixed(2)}
                          </p>
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
    </div>
  );
}

