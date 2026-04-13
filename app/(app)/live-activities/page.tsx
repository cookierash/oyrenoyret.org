/**
 * Legacy Live Activities Route
 *
 * Redirects to /interactive-sessions.
 */

import { redirect } from 'next/navigation';

export default function LegacyLiveActivitiesPage() {
  redirect('/interactive-sessions');
}

