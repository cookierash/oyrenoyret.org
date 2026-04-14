/**
 * Events Admin - Live Events
 *
 * Redirects to the events admin hub with the correct tab selected.
 */

import { permanentRedirect } from 'next/navigation';

export default function EventsAdminLiveEventsPage() {
  permanentRedirect('/admin/events?tab=events');
}

