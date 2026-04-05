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
              'group rounded-xl border p-3 text-left transition-all',
              isActive
                ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                : 'border-border/70 hover:border-primary/30 hover:bg-muted/30',
            )}
          >
            <div
              className={cn(
                'h-24 rounded-lg border border-border/60 shadow-sm',
                option.id === 'light'
                  ? 'bg-gradient-to-br from-white via-slate-50 to-slate-100'
                  : 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800',
              )}
            >
              <div
                className={cn(
                  'h-7 rounded-t-lg border-b border-border/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  option.id === 'light'
                    ? 'bg-white/80 text-slate-500'
                    : 'bg-black/30 text-slate-300',
                )}
              >
                oyrenoyret
              </div>
              <div
                className={cn(
                  'px-2 pt-2 text-xs',
                  option.id === 'light' ? 'text-slate-600' : 'text-slate-300',
                )}
              >
                <div className={cn('h-2 w-1/2 rounded-full', option.id === 'light' ? 'bg-slate-200' : 'bg-slate-700')} />
                <div className={cn('mt-2 h-2 w-2/3 rounded-full', option.id === 'light' ? 'bg-slate-200' : 'bg-slate-700')} />
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
