'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/src/i18n/i18n-provider';
import {
  AnnouncementsAdminPanel,
  EventsAdminPanel,
  ProblemSprintsAdminPanel,
} from '@/src/modules/interactive-sessions/admin-panel';

type TabKey = 'sprints' | 'announcements' | 'events';

function normalizeTab(value: string | null): TabKey {
  if (value === 'announcements' || value === 'events' || value === 'sprints') return value;
  return 'sprints';
}

export function InteractiveSessionsAdminHub() {
  const { messages } = useI18n();
  const uiCopy = messages.liveActivities.admin.ui;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => normalizeTab(searchParams.get('tab')), [searchParams]);
  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    const next = normalizeTab(searchParams.get('tab'));
    setTab(next);
  }, [searchParams]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = normalizeTab(value);
        setTab(next);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', next);
        router.replace(`/admin/interactive-sessions?${params.toString()}`);
      }}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="sprints">{uiCopy.tabs.sprints}</TabsTrigger>
        <TabsTrigger value="announcements">{uiCopy.tabs.announcements}</TabsTrigger>
        <TabsTrigger value="events">{uiCopy.tabs.events}</TabsTrigger>
      </TabsList>

      <TabsContent value="sprints">
        <ProblemSprintsAdminPanel />
      </TabsContent>
      <TabsContent value="announcements">
        <AnnouncementsAdminPanel />
      </TabsContent>
      <TabsContent value="events">
        <EventsAdminPanel />
      </TabsContent>
    </Tabs>
  );
}
