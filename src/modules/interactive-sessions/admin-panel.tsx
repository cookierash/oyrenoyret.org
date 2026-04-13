'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PiCalendar as Calendar, PiClock as Clock, PiCoins as Coins, PiMagnifyingGlass as Search } from 'react-icons/pi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectItem } from '@/components/ui/select';
import { DifficultyBars, MaterialDifficulty } from '@/src/modules/materials/difficulty-bars';
import { useI18n } from '@/src/i18n/i18n-provider';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { MAX_IMAGE_UPLOAD_BYTES } from '@/src/config/uploads';

interface LiveEvent {
  id: string;
  topic: string;
  date: string;
  durationMinutes: number;
  difficulty: MaterialDifficulty | null;
  creditCost: number;
  type: string;
}

interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
}

type EventSortKey = 'soonest' | 'latest' | 'topicAz' | 'topicZa';

type AnnouncementSortKey = 'newest' | 'oldest' | 'titleAz' | 'titleZa';

type EventDifficultyValue = MaterialDifficulty | '';

const EVENT_PAGE_SIZE = 10;
const ANNOUNCEMENT_PAGE_SIZE = 10;

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

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

interface LiveEventsAdminPanelProps {
  type: 'PROBLEM_SPRINT' | 'EVENT';
  labels: {
    formTitle: string;
    formDescription: string;
    formButton: string;
    addButton: string;
    listTitle: string;
    listDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    searchPlaceholder: string;
  };
  defaults?: {
    durationMinutes?: string;
    difficulty?: EventDifficultyValue;
    creditCost?: string;
  };
}

function LiveEventsAdminPanel({ type, labels, defaults }: LiveEventsAdminPanelProps) {
  const { t, messages } = useI18n();
  const difficultyCopy = messages.materials.difficulty;
  const adminCopy = messages.liveActivities.admin;
  const uiCopy = messages.liveActivities.admin.ui;
  const commonCopy = uiCopy.common;
  const initialForm = useMemo(
    () => ({
      topic: '',
      date: '',
      durationMinutes: defaults?.durationMinutes ?? '10',
      difficulty: defaults?.difficulty ?? 'BASIC',
      creditCost: defaults?.creditCost ?? '5',
      maxParticipants: '30',
      prompt: '',
    }),
    [defaults?.creditCost, defaults?.difficulty, defaults?.durationMinutes],
  );

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<EventSortKey>('soonest');
  const [page, setPage] = useState(1);
  const [eventForm, setEventForm] = useState(initialForm);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    topic: string;
    date: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<LiveEvent | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    first: '',
    second: '',
    third: '',
  });
  const [payingOut, setPayingOut] = useState(false);
  const minDateTime = toLocalInputValue(new Date());

  const loadData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('take', '200');
    params.set('type', type);
    params.set('includePast', '1');
    fetch(`/api/live-events?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!eventForm.topic.trim()) {
      toast.error(adminCopy.toasts.topicRequired);
      return;
    }
    if (!eventForm.date) {
      toast.error(adminCopy.toasts.dateRequired);
      return;
    }
    const parsedDate = new Date(eventForm.date);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error(adminCopy.toasts.invalidDate);
      return;
    }
    if (parsedDate.getTime() < Date.now()) {
      toast.error(adminCopy.toasts.futureDate);
      return;
    }
    const duration = Number(eventForm.durationMinutes);
    const creditCost = Number(eventForm.creditCost);
    const maxParticipants = eventForm.maxParticipants.trim()
      ? Number(eventForm.maxParticipants)
      : null;
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error(adminCopy.toasts.durationPositive);
      return;
    }
    if (!Number.isInteger(duration)) {
      toast.error(adminCopy.toasts.durationWhole);
      return;
    }
    if (!Number.isFinite(creditCost) || creditCost < 0 || !Number.isInteger(creditCost)) {
      toast.error(adminCopy.toasts.creditCostWhole);
      return;
    }
    if (maxParticipants !== null) {
      if (!Number.isFinite(maxParticipants) || !Number.isInteger(maxParticipants)) {
        toast.error(adminCopy.toasts.maxParticipantsWhole);
        return;
      }
      if (maxParticipants <= 0 || maxParticipants > 500) {
        toast.error(adminCopy.toasts.maxParticipantsRange);
        return;
      }
    }

    try {
      const res = await fetch('/api/live-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: eventForm.topic,
          date: parsedDate.toISOString(),
          durationMinutes: duration,
          difficulty: eventForm.difficulty,
          creditCost,
          type,
          maxParticipants,
          ...(type === 'PROBLEM_SPRINT' ? { prompt: eventForm.prompt } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(adminCopy.toasts.createEventFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(adminCopy.toasts.eventCreated);
      setEventForm(initialForm);
      setEventDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.createEventFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const sanitizedId = typeof eventId === 'string' ? eventId.trim() : '';
      if (!sanitizedId) {
        toast.error(adminCopy.toasts.missingEventId);
        return;
      }
      const res = await fetch(`/api/live-events/${encodeURIComponent(sanitizedId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sanitizedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(adminCopy.toasts.deleteEventFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(adminCopy.toasts.eventRemoved);
      loadData();
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.deleteEventFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    }
  };

  const requestDelete = (event: LiveEvent) => {
    const sanitizedId = typeof event.id === 'string' ? event.id.trim() : '';
    if (!sanitizedId) {
      toast.error(adminCopy.toasts.missingEventId);
      return;
    }
    setDeleteTarget({ id: sanitizedId, topic: event.topic, date: event.date });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      setDeleteDialogOpen(false);
      return;
    }
    setDeleting(true);
    await handleDeleteEvent(deleteTarget.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const requestPayout = (event: LiveEvent) => {
    if (event.type !== 'PROBLEM_SPRINT') return;
    const sanitizedId = typeof event.id === 'string' ? event.id.trim() : '';
    if (!sanitizedId) {
      toast.error(adminCopy.toasts.missingEventId);
      return;
    }
    setPayoutTarget(event);
    setPayoutForm({ first: '', second: '', third: '' });
    setPayoutDialogOpen(true);
  };

  const confirmPayout = async () => {
    if (!payoutTarget) {
      setPayoutDialogOpen(false);
      return;
    }
    const trimmed = {
      first: payoutForm.first.trim(),
      second: payoutForm.second.trim(),
      third: payoutForm.third.trim(),
    };
    const values = [trimmed.first, trimmed.second, trimmed.third].filter(Boolean);
    if (values.length === 0) {
      toast.error(adminCopy.toasts.payoutNeedWinner);
      return;
    }
    const normalized = values.map((value) => value.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      toast.error(adminCopy.toasts.payoutUniqueWinner);
      return;
    }
    setPayingOut(true);
    try {
      const res = await fetch(`/api/live-events/${payoutTarget.id}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(adminCopy.toasts.payoutFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(adminCopy.toasts.payoutCompleted);
      setPayoutDialogOpen(false);
      setPayoutTarget(null);
      setPayoutForm({ first: '', second: '', third: '' });
      loadData();
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.payoutFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setPayingOut(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = events;

    if (query) {
      list = events.filter((event) => event.topic.toLowerCase().includes(query));
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'soonest':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'latest':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'topicAz':
          return a.topic.localeCompare(b.topic);
        case 'topicZa':
          return b.topic.localeCompare(a.topic);
        default:
          return 0;
      }
    });
  }, [events, search, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, events.length]);

  const visibleEvents = useMemo(
    () => filteredAndSorted.slice(0, page * EVENT_PAGE_SIZE),
    [filteredAndSorted, page],
  );

  return (
    <div className="space-y-6">
      <AlertDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.formTitle}</AlertDialogTitle>
            <AlertDialogDescription>{labels.formDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <form className="mt-4 grid gap-4" onSubmit={handleCreateEvent}>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-topic`}>{commonCopy.topicLabel}</Label>
              <Input
                id={`${type}-topic`}
                value={eventForm.topic}
                onChange={(e) => setEventForm((prev) => ({ ...prev, topic: e.target.value }))}
                placeholder={commonCopy.topicPlaceholder}
              />
            </div>
            {type === 'PROBLEM_SPRINT' ? (
              <div className="grid gap-2">
                <Label htmlFor={`${type}-prompt`}>{commonCopy.problemStatementLabel}</Label>
                <textarea
                  id={`${type}-prompt`}
                  className="min-h-[120px] max-h-[420px] overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                  value={eventForm.prompt}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder={commonCopy.problemStatementPlaceholder}
                />
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${type}-date`}>{commonCopy.dateTimeLabel}</Label>
                <Input
                  id={`${type}-date`}
                  type="datetime-local"
                  value={eventForm.date}
                  min={minDateTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${type}-duration`}>{commonCopy.durationLabel}</Label>
                <Input
                  id={`${type}-duration`}
                  type="number"
                  min={5}
                  max={30}
                  step={1}
                  value={eventForm.durationMinutes}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${type}-difficulty`}>{commonCopy.difficultyLabel}</Label>
                <Select
                  id={`${type}-difficulty`}
                  value={eventForm.difficulty}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      difficulty: e.target.value as EventDifficultyValue,
                    }))
                  }
                >
                  <SelectItem value="BASIC">{difficultyCopy.BASIC}</SelectItem>
                  <SelectItem value="INTERMEDIATE">{difficultyCopy.INTERMEDIATE}</SelectItem>
                  <SelectItem value="ADVANCED">{difficultyCopy.ADVANCED}</SelectItem>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${type}-credit`}>{commonCopy.creditsToJoinLabel}</Label>
                <Input
                  id={`${type}-credit`}
                  type="number"
                  min={0}
                  step={1}
                  value={eventForm.creditCost}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, creditCost: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-maxParticipants`}>{commonCopy.maxParticipantsLabel}</Label>
              <Input
                id={`${type}-maxParticipants`}
                type="number"
                min={1}
                max={500}
                step={1}
                value={eventForm.maxParticipants}
                onChange={(e) =>
                  setEventForm((prev) => ({ ...prev, maxParticipants: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {commonCopy.maxParticipantsHint}
              </p>
            </div>

            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel type="button" onClick={() => setEventDialogOpen(false)}>
                {commonCopy.cancel}
              </AlertDialogCancel>
              <AlertDialogAction type="submit">{labels.formButton}</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleting(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{commonCopy.removeEventTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                t('liveActivities.admin.ui.common.removeEventDescription', {
                  topic: deleteTarget.topic,
                  date: formatDate(new Date(deleteTarget.date)),
                  time: formatTime(new Date(deleteTarget.date)),
                })
              ) : (
                commonCopy.removeEventFallback
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{commonCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? commonCopy.removing : commonCopy.removeEventConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={payoutDialogOpen}
        onOpenChange={(open) => {
          setPayoutDialogOpen(open);
          if (!open) {
            setPayoutTarget(null);
            setPayingOut(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{commonCopy.payoutDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {commonCopy.payoutDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-first`}>
                {commonCopy.firstPlaceLabel}
              </Label>
              <Input
                id={`${type}-payout-first`}
                value={payoutForm.first}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, first: e.target.value }))}
                placeholder={commonCopy.payoutPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-second`}>
                {commonCopy.secondPlaceLabel}
              </Label>
              <Input
                id={`${type}-payout-second`}
                value={payoutForm.second}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, second: e.target.value }))}
                placeholder={commonCopy.payoutPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-third`}>
                {commonCopy.thirdPlaceLabel}
              </Label>
              <Input
                id={`${type}-payout-third`}
                value={payoutForm.third}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, third: e.target.value }))}
                placeholder={commonCopy.payoutPlaceholder}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payingOut}>{commonCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayout} disabled={payingOut}>
              {payingOut ? commonCopy.payingOut : commonCopy.payWinners}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">{labels.listTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{labels.listDescription}</p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('liveActivities.admin.ui.common.totalLabel', { count: events.length })}
              </span>
            )}
            <Button size="sm" onClick={() => setEventDialogOpen(true)}>
              {labels.addButton}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1">
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-48" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder={labels.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label={labels.searchPlaceholder}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`${type}-sort`} className="text-sm text-muted-foreground whitespace-nowrap">
                {uiCopy.sortBy}
              </label>
              <Select
                id={`${type}-sort`}
                value={sort}
                onChange={(e) => setSort(e.target.value as EventSortKey)}
                className="w-[180px]"
                aria-label={commonCopy.sortAria}
              >
                <SelectItem value="soonest">{commonCopy.sortSoonest}</SelectItem>
                <SelectItem value="latest">{commonCopy.sortLatest}</SelectItem>
                <SelectItem value="topicAz">{commonCopy.sortTopicAz}</SelectItem>
                <SelectItem value="topicZa">{commonCopy.sortTopicZa}</SelectItem>
              </Select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card-frame bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`event-skeleton-${i}`} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-7 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
            <Calendar className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">{labels.emptyTitle}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{labels.emptyDescription}</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
            <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">{uiCopy.noMatches}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {commonCopy.noMatchesHint}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <table className="min-w-[980px] w-max table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    <th className="min-w-[320px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.topic}</th>
                    <th className="w-[140px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.date}</th>
                    <th className="w-[110px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.time}</th>
                    <th className="w-[110px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.duration}</th>
                    <th className="w-[150px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.difficulty}</th>
                    <th className="w-[120px] py-2 pr-4 font-medium">{commonCopy.tableHeaders.credits}</th>
                    <th className="w-[190px] py-2 pr-2 text-right font-medium">{commonCopy.tableHeaders.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((liveEvent) => {
                    const eventDate = new Date(liveEvent.date);
                    return (
                      <tr key={liveEvent.id} className="border-b border-border/60 text-sm text-foreground">
                        <td className="py-3 pr-4">
                          <div className="font-medium truncate">{liveEvent.topic}</div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(eventDate)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatTime(eventDate)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {liveEvent.durationMinutes} {commonCopy.minutesShort}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {liveEvent.difficulty ? (
                            <DifficultyBars difficulty={liveEvent.difficulty} />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {commonCopy.notAvailable}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5" />
                            {Math.round(liveEvent.creditCost)} {commonCopy.creditsWord}
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
                            {type === 'PROBLEM_SPRINT' ? (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/cms/sprint/${liveEvent.id}`}>{commonCopy.openCms}</Link>
                              </Button>
                            ) : null}
                            {type === 'PROBLEM_SPRINT' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => requestPayout(liveEvent)}
                              >
                                {commonCopy.payoutWinners}
                              </Button>
                            ) : null}
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => requestDelete(liveEvent)}
                            >
                              {commonCopy.delete}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {page * EVENT_PAGE_SIZE < filteredAndSorted.length ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                >
                  {uiCopy.loadMore}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export function ProblemSprintsAdminPanel() {
  const { messages } = useI18n();
  return (
    <LiveEventsAdminPanel
      type="PROBLEM_SPRINT"
      defaults={{ durationMinutes: '10', difficulty: 'BASIC', creditCost: '3' }}
      labels={messages.liveActivities.admin.ui.problemSprints}
    />
  );
}

export function EventsAdminPanel() {
  const { messages } = useI18n();
  return (
    <LiveEventsAdminPanel
      type="EVENT"
      labels={messages.liveActivities.admin.ui.events}
    />
  );
}

export function AnnouncementsAdminPanel() {
  const { t, messages } = useI18n();
  const adminCopy = messages.liveActivities.admin;
  const uiCopy = messages.liveActivities.admin.ui;
  const announcementCopy = uiCopy.announcements;
  const commonCopy = uiCopy.common;
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<AnnouncementSortKey>('newest');
  const [page, setPage] = useState(1);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
    imageUrl: '',
  });
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const maxBannerMb = Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024);

  const loadData = () => {
    setLoading(true);
    fetch('/api/live-announcements?take=200', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      toast.error(adminCopy.toasts.announcementFieldsRequired);
      return;
    }
    try {
      const res = await fetch('/api/live-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementForm.title,
          body: announcementForm.body,
          imageUrl: announcementForm.imageUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(adminCopy.toasts.announcementCreateFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(adminCopy.toasts.announcementPublished);
      setAnnouncementForm({ title: '', body: '', imageUrl: '' });
      setAnnouncementDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.announcementCreateFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    }
  };

  const uploadBanner = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      toast.error(adminCopy.toasts.announcementBannerUnsupported ?? 'Unsupported image type.');
      return;
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      toast.error(adminCopy.toasts.announcementBannerUploadFailed ?? 'Upload failed.');
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error(
        (adminCopy.toasts.announcementBannerTooLarge ?? 'Image is too large.').replace('{{count}}', String(maxBannerMb)),
      );
      return;
    }

    setBannerUploading(true);
    try {
      const signRes = await fetch('/api/uploads/announcements/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: file.size, type: file.type }),
      });
      const signData = await signRes.json().catch(() => ({}));

      if (
        signRes.ok &&
        signData?.provider === 'r2' &&
        String(signData?.method ?? '').toUpperCase() === 'PUT' &&
        typeof signData?.uploadUrl === 'string' &&
        (typeof signData?.publicUrl === 'string' || typeof signData?.proxyUrl === 'string')
      ) {
        const signedHeaders: Record<string, string> = {};
        if (signData?.headers && typeof signData.headers === 'object') {
          for (const [k, v] of Object.entries(signData.headers as Record<string, unknown>)) {
            if (typeof v === 'string' && v) signedHeaders[k] = v;
          }
        }
        const uploadRes = await fetch(signData.uploadUrl as string, {
          method: 'PUT',
          headers: {
            ...signedHeaders,
            'Content-Type': String(signedHeaders['Content-Type'] ?? file.type),
          },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }
        const nextUrl =
          typeof signData?.proxyUrl === 'string' && signData.proxyUrl
            ? String(signData.proxyUrl)
            : String(signData.publicUrl);
        setAnnouncementForm((prev) => ({ ...prev, imageUrl: nextUrl }));
        return;
      }

      const message = typeof signData?.error === 'string' ? signData.error : null;
      throw new Error(message || 'Upload failed');
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.announcementBannerUploadFailed ?? 'Failed to upload banner.',
          error instanceof Error ? error.message : null,
        ),
      );
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      const res = await fetch(`/api/live-announcements/${announcementId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          formatErrorToast(adminCopy.toasts.announcementDeleteFailed, extractErrorMessage(data)),
        );
        return;
      }
      toast.success(adminCopy.toasts.announcementRemoved);
      loadData();
    } catch (error) {
      toast.error(
        formatErrorToast(
          adminCopy.toasts.announcementDeleteFailed,
          error instanceof Error ? error.message : null,
        ),
      );
    }
  };

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = announcements;

    if (query) {
      list = announcements.filter((announcement) => {
        const title = announcement.title.toLowerCase();
        const body = announcement.body.toLowerCase();
        return title.includes(query) || body.includes(query);
      });
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'titleAz':
          return a.title.localeCompare(b.title);
        case 'titleZa':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
  }, [announcements, search, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, announcements.length]);

  const visibleAnnouncements = useMemo(
    () => filteredAndSorted.slice(0, page * ANNOUNCEMENT_PAGE_SIZE),
    [filteredAndSorted, page],
  );

  return (
    <div className="space-y-6">
      <AlertDialog
        open={announcementDialogOpen}
        onOpenChange={(next) => {
          setAnnouncementDialogOpen(next);
          if (!next) {
            setAnnouncementForm({ title: '', body: '', imageUrl: '' });
            setBannerUploading(false);
            if (bannerInputRef.current) bannerInputRef.current.value = '';
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{announcementCopy.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{announcementCopy.dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadBanner(file);
            }}
          />
          <form className="mt-4 grid gap-4" onSubmit={handleCreateAnnouncement}>
            <div className="grid gap-2">
              <Label htmlFor="announcement-title">{announcementCopy.titleLabel}</Label>
              <Input
                id="announcement-title"
                value={announcementForm.title}
                onChange={(e) =>
                  setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder={announcementCopy.titlePlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label>{announcementCopy.bannerLabel}</Label>
              <div className="flex flex-col gap-3">
                {announcementForm.imageUrl ? (
                  <div className="relative overflow-hidden rounded-md border border-border bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={announcementForm.imageUrl}
                      alt=""
                      className="h-40 w-full object-cover"
                      decoding="async"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={bannerUploading}
                  >
                    {bannerUploading ? announcementCopy.bannerUploading : announcementCopy.bannerUpload}
                  </Button>
                  {announcementForm.imageUrl ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setAnnouncementForm((prev) => ({ ...prev, imageUrl: '' }))}
                      disabled={bannerUploading}
                    >
                      {announcementCopy.bannerRemove}
                    </Button>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {announcementCopy.bannerHint.replace('{{count}}', String(maxBannerMb))}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="announcement-body">{announcementCopy.bodyLabel}</Label>
              <textarea
                id="announcement-body"
                className="min-h-[90px] max-h-[420px] overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={announcementForm.body}
                onChange={(e) =>
                  setAnnouncementForm((prev) => ({ ...prev, body: e.target.value }))
                }
                placeholder={announcementCopy.bodyPlaceholder}
              />
            </div>
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel
                type="button"
                onClick={() => setAnnouncementDialogOpen(false)}
              >
                {announcementCopy.cancel}
              </AlertDialogCancel>
              <AlertDialogAction type="submit">{announcementCopy.publish}</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">{announcementCopy.sectionTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{announcementCopy.sectionDescription}</p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('liveActivities.admin.ui.common.totalLabel', { count: announcements.length })}
              </span>
            )}
            <Button size="sm" onClick={() => setAnnouncementDialogOpen(true)}>
              {announcementCopy.addButton}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1">
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-48" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder={announcementCopy.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label={announcementCopy.searchLabel}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="announcements-sort" className="text-sm text-muted-foreground whitespace-nowrap">
                {uiCopy.sortBy}
              </label>
              <Select
                id="announcements-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as AnnouncementSortKey)}
                className="w-[180px]"
                aria-label={announcementCopy.sortAria}
              >
                <SelectItem value="newest">{announcementCopy.sortNewest}</SelectItem>
                <SelectItem value="oldest">{announcementCopy.sortOldest}</SelectItem>
                <SelectItem value="titleAz">{announcementCopy.sortTitleAz}</SelectItem>
                <SelectItem value="titleZa">{announcementCopy.sortTitleZa}</SelectItem>
              </Select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card-frame bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`announcement-skeleton-${i}`} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-60" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="ml-auto h-7 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
            <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">{announcementCopy.noAnnouncements}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {announcementCopy.emptyHint}
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
            <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">{uiCopy.noMatches}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {commonCopy.noMatchesHint}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <table className="min-w-[920px] w-max table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    <th className="min-w-[260px] py-2 pr-4 font-medium">{announcementCopy.tableHeaders.title}</th>
                    <th className="py-2 pr-4 font-medium">{announcementCopy.tableHeaders.body}</th>
                    <th className="w-[140px] py-2 pr-4 font-medium">{announcementCopy.tableHeaders.created}</th>
                    <th className="w-[140px] py-2 pr-2 text-right font-medium">{announcementCopy.tableHeaders.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAnnouncements.map((announcement) => (
                    <tr key={announcement.id} className="border-b border-border/60 text-sm text-foreground">
                      <td className="py-3 pr-4">
                        <div className="font-medium truncate">{announcement.title}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="max-h-24 overflow-y-auto pr-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {announcement.body}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(new Date(announcement.createdAt))}
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                          >
                            {commonCopy.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page * ANNOUNCEMENT_PAGE_SIZE < filteredAndSorted.length ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                >
                  {uiCopy.loadMore}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
