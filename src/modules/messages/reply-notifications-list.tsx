'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PiChatCircle as MessageSquare } from 'react-icons/pi';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/src/lib/utils';

export type ReplyNotification = {
  id: string;
  discussionId: string;
  replyId: string;
  createdAt: string;
  authorName: string;
  discussionTitle: string;
  contextLabel: string;
  contentPreview: string;
};

interface ReplyNotificationsListProps {
  notifications: ReplyNotification[];
}

export function ReplyNotificationsList({ notifications }: ReplyNotificationsListProps) {
  const grouped = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    const groups: { dateKey: string; dateLabel: string; items: ReplyNotification[] }[] = [];
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; items: ReplyNotification[] }>();

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
  }, [notifications]);

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground text-sm">No reply notifications yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When someone replies to your discussion or reply, it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
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
                {group.items.map((item) => (
                  <li key={item.id}>
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
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
