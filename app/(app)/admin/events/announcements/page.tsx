/**
 * Events Admin - Announcements
 *
 * Redirects to the events admin hub with the correct tab selected.
 */

import { permanentRedirect } from 'next/navigation';

export default function EventsAdminAnnouncementsPage() {
  permanentRedirect('/admin/events?tab=announcements');
}

