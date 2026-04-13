/**
 * Admin dashboard page
 *
 * Legacy route (stats removed).
 *
 * Redirects to /admin/interactive-sessions.
 */

import { redirect } from 'next/navigation';

export default async function AdminDashboardPage() {
  redirect('/admin/interactive-sessions');
}
