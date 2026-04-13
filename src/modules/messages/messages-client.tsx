'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { CombinedMessagesList } from './combined-messages-list';
import { MessagesSkeleton } from './messages-skeleton';
import { dispatchNotificationsUnreadUpdated } from '@/src/lib/notifications-events';

type CombinedItems = ComponentProps<typeof CombinedMessagesList>['items'];

interface MessagesClientProps {
  refreshKey?: number;
}

export function MessagesClient({ refreshKey = 0 }: MessagesClientProps) {
  const [items, setItems] = useState<CombinedItems>([]);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  // Visiting Notifications should mark them as read (for unread badge).
  useEffect(() => {
    let active = true;
    fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => (res.ok ? res.json().catch(() => ({})) : Promise.reject(res)))
      .then(() => {
        if (!active) return;
        dispatchNotificationsUnreadUpdated(0);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!active) return;
        setItems((data?.items as CombinedItems) ?? []);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey, localRefresh]);

  if (loading) {
    return <MessagesSkeleton />;
}

  return (
    <CombinedMessagesList
      items={items}
      onRefresh={() => setLocalRefresh((value) => value + 1)}
    />
  );
}
