/**
 * Legacy Admin Live Activities Route
 *
 * Redirects to /admin/events.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyAdminLiveActivitiesPage() {
  permanentRedirect('/admin/events');
}

