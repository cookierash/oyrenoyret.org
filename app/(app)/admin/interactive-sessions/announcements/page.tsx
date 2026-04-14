/**
 * Legacy Announcements Admin Page
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyInteractiveSessionsAnnouncementsAdminPage() {
  permanentRedirect('/admin/events?tab=announcements');
}
