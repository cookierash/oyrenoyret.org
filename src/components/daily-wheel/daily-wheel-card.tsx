'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DAILY_WHEEL_REWARDS, getDailyWheelSegmentIndex, type DailyWheelReward } from '@/src/lib/daily-wheel';

const SEGMENTS = DAILY_WHEEL_REWARDS.length;
const SEGMENT_DEG = 360 / SEGMENTS;
const SPIN_DURATION_MS = 4200;

type DailyWheelCopy = {
  title: string;
  subtitle: string;
  spinCta: string;
  spinningCta: string;
  alreadySpunToast: string;
  resultLabel: string;
  comeBackTomorrow: string;
  youWon: string;
};

type DailyWheelSpinState = {
  dayNumber: number;
  reward: number;
  spunAtIso: string;
} | null;

function normalizeReward(value: number): DailyWheelReward {
  return (DAILY_WHEEL_REWARDS.includes(value as DailyWheelReward) ? value : 0) as DailyWheelReward;
}

function buildWheelBackground() {
  const colors = ['#94a3b8', '#34d399', '#60a5fa', '#fbbf24', '#f472b6'];
  const stops = colors
    .map((color, idx) => `${color} ${idx * SEGMENT_DEG}deg ${(idx + 1) * SEGMENT_DEG}deg`)
    .join(', ');
  return `conic-gradient(from -36deg, ${stops})`;
}

function computeTargetRotation(currentRotation: number, segmentIndex: number) {
  const jitterMax = 20;
  const jitter = (Math.random() * 2 - 1) * jitterMax;
  const targetNorm = ((-segmentIndex * SEGMENT_DEG + jitter) % 360 + 360) % 360;
  const currentNorm = ((currentRotation % 360) + 360) % 360;
  let delta = targetNorm - currentNorm;
  if (delta < 0) delta += 360;
  const spins = 6 + Math.floor(Math.random() * 2);
  return currentRotation + spins * 360 + delta;
}

export function DailyWheelCard({
  copy,
  initialSpin,
}: {
  copy: DailyWheelCopy;
  initialSpin: DailyWheelSpinState;
}) {
  const [spin, setSpin] = useState<DailyWheelSpinState>(initialSpin);
  const [pendingSpin, setPendingSpin] = useState<DailyWheelSpinState>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rotation, setRotation] = useState(0);

  const rotationRef = useRef(0);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wheelBg = useMemo(() => buildWheelBackground(), []);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!spin) return;
    const reward = normalizeReward(spin.reward);
    const idx = getDailyWheelSegmentIndex(reward);
    setRotation(-idx * SEGMENT_DEG);
    rotationRef.current = -idx * SEGMENT_DEG;
  }, [spin]);

  async function onSpin() {
    if (isAnimating) return;
    if (spin) {
      toast.message(copy.alreadySpunToast);
      return;
    }

    setIsAnimating(true);
    try {
      const res = await fetch('/api/daily-wheel/spin', { method: 'POST' });
      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage = (() => {
          if (!raw || typeof raw !== 'object') return 'Something went wrong.';
          if ('error' in raw) return String((raw as { error?: unknown }).error ?? 'Something went wrong.');
          return 'Something went wrong.';
        })();
        const hint =
          raw && typeof raw === 'object' && raw !== null && 'hint' in raw
            ? String((raw as { hint?: unknown }).hint ?? '')
            : '';
        toast.error(hint ? `${errorMessage} ${hint}` : errorMessage);
        setIsAnimating(false);
        return;
      }

      if (!raw || typeof raw !== 'object') {
        toast.error('Something went wrong.');
        setIsAnimating(false);
        return;
      }

      if ('degraded' in raw && Boolean((raw as { degraded?: unknown }).degraded)) {
        toast.error('Service temporarily unavailable.');
        setIsAnimating(false);
        return;
      }

      if (!('alreadySpun' in raw) || typeof (raw as { alreadySpun?: unknown }).alreadySpun !== 'boolean') {
        toast.error('Something went wrong.');
        setIsAnimating(false);
        return;
      }

      const data = raw as { alreadySpun: boolean; dayNumber: number; reward: number; spunAt: string; balanceAfter?: number };

      if (data.alreadySpun) {
        setSpin({ dayNumber: data.dayNumber, reward: data.reward, spunAtIso: data.spunAt });
        toast.message(copy.alreadySpunToast);
        setIsAnimating(false);
        return;
      }

      const reward = normalizeReward(data.reward);
      const idx = getDailyWheelSegmentIndex(reward);
      setPendingSpin({ dayNumber: data.dayNumber, reward, spunAtIso: data.spunAt });
      setRotation(computeTargetRotation(rotationRef.current, idx));

      // Fallback: if the browser doesn't fire transition events (e.g. reduced motion),
      // settle the spin after the duration.
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        onWheelTransitionEnd();
      }, SPIN_DURATION_MS + 50);
    } catch (e) {
      toast.error('Something went wrong.');
      setIsAnimating(false);
    }
  }

  function onWheelTransitionEnd() {
    if (!pendingSpin) return;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setSpin(pendingSpin);
    setPendingSpin(null);
    setIsAnimating(false);
    toast.success(copy.youWon.replace('{{credits}}', String(pendingSpin.reward)));
  }

  const rewardValue = spin ? normalizeReward(spin.reward) : null;
  const isReady = !spin && !isAnimating;
  const ctaText = isAnimating ? copy.spinningCta : spin ? copy.comeBackTomorrow : copy.spinCta;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-white via-rose-50/60 to-amber-50/70 p-4 shadow-sm dark:border-white/10 dark:from-white/5 dark:via-rose-500/10 dark:to-amber-500/10 sm:p-6">
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-400/10" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-400/10" />

      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{copy.subtitle}</p>

          <div className="pt-2">
            <Button onClick={onSpin} disabled={!isReady} className="h-10 rounded-xl px-5">
              {ctaText}
            </Button>
            {rewardValue !== null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {copy.resultLabel}{' '}
                <span className="font-medium text-foreground">+{rewardValue}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-center md:justify-end">
          <div className="relative">
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 -translate-y-1 border-x-[10px] border-b-[18px] border-x-transparent border-b-foreground/80 drop-shadow-sm dark:border-b-white/80" />

            <div
              ref={wheelRef}
              onTransitionEnd={(event) => {
                if (event.propertyName !== 'transform') return;
                onWheelTransitionEnd();
              }}
              className={[
                'relative h-56 w-56 select-none rounded-full shadow-xl shadow-black/10 ring-1 ring-black/10 dark:shadow-black/30 dark:ring-white/10',
                isAnimating ? 'transition-transform' : '',
              ].join(' ')}
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: `${SPIN_DURATION_MS}ms`,
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                backgroundImage: wheelBg,
              }}
              aria-label="Daily wheel"
            >
              <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.9),transparent_55%)] dark:bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.25),transparent_55%)]" />
              <div className="pointer-events-none absolute inset-[6px] rounded-full ring-1 ring-white/50 dark:ring-white/10" />

              {DAILY_WHEEL_REWARDS.map((value, idx) => (
                <div
                  key={value}
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${idx * SEGMENT_DEG}deg) translateY(-78px) rotate(${-idx * SEGMENT_DEG}deg)`,
                  }}
                >
                  <div className="rounded-lg bg-white/70 px-2 py-1 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-white/60 backdrop-blur dark:bg-slate-950/40 dark:text-white dark:ring-white/10">
                    {value}
                  </div>
                </div>
              ))}

              <div className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white to-slate-100 shadow-md ring-1 ring-black/5 dark:from-slate-900 dark:to-slate-950 dark:ring-white/10" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 ring-2 ring-white/80 dark:bg-white/70 dark:ring-slate-950/60" />
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-full bg-transparent shadow-[inset_0_0_0_10px_rgba(255,255,255,0.55)] dark:shadow-[inset_0_0_0_10px_rgba(0,0,0,0.15)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
