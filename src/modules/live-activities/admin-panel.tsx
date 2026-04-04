'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const initialForm = useMemo(
    () => ({
      topic: '',
      date: '',
      durationMinutes: defaults?.durationMinutes ?? '10',
      difficulty: defaults?.difficulty ?? 'BASIC',
      creditCost: defaults?.creditCost ?? '5',
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
      toast.error('Topic is required.');
      return;
    }
    if (!eventForm.date) {
      toast.error('Date and time are required.');
      return;
    }
    const parsedDate = new Date(eventForm.date);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error('Please enter a valid date.');
      return;
    }
    if (parsedDate.getTime() < Date.now()) {
      toast.error('Please choose a date and time in the future.');
      return;
    }
    const duration = Number(eventForm.durationMinutes);
    const creditCost = Number(eventForm.creditCost);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error('Duration must be a positive number.');
      return;
    }
    if (!Number.isInteger(duration)) {
      toast.error('Duration must be a whole number of minutes.');
      return;
    }
    if (!Number.isFinite(creditCost) || creditCost < 0 || !Number.isInteger(creditCost)) {
      toast.error('Credit cost must be a whole number 0 or greater.');
      return;
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create event.');
        return;
      }
      toast.success('Event created.');
      setEventForm(initialForm);
      setEventDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create event.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const sanitizedId = typeof eventId === 'string' ? eventId.trim() : '';
      if (!sanitizedId) {
        toast.error('Missing event id. Please refresh and try again.');
        return;
      }
      const res = await fetch(`/api/live-events/${encodeURIComponent(sanitizedId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sanitizedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete event.');
        return;
      }
      toast.success('Event removed.');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete event.');
    }
  };

  const requestDelete = (event: LiveEvent) => {
    const sanitizedId = typeof event.id === 'string' ? event.id.trim() : '';
    if (!sanitizedId) {
      toast.error('Missing event id. Please refresh and try again.');
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
      toast.error('Missing event id. Please refresh and try again.');
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
      toast.error('Please enter at least one winner.');
      return;
    }
    const normalized = values.map((value) => value.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      toast.error('Each rank must have a unique winner.');
      return;
    }
    setPayingOut(true);
    try {
      const res = await fetch(`/api/live-events/${payoutTarget.id}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to pay out winners.');
        return;
      }
      toast.success('Payouts completed.');
      setPayoutDialogOpen(false);
      setPayoutTarget(null);
      setPayoutForm({ first: '', second: '', third: '' });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pay out winners.');
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
              <Label htmlFor={`${type}-topic`}>Topic</Label>
              <Input
                id={`${type}-topic`}
                value={eventForm.topic}
                onChange={(e) => setEventForm((prev) => ({ ...prev, topic: e.target.value }))}
                placeholder="Scientific topic or challenge"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${type}-date`}>Date & time</Label>
                <Input
                  id={`${type}-date`}
                  type="datetime-local"
                  value={eventForm.date}
                  min={minDateTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${type}-duration`}>Session duration (minutes)</Label>
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
                <Label htmlFor={`${type}-difficulty`}>Difficulty</Label>
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
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${type}-credit`}>Credits to join</Label>
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

            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel type="button" onClick={() => setEventDialogOpen(false)}>
                Cancel
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
            <AlertDialogTitle>Remove event?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will remove <strong>{deleteTarget.topic}</strong> on{' '}
                  {formatDate(new Date(deleteTarget.date))} at{' '}
                  {formatTime(new Date(deleteTarget.date))} from the live activities list.
                  This action cannot be undone.
                </>
              ) : (
                'This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove event'}
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
            <AlertDialogTitle>Payout sprint winners</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the winners by email, user ID, or public ID. Leave a rank blank if there is no winner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-first`}>
                1st place (cost + 3)
              </Label>
              <Input
                id={`${type}-payout-first`}
                value={payoutForm.first}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, first: e.target.value }))}
                placeholder="Email or user id"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-second`}>
                2nd place (cost + 2)
              </Label>
              <Input
                id={`${type}-payout-second`}
                value={payoutForm.second}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, second: e.target.value }))}
                placeholder="Email or user id"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${type}-payout-third`}>
                3rd place (cost + 1)
              </Label>
              <Input
                id={`${type}-payout-third`}
                value={payoutForm.third}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, third: e.target.value }))}
                placeholder="Email or user id"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayout} disabled={payingOut}>
              {payingOut ? 'Paying out...' : 'Pay winners'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{labels.listTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{labels.listDescription}</p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              <span className="text-xs text-muted-foreground">{events.length} total</span>
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
                Sort by
              </label>
              <Select
                id={`${type}-sort`}
                value={sort}
                onChange={(e) => setSort(e.target.value as EventSortKey)}
                className="w-[180px]"
                aria-label="Sort events"
              >
                <SelectItem value="soonest">Soonest first</SelectItem>
                <SelectItem value="latest">Latest first</SelectItem>
                <SelectItem value="topicAz">Topic A-Z</SelectItem>
                <SelectItem value="topicZa">Topic Z-A</SelectItem>
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
            <p className="text-sm text-muted-foreground font-medium">No matches found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a different keyword or clear the filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Topic</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Duration</th>
                    <th className="py-2 pr-4 font-medium">Difficulty</th>
                    <th className="py-2 pr-4 font-medium">Credits</th>
                    <th className="py-2 pr-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((liveEvent) => {
                    const eventDate = new Date(liveEvent.date);
                    return (
                      <tr key={liveEvent.id} className="border-b border-border/60 text-sm text-foreground">
                        <td className="py-3 pr-4 min-w-[220px]">
                          <div className="font-medium">{liveEvent.topic}</div>
                        </td>
                        <td className="py-3 pr-4 min-w-[140px] text-muted-foreground">
                          {formatDate(eventDate)}
                        </td>
                        <td className="py-3 pr-4 min-w-[120px] text-muted-foreground">
                          {formatTime(eventDate)}
                        </td>
                        <td className="py-3 pr-4 min-w-[120px]">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {liveEvent.durationMinutes} min
                          </span>
                        </td>
                        <td className="py-3 pr-4 min-w-[140px]">
                          {liveEvent.difficulty ? (
                            <DifficultyBars difficulty={liveEvent.difficulty} />
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 min-w-[120px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5" />
                            {Math.round(liveEvent.creditCost)} credits
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex justify-start gap-2">
                            {type === 'PROBLEM_SPRINT' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => requestPayout(liveEvent)}
                              >
                                Payout winners
                              </Button>
                            ) : null}
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => requestDelete(liveEvent)}
                            >
                              Delete
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
                  Load more items
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
  return (
    <LiveEventsAdminPanel
      type="PROBLEM_SPRINT"
      defaults={{ durationMinutes: '10', difficulty: 'BASIC', creditCost: '3' }}
      labels={{
        formTitle: 'Create a problem sprint',
        formDescription: 'Set up a new timed sprint and publish it to the live activities page.',
        formButton: 'Publish sprint',
        addButton: 'Add sprint',
        listTitle: 'Scheduled problem sprints',
        listDescription: 'Manage upcoming problem sprints.',
        emptyTitle: 'No problem sprints scheduled yet.',
        emptyDescription: 'Use the add button above to schedule the first sprint.',
        searchPlaceholder: 'Search sprints...',
      }}
    />
  );
}

export function EventsAdminPanel() {
  return (
    <LiveEventsAdminPanel
      type="EVENT"
      labels={{
        formTitle: 'Create a live event',
        formDescription: 'Schedule a new event for the live activities calendar.',
        formButton: 'Publish event',
        addButton: 'Add event',
        listTitle: 'Scheduled events',
        listDescription: 'Manage upcoming live events.',
        emptyTitle: 'No events scheduled yet.',
        emptyDescription: 'Use the add button above to schedule the first event.',
        searchPlaceholder: 'Search events...',
      }}
    />
  );
}

export function AnnouncementsAdminPanel() {
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<AnnouncementSortKey>('newest');
  const [page, setPage] = useState(1);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
  });
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);

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
      toast.error('Title and announcement text are required.');
      return;
    }
    try {
      const res = await fetch('/api/live-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementForm.title,
          body: announcementForm.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create announcement.');
        return;
      }
      toast.success('Announcement published.');
      setAnnouncementForm({ title: '', body: '' });
      setAnnouncementDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create announcement.');
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      const res = await fetch(`/api/live-announcements/${announcementId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete announcement.');
        return;
      }
      toast.success('Announcement removed.');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete announcement.');
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
      <AlertDialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create an announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Post updates that appear in the live activities sidebar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form className="mt-4 grid gap-4" onSubmit={handleCreateAnnouncement}>
            <div className="grid gap-2">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={announcementForm.title}
                onChange={(e) =>
                  setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Update title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="announcement-body">Announcement</Label>
              <textarea
                id="announcement-body"
                className="min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={announcementForm.body}
                onChange={(e) =>
                  setAnnouncementForm((prev) => ({ ...prev, body: e.target.value }))
                }
                placeholder="Write the announcement text"
              />
            </div>
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel
                type="button"
                onClick={() => setAnnouncementDialogOpen(false)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction type="submit">Publish announcement</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Announcements</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manage shared updates.</p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              <span className="text-xs text-muted-foreground">{announcements.length} total</span>
            )}
            <Button size="sm" onClick={() => setAnnouncementDialogOpen(true)}>
              Add announcement
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
                placeholder="Search announcements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search announcements"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="announcements-sort" className="text-sm text-muted-foreground whitespace-nowrap">
                Sort by
              </label>
              <Select
                id="announcements-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as AnnouncementSortKey)}
                className="w-[180px]"
                aria-label="Sort announcements"
              >
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="titleAz">Title A-Z</SelectItem>
                <SelectItem value="titleZa">Title Z-A</SelectItem>
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
            <p className="text-sm text-muted-foreground font-medium">No announcements yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the add button above to publish the first update.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
            <Search className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No matches found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a different keyword or clear the filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Announcement</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAnnouncements.map((announcement) => (
                    <tr key={announcement.id} className="border-b border-border/60 text-sm text-foreground">
                      <td className="py-3 pr-4 min-w-[220px]">
                        <div className="font-medium">{announcement.title}</div>
                      </td>
                      <td className="py-3 pr-4 min-w-[320px]">
                        <p className="text-xs text-muted-foreground max-w-[420px] truncate">
                          {announcement.body}
                        </p>
                      </td>
                      <td className="py-3 pr-4 min-w-[140px] text-muted-foreground">
                        {formatDate(new Date(announcement.createdAt))}
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex justify-start gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                          >
                            Delete
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
                  Load more items
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
