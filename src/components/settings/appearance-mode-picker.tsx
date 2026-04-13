'use client';

import { useTheme } from 'next-themes';
import { PiSun as Sun, PiMoon as Moon } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n/i18n-provider';

export function AppearanceModePicker() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { messages } = useI18n();
  const copy = messages.settings.appearance;
  const currentTheme = resolvedTheme ?? (theme === 'system' ? 'light' : theme) ?? 'light';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        { id: 'light', label: copy.lightLabel, icon: Sun },
        { id: 'dark', label: copy.darkLabel, icon: Moon },
      ] as const).map((option) => {
        const isActive = currentTheme === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            aria-pressed={isActive}
            className={cn(
              'group rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-primary/55 ring-2 ring-primary/15 bg-primary/4'
                : 'border-border/70 hover:border-primary/25 hover:bg-muted/25',
            )}
          >
            <div
              className={cn(
                'h-24 overflow-hidden rounded-lg border shadow-sm',
                option.id === 'light'
                  ? 'border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-slate-200/60 shadow-slate-900/5'
                  : 'border-neutral-800/80 bg-gradient-to-br from-neutral-950 via-neutral-950 to-neutral-900 shadow-black/35',
              )}
            >
              <div
                className={cn(
                  'flex h-7 items-center justify-between border-b px-2 py-1 text-[10px] font-medium uppercase tracking-wide',
                  option.id === 'light'
                    ? 'border-slate-200/60 bg-white/70 text-slate-500'
                    : 'border-neutral-800/70 bg-neutral-950/35 text-neutral-300/90',
                )}
              >
                <span className="brand-font">oyrenoyret</span>
                <span
                  className={cn(
                    'h-1.5 w-5 rounded-full',
                    option.id === 'light' ? 'bg-slate-200/80' : 'bg-neutral-700/60',
                  )}
                  aria-hidden
                />
              </div>
              <div
                className={cn(
                  'px-2 pt-2 text-xs',
                  option.id === 'light' ? 'text-slate-600' : 'text-neutral-300',
                )}
              >
                <div
                  className={cn(
                    'h-2 w-1/2 rounded-full',
                    option.id === 'light' ? 'bg-slate-200/80' : 'bg-neutral-700/55',
                  )}
                />
                <div
                  className={cn(
                    'mt-2 h-2 w-2/3 rounded-full',
                    option.id === 'light' ? 'bg-slate-200/80' : 'bg-neutral-700/55',
                  )}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm font-medium text-foreground">
              <span>{option.label}</span>
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
