import { parseIsoOrNull } from './mute-windows';

export const NOTIFICATIONS_READ_AT_COOKIE = 'oy_notifications_read_at';

export function parseNotificationsReadAt(raw: string | undefined): Date | null {
  return parseIsoOrNull(raw);
}

