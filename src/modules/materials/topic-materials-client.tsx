'use client';

import { useEffect, useState } from 'react';
import { TopicMaterialsSection, type TopicMaterialWithCost } from './topic-materials-section';

type ApiMaterial = Omit<TopicMaterialWithCost, 'publishedAt'> & {
  publishedAt: string | null;
};

type TopicMaterialsResponse = {
  materials?: ApiMaterial[];
  unlockedIds?: string[];
  balance?: number;
  userId?: string | null;
};

interface TopicMaterialsClientProps {
  subjectId: string;
  topicId: string;
}

export function TopicMaterialsClient({ subjectId, topicId }: TopicMaterialsClientProps) {
  const [materials, setMaterials] = useState<TopicMaterialWithCost[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/materials?subjectId=${subjectId}&topicId=${topicId}&includeAccess=1`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: TopicMaterialsResponse) => {
        if (!active) return;
        const parsed = (data.materials ?? []).map((m) => ({
          ...m,
          publishedAt: m.publishedAt ? new Date(m.publishedAt) : null,
        }));
        setMaterials(parsed);
        setUnlockedIds(data.unlockedIds ?? []);
        setBalance(typeof data.balance === 'number' ? data.balance : 0);
        setUserId(data.userId ?? null);
      })
      .catch(() => {
        if (!active) return;
        setMaterials([]);
        setUnlockedIds([]);
        setBalance(0);
        setUserId(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [subjectId, topicId]);

  return (
    <TopicMaterialsSection
      materials={materials}
      subjectId={subjectId}
      topicId={topicId}
      userId={userId}
      unlockedIds={unlockedIds}
      balance={balance}
      loading={loading}
    />
  );
}
