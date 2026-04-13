/**
 * Recent Activities Page (legacy)
 *
 * Redirects to /notifications.
 */

import { redirect } from 'next/navigation';

export default async function RecentActivitiesPage() {
  redirect('/notifications');
}

