export type MutedWindow = { from: string; to: string };

export const NOTIFY_REPLIES_DISABLED_AT_COOKIE = 'oy_notify_replies_disabled_at';
export const NOTIFY_CREDITS_DISABLED_AT_COOKIE = 'oy_notify_credits_disabled_at';
export const NOTIFY_SPRINTS_DISABLED_AT_COOKIE = 'oy_notify_sprints_disabled_at';

export const NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE = 'oy_notify_replies_muted_windows';
export const NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE = 'oy_notify_credits_muted_windows';
export const NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE = 'oy_notify_sprints_muted_windows';

export function parseMutedWindows(raw: string | undefined): MutedWindow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is MutedWindow => {
        if (!item || typeof item !== 'object') return false;
        const from = (item as { from?: unknown }).from;
        const to = (item as { to?: unknown }).to;
        return typeof from === 'string' && typeof to === 'string';
      })
      .slice(-10);
  } catch {
    return [];
  }
}

export function parseIsoOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function buildMutedCreatedAtNotFilters(
  windows: MutedWindow[],
  openMutedFrom: Date | null,
): Array<{ NOT: { createdAt: { gte: Date; lt: Date } } }> {
  const notFilters: Array<{ NOT: { createdAt: { gte: Date; lt: Date } } }> = [];
  for (const window of windows) {
    const from = new Date(window.from);
    const to = new Date(window.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;
    if (to.getTime() <= from.getTime()) continue;
    notFilters.push({ NOT: { createdAt: { gte: from, lt: to } } });
  }
  if (openMutedFrom) {
    const now = new Date();
    if (now.getTime() > openMutedFrom.getTime()) {
      notFilters.push({ NOT: { createdAt: { gte: openMutedFrom, lt: now } } });
    }
  }
  return notFilters;
}

