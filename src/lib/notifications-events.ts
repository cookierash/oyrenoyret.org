/**
 * Notifications update events - dispatch when unread count changes so sidebar updates immediately.
 */

export const NOTIFICATIONS_UNREAD_UPDATED_EVENT = 'notifications-unread-updated';

export function dispatchNotificationsUnreadUpdated(unreadCount: number): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATIONS_UNREAD_UPDATED_EVENT, { detail: { unreadCount } }),
    );
  }
}

