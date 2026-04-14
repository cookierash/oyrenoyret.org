/**
 * Legacy Manage Interactive Sessions Route
 *
 * Redirects to /admin/events.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyInteractiveSessionsAdminPage() {
  permanentRedirect('/admin/events');
}
