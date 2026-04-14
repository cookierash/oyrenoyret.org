'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiChatCircle as MessageSquare, PiCoins as Coins, PiCalendar as Calendar, PiUsersThree as Users } from 'react-icons/pi';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/src/i18n/i18n-provider';
import type { NotificationPreferences } from '@/src/lib/settings-preferences';

interface NotificationsControlsProps {
  notifications: NotificationPreferences;
}

export function NotificationsControls({ notifications }: NotificationsControlsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [notifyReplies, setNotifyReplies] = useState(notifications.replies);
  const [notifyCredits, setNotifyCredits] = useState(notifications.credits);
  const [notifySprints, setNotifySprints] = useState(notifications.sprints);
  const [notifyGuidedGroupSessions, setNotifyGuidedGroupSessions] = useState(notifications.guidedGroupSessions);

  useEffect(() => setNotifyReplies(notifications.replies), [notifications.replies]);
  useEffect(() => setNotifyCredits(notifications.credits), [notifications.credits]);
  useEffect(() => setNotifySprints(notifications.sprints), [notifications.sprints]);
  useEffect(() => setNotifyGuidedGroupSessions(notifications.guidedGroupSessions), [notifications.guidedGroupSessions]);

  const updatePreferences = async (
    payload: Partial<{
      notifyReplies: boolean;
      notifyCredits: boolean;
      notifySprints: boolean;
      notifyGuidedGroupSessions: boolean;
    }>,
  ) => {
    return fetch('/api/settings/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  };

  const handleToggle = (
    key: 'notifyReplies' | 'notifyCredits' | 'notifySprints' | 'notifyGuidedGroupSessions',
    value: boolean,
  ) => {
    const previousValue =
      key === 'notifyReplies'
        ? notifyReplies
        : key === 'notifyCredits'
          ? notifyCredits
          : key === 'notifySprints'
            ? notifySprints
            : notifyGuidedGroupSessions;

    if (key === 'notifyReplies') setNotifyReplies(value);
    if (key === 'notifyCredits') setNotifyCredits(value);
    if (key === 'notifySprints') setNotifySprints(value);
    if (key === 'notifyGuidedGroupSessions') setNotifyGuidedGroupSessions(value);

    startTransition(async () => {
      try {
        const res = await updatePreferences({ [key]: value });
        if (!res.ok) throw new Error('Request failed');
        router.refresh();
      } catch {
        if (key === 'notifyReplies') setNotifyReplies(previousValue);
        if (key === 'notifyCredits') setNotifyCredits(previousValue);
        if (key === 'notifySprints') setNotifySprints(previousValue);
        if (key === 'notifyGuidedGroupSessions') setNotifyGuidedGroupSessions(previousValue);
        toast.error(t('settings.notifications.saveFailed'));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="card-frame bg-card/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.notifications.repliesTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.notifications.repliesDescription')}
              </p>
            </div>
          </div>

          <Switch
            checked={notifyReplies}
            onCheckedChange={(checked) => handleToggle('notifyReplies', checked)}
            disabled={pending}
            aria-label={t('settings.notifications.repliesTitle')}
          />
        </div>
      </div>

      <div className="card-frame bg-card/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Coins className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.notifications.creditsTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.notifications.creditsDescription')}
              </p>
            </div>
          </div>

          <Switch
            checked={notifyCredits}
            onCheckedChange={(checked) => handleToggle('notifyCredits', checked)}
            disabled={pending}
            aria-label={t('settings.notifications.creditsTitle')}
          />
        </div>
      </div>

      <div className="card-frame bg-card/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.notifications.sprintsTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.notifications.sprintsDescription')}
              </p>
            </div>
          </div>

          <Switch
            checked={notifySprints}
            onCheckedChange={(checked) => handleToggle('notifySprints', checked)}
            disabled={pending}
            aria-label={t('settings.notifications.sprintsTitle')}
          />
        </div>
      </div>

      <div className="card-frame bg-card/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.notifications.guidedGroupSessionsTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.notifications.guidedGroupSessionsDescription')}
              </p>
            </div>
          </div>

          <Switch
            checked={notifyGuidedGroupSessions}
            onCheckedChange={(checked) => handleToggle('notifyGuidedGroupSessions', checked)}
            disabled={pending}
            aria-label={t('settings.notifications.guidedGroupSessionsTitle')}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('settings.notifications.scopeHint')}
      </p>
    </div>
  );
}
