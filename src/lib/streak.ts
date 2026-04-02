export const STREAK_OFFSET_HOURS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toDayNumber(date: Date) {
  return Math.floor((date.getTime() + STREAK_OFFSET_HOURS * 60 * 60 * 1000) / DAY_MS);
}
