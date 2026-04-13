/**
 * Legacy Admin Live Activities Route
 *
 * Redirects to /admin/interactive-sessions.
 */

import { redirect } from 'next/navigation';

export default function LegacyAdminLiveActivitiesPage() {
  redirect('/admin/interactive-sessions');
}

