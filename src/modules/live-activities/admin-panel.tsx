'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Clock, Coins, Trash2 } from 'lucide-react';
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

export function LiveActivitiesAdminPanel() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventForm, setEventForm] = useState({
    topic: '',
    date: '',
    durationMinutes: '10',
    difficulty: 'BASIC',
    creditCost: '5',
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/live-events?take=200', { cache: 'no-store' }).then((res) =>
        res.ok ? res.json() : [],
      ),
      fetch('/api/live-announcements?take=200', { cache: 'no-store' }).then((res) =>
        res.ok ? res.json() : [],
      ),
    ])
      .then(([eventsData, announcementsData]) => {
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
      })
      .catch(() => {
        setEvents([]);
        setAnnouncements([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

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
    const duration = Number(eventForm.durationMinutes);
    const creditCost = Number(eventForm.creditCost);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error('Duration must be a positive number.');
      return;
    }
    if (!Number.isFinite(creditCost) || creditCost < 0) {
      toast.error('Credit cost must be 0 or greater.');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create event.');
        return;
      }
      toast.success('Event created.');
      setEventForm({
        topic: '',
        date: '',
        durationMinutes: '10',
        difficulty: 'BASIC',
        creditCost: '5',
      });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create event.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/live-events/${eventId}`, { method: 'DELETE' });
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

  return (
    <div className="space-y-8">
      <section className="card-frame bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Create a problem sprint</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Set up a new timed sprint and publish it to the live activities page.
        </p>

        <form className="mt-4 grid gap-4" onSubmit={handleCreateEvent}>
          <div className="grid gap-2">
            <Label htmlFor="event-topic">Topic</Label>
            <Input
              id="event-topic"
              value={eventForm.topic}
              onChange={(e) => setEventForm((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Scientific topic or challenge"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-date">Date & time</Label>
              <Input
                id="event-date"
                type="datetime-local"
                value={eventForm.date}
                onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-duration">Solution duration (minutes)</Label>
              <Input
                id="event-duration"
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
              <Label htmlFor="event-difficulty">Difficulty</Label>
              <Select
                id="event-difficulty"
                value={eventForm.difficulty}
                onChange={(e) => setEventForm((prev) => ({ ...prev, difficulty: e.target.value }))}
              >
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                <SelectItem value="ADVANCED">Advanced</SelectItem>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-credit">Credits to join</Label>
              <Input
                id="event-credit"
                type="number"
                min={0}
                step={0.1}
                value={eventForm.creditCost}
                onChange={(e) => setEventForm((prev) => ({ ...prev, creditCost: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Button type="submit" size="sm">
              Publish event
            </Button>
          </div>
        </form>
      </section>

      <section className="card-frame bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scheduled sprints</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage upcoming problem sprints.
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-3 w-16" />
          ) : (
            <span className="text-xs text-muted-foreground">{events.length} events</span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`event-skeleton-${i}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/70 bg-background px-4 py-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-7 w-20" />
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No events yet.</p>
            </div>
          ) : (
            events.map((event) => {
              const eventDate = new Date(event.date);
              return (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/70 bg-background px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{event.topic}</p>
                      <DifficultyBars difficulty={event.difficulty} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {eventDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {event.durationMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        {Number(event.creditCost).toFixed(1)} credits
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="card-frame bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Announcements</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Post updates that appear in the live activities sidebar.
        </p>

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
          <div>
            <Button type="submit" size="sm">
              Publish announcement
            </Button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`announcement-skeleton-${i}`}
                className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-border/70 bg-background px-4 py-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-7 w-20" />
              </div>
            ))
          ) : announcements.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-border/70 bg-background px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{announcement.title}</p>
                  <p className="text-xs text-muted-foreground">{announcement.body}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
