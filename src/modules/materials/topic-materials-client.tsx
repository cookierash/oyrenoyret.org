'use client';

import { useEffect, useState } from 'react';
import { TopicMaterialsSection, type TopicMaterialWithCost } from './topic-materials-section';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/src/i18n/i18n-provider';

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
  const { messages } = useI18n();
  const [materials, setMaterials] = useState<TopicMaterialWithCost[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number; message: string; code?: string } | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/materials?subjectId=${encodeURIComponent(subjectId)}&topicId=${encodeURIComponent(topicId)}&includeAccess=1`,
          { cache: 'no-store' },
        );
        const data = (await res.json().catch(() => ({}))) as TopicMaterialsResponse & {
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          const msg = data?.error || messages.materials.topicList.loadFailed;
          throw Object.assign(new Error(msg), { status: res.status, code: data?.code });
        }
        if (!active) return;
        const parsed = (data.materials ?? []).map((m) => ({
          ...m,
          publishedAt: m.publishedAt ? new Date(m.publishedAt) : null,
        }));
        setMaterials(parsed);
        setUnlockedIds(data.unlockedIds ?? []);
        setBalance(typeof data.balance === 'number' ? data.balance : 0);
        setUserId(data.userId ?? null);
      } catch (err) {
        if (!active) return;
        const e = err as Error & { status?: number; code?: string };
        setLoadError({ status: e.status, message: e.message || messages.materials.topicList.loadFailed, code: e.code });
        toast.error(e.message || messages.materials.topicList.loadFailed);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [subjectId, topicId, messages.materials.topicList.loadFailed, retryKey]);

  if (loadError && !loading) {
    return (
      <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{loadError.message}</p>
        {loadError.code === 'DB_MIGRATION_REQUIRED' ? (
          <p className="text-xs text-muted-foreground/70">
            {`(${loadError.code}) Run database migrations on production.`}
          </p>
        ) : loadError.status ? (
          <p className="text-xs text-muted-foreground/70">{`HTTP ${loadError.status}`}</p>
        ) : null}
        <Button
          size="sm"
          variant="secondary-primary"
          onClick={() => {
            setRetryKey((k) => k + 1);
          }}
        >
          {messages.materials.topicList.retry}
        </Button>
      </div>
    );
  }

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
