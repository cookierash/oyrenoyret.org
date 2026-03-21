'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Calendar, Clock, Coins, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyBars, MaterialDifficulty } from '@/src/modules/materials/difficulty-bars';
import { dispatchCreditsUpdated } from '@/src/lib/credits-events';

interface LiveEvent {
  id: string;
  topic: string;
  date: string;
  durationMinutes: number;
  difficulty: MaterialDifficulty | null;
  creditCost: number;
  type: string;
  enrollmentStatus: 'PENDING' | 'CONFIRMED' | null;
}

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

function EventCardSkeleton() {
  return (
    <div className="card-frame bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-24" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-28" />
      </div>
    </div>
  );
}

export function LiveEventsBoard() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchEvents = () => {
    setLoading(true);
    fetch('/api/live-events?take=100', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const myEvents = useMemo(
    () => events.filter((event) => event.enrollmentStatus === 'CONFIRMED'),
    [events],
  );

  const handleEnroll = async (eventId: string) => {
    setActionId(eventId);
    try {
      const res = await fetch(`/api/live-events/${eventId}/enroll`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('Insufficient credits to register.');
        } else {
          toast.error(data.error ?? 'Failed to register.');
        }
        return;
      }
      if (typeof data.balanceAfter === 'number') {
        dispatchCreditsUpdated(data.balanceAfter);
      }
      toast.success('Registration received. Please verify to complete.');
      fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to register.');
    } finally {
      setActionId(null);
    }
  };

  const handleConfirm = async (eventId: string) => {
    setActionId(eventId);
    try {
      const res = await fetch(`/api/live-events/${eventId}/confirm`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to verify registration.');
        return;
      }
      toast.success('Registration verified. You are enrolled.');
      fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify registration.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">My events</h2>
            <p className="text-xs text-muted-foreground">
              Confirmed registrations for your upcoming sprints.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{myEvents.length} enrolled</span>
        </div>
        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <EventCardSkeleton key={`my-skeleton-${i}`} />
            ))}
          </div>
        ) : myEvents.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No confirmed events yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Complete a registration below to see it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myEvents.map((event) => (
              <LiveEventCard
                key={event.id}
                event={event}
                actionId={actionId}
                onEnroll={handleEnroll}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">All events</h2>
          <p className="text-xs text-muted-foreground">
            Problem sprints you can join in the next 10-15 minutes.
          </p>
        </div>
        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <EventCardSkeleton key={`all-skeleton-${i}`} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="card-frame border-dashed bg-muted/20 px-5 py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">No live events scheduled.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Check back soon or watch the announcements sidebar.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <LiveEventCard
                key={event.id}
                event={event}
                actionId={actionId}
                onEnroll={handleEnroll}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface LiveEventCardProps {
  event: LiveEvent;
  actionId: string | null;
  onEnroll: (eventId: string) => void;
  onConfirm: (eventId: string) => void;
}

function LiveEventCard({ event, actionId, onEnroll, onConfirm }: LiveEventCardProps) {
  const eventDate = new Date(event.date);
  const isPending = event.enrollmentStatus === 'PENDING';
  const isConfirmed = event.enrollmentStatus === 'CONFIRMED';
  const isBusy = actionId === event.id;

  return (
    <div className="card-frame bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{event.topic}</h3>
            {isConfirmed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                Enrolled
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                Verification needed
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Problem sprint</p>
        </div>
        <DifficultyBars difficulty={event.difficulty} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(eventDate)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(eventDate)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
          <Clock className="h-3 w-3" />
          {event.durationMinutes} min solution window
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-foreground">
          <Coins className="h-3 w-3" />
          {Number(event.creditCost).toFixed(1)} credits
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {isPending ? (
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            A verification message was sent to your account.
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Ready when you are.
          </span>
        )}

        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <Button asChild size="sm" variant="secondary-primary">
              <Link href={`/sprints/${event.id}`}>Enter sprint</Link>
            </Button>
          ) : isPending ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onConfirm(event.id)}
              disabled={isBusy}
            >
              Complete registration
            </Button>
          ) : (
            <Button size="sm" onClick={() => onEnroll(event.id)} disabled={isBusy}>
              Register
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
