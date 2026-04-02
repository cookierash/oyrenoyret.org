'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { CombinedMessagesList } from './combined-messages-list';
import { MessagesSkeleton } from './messages-skeleton';

type CombinedItems = ComponentProps<typeof CombinedMessagesList>['items'];

interface MessagesClientProps {
  refreshKey?: number;
}

export function MessagesClient({ refreshKey = 0 }: MessagesClientProps) {
  const [items, setItems] = useState<CombinedItems>([]);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/messages', { cache: 'no-store' })
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
