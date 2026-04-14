/**
 * Events Admin - Problem Sprints
 *
 * Redirects to the events admin hub with the correct tab selected.
 */

import { permanentRedirect } from 'next/navigation';

export default function EventsAdminProblemSprintsPage() {
  permanentRedirect('/admin/events?tab=sprints');
}

