/**
 * Legacy Live Activities Route
 *
 * Redirects to /events.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyLiveActivitiesPage() {
  permanentRedirect('/events');
}

