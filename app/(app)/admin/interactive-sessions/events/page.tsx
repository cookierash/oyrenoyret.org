/**
 * Legacy Events Admin Page
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyInteractiveSessionsEventsAdminPage() {
  permanentRedirect('/admin/events?tab=events');
}
