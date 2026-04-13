/**
 * Legacy Events Admin Page
 */

import { redirect } from 'next/navigation';

export default async function EventsAdminPage() {
  redirect('/admin/interactive-sessions?tab=events');
}
