/**
 * Legacy Announcements Admin Page
 */

import { redirect } from 'next/navigation';

export default async function AnnouncementsAdminPage() {
  redirect('/admin/interactive-sessions?tab=announcements');
}
