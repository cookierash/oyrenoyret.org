/**
 * Admin dashboard page
 *
 * Legacy route (stats removed).
 *
 * Redirects to /admin/events.
 */

import { redirect } from 'next/navigation';

export default async function AdminDashboardPage() {
  redirect('/admin/events');
}
